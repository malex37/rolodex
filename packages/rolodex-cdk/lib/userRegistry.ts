import { Duration, RemovalPolicy } from "aws-cdk-lib";
import {
  AccountRecovery,
  FeaturePlan,
  UserPool,
  type UserPoolClient,
} from "aws-cdk-lib/aws-cognito";
import {
  IdentityPool,
  UserPoolAuthenticationProvider,
} from "aws-cdk-lib/aws-cognito-identitypool";
import type { IRole } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

// Who can sign in to Rolodex. Users are created by an admin (no self sign-up);
// signing in yields temporary AWS credentials via the identity pool, which the
// UI uses to SigV4-sign calls to the IAM-authorized API.
export class UserRegistry extends Construct {
  readonly userPool: UserPool;
  readonly userPoolClient: UserPoolClient;
  readonly identityPool: IdentityPool;
  readonly authenticatedRole: IRole;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.userPool = new UserPool(this, "UserPool", {
      // Lite: no paid features, free for this app's handful of users.
      featurePlan: FeaturePlan.LITE,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
        tempPasswordValidity: Duration.days(7),
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Public SPA client (no secret). The UI calls InitiateAuth directly over
    // HTTPS with USER_PASSWORD_AUTH, so no auth library is needed.
    this.userPoolClient = this.userPool.addClient("WebClient", {
      generateSecret: false,
      authFlows: { userPassword: true },
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
    });

    this.identityPool = new IdentityPool(this, "IdentityPool", {
      allowUnauthenticatedIdentities: false,
      authenticationProviders: {
        userPools: [
          new UserPoolAuthenticationProvider({
            userPool: this.userPool,
            userPoolClient: this.userPoolClient,
          }),
        ],
      },
    });

    this.authenticatedRole = this.identityPool.authenticatedRole;
  }
}
