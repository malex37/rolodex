import type { AwsCredentials } from "./client.ts";

export interface CognitoAuthOptions {
  region: string;
  userPoolId: string;
  userPoolClientId: string;
  identityPoolId: string;
  /** Where the session persists between page loads; defaults to in-memory. */
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
}

export type SignInResult = { status: "signedIn" } | { status: "newPasswordRequired" };

interface Tokens {
  idToken: string;
  refreshToken: string;
  /** Epoch ms when the id token expires. */
  expiresAt: number;
}

interface CachedCredentials extends Required<AwsCredentials> {
  /** Epoch ms. */
  expiresAt: number;
}

interface AuthenticationResult {
  IdToken: string;
  RefreshToken?: string;
  ExpiresIn: number;
}

interface InitiateAuthResponse {
  AuthenticationResult?: AuthenticationResult;
  ChallengeName?: string;
  Session?: string;
}

const STORAGE_KEY = "rolodex.auth";
// Refresh a little before expiry so in-flight requests don't race it.
const EXPIRY_MARGIN_MS = 60_000;

export class CognitoAuthError extends Error {
  override name = "CognitoAuthError";

  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function memoryStorage(): CognitoAuthOptions["storage"] & {} {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split(".")[1] ?? "";
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
}

// Signs users in against a Cognito user pool and exchanges their id token for
// temporary AWS credentials through the identity pool. Talks to the Cognito
// JSON APIs with plain fetch: no SDK or auth library.
export class CognitoAuth {
  readonly #options: CognitoAuthOptions;
  readonly #storage: NonNullable<CognitoAuthOptions["storage"]>;
  #tokens: Tokens | null;
  #credentials: CachedCredentials | null = null;
  #identityId: string | null = null;
  #challenge: { session: string; username: string } | null = null;

  constructor(options: CognitoAuthOptions) {
    this.#options = options;
    this.#storage = options.storage ?? memoryStorage();
    this.#tokens = this.#loadTokens();
  }

  /** True when there is a stored session (it may still need a token refresh). */
  get isSignedIn(): boolean {
    return this.#tokens !== null;
  }

  get email(): string | null {
    if (!this.#tokens) return null;
    const { email } = decodeJwtPayload(this.#tokens.idToken);
    return typeof email === "string" ? email : null;
  }

  async signIn(username: string, password: string): Promise<SignInResult> {
    const res = await this.#userPool<InitiateAuthResponse>("InitiateAuth", {
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: this.#options.userPoolClientId,
      AuthParameters: { USERNAME: username, PASSWORD: password },
    });
    return this.#handleAuthResponse(res, username);
  }

  /** Answers the NEW_PASSWORD_REQUIRED challenge admin-created users get on first sign-in. */
  async completeNewPassword(newPassword: string): Promise<SignInResult> {
    if (!this.#challenge) throw new CognitoAuthError("NoChallenge", "No sign-in in progress");
    const { session, username } = this.#challenge;
    const res = await this.#userPool<InitiateAuthResponse>("RespondToAuthChallenge", {
      ChallengeName: "NEW_PASSWORD_REQUIRED",
      ClientId: this.#options.userPoolClientId,
      Session: session,
      ChallengeResponses: { USERNAME: username, NEW_PASSWORD: newPassword },
    });
    return this.#handleAuthResponse(res, username);
  }

  async signOut(): Promise<void> {
    const refreshToken = this.#tokens?.refreshToken;
    this.#clear();
    if (refreshToken) {
      // Best effort: the local session is already gone either way.
      await this.#userPool("RevokeToken", {
        Token: refreshToken,
        ClientId: this.#options.userPoolClientId,
      }).catch(() => {});
    }
  }

  /** Temporary AWS credentials for the signed-in user, refreshed as needed. */
  async getCredentials(): Promise<AwsCredentials> {
    if (this.#credentials && this.#credentials.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
      return this.#credentials;
    }

    const logins = {
      [`cognito-idp.${this.#options.region}.amazonaws.com/${this.#options.userPoolId}`]:
        await this.#idToken(),
    };

    this.#identityId ??= (
      await this.#identityPool<{ IdentityId: string }>("GetId", {
        IdentityPoolId: this.#options.identityPoolId,
        Logins: logins,
      })
    ).IdentityId;

    const { Credentials } = await this.#identityPool<{
      Credentials: {
        AccessKeyId: string;
        SecretKey: string;
        SessionToken: string;
        Expiration: number;
      };
    }>("GetCredentialsForIdentity", { IdentityId: this.#identityId, Logins: logins });

    this.#credentials = {
      accessKeyId: Credentials.AccessKeyId,
      secretAccessKey: Credentials.SecretKey,
      sessionToken: Credentials.SessionToken,
      expiresAt: Credentials.Expiration * 1000,
    };
    return this.#credentials;
  }

  async #idToken(): Promise<string> {
    if (!this.#tokens) throw new CognitoAuthError("NotSignedIn", "Not signed in");
    if (this.#tokens.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return this.#tokens.idToken;

    try {
      const res = await this.#userPool<InitiateAuthResponse>("InitiateAuth", {
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: this.#options.userPoolClientId,
        AuthParameters: { REFRESH_TOKEN: this.#tokens.refreshToken },
      });
      if (!res.AuthenticationResult) throw new Error("No tokens in refresh response");
      this.#saveTokens(res.AuthenticationResult, this.#tokens.refreshToken);
      return this.#tokens.idToken;
    } catch (error) {
      // Refresh token expired or revoked: the user has to sign in again.
      this.#clear();
      throw error;
    }
  }

  #handleAuthResponse(res: InitiateAuthResponse, username: string): SignInResult {
    if (res.AuthenticationResult) {
      this.#challenge = null;
      this.#saveTokens(res.AuthenticationResult);
      return { status: "signedIn" };
    }
    if (res.ChallengeName === "NEW_PASSWORD_REQUIRED" && res.Session) {
      this.#challenge = { session: res.Session, username };
      return { status: "newPasswordRequired" };
    }
    throw new CognitoAuthError(
      res.ChallengeName ?? "UnexpectedResponse",
      `Unsupported sign-in step: ${res.ChallengeName ?? "unknown"}`,
    );
  }

  #saveTokens(result: AuthenticationResult, refreshToken = result.RefreshToken): void {
    if (!refreshToken) throw new CognitoAuthError("NoRefreshToken", "Missing refresh token");
    this.#tokens = {
      idToken: result.IdToken,
      refreshToken,
      expiresAt: Date.now() + result.ExpiresIn * 1000,
    };
    this.#credentials = null;
    this.#storage.setItem(STORAGE_KEY, JSON.stringify(this.#tokens));
  }

  #loadTokens(): Tokens | null {
    try {
      const raw = this.#storage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Tokens) : null;
    } catch {
      return null;
    }
  }

  #clear(): void {
    this.#tokens = null;
    this.#credentials = null;
    this.#identityId = null;
    this.#challenge = null;
    this.#storage.removeItem(STORAGE_KEY);
  }

  #userPool<T>(action: string, body: unknown): Promise<T> {
    return this.#call(
      `https://cognito-idp.${this.#options.region}.amazonaws.com/`,
      `AWSCognitoIdentityProviderService.${action}`,
      body,
    );
  }

  #identityPool<T>(action: string, body: unknown): Promise<T> {
    return this.#call(
      `https://cognito-identity.${this.#options.region}.amazonaws.com/`,
      `AWSCognitoIdentityService.${action}`,
      body,
    );
  }

  async #call<T>(url: string, target: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/x-amz-json-1.1",
        "x-amz-target": target,
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const code = String(data.__type ?? "UnknownError").split("#").pop() ?? "UnknownError";
      throw new CognitoAuthError(code, String(data.message ?? data.Message ?? code));
    }
    return data as T;
  }
}
