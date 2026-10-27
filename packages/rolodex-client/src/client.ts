import type {
  AddGroceriesInput,
  AddGroceriesOutput,
  CreateGroceryListInput,
  CreateGroceryListOutput,
  CreateRecipeInput,
  CreateRecipeOutput,
  DeleteGroceryInput,
  DeleteGroceryListInput,
  DeleteGroceryListOutput,
  DeleteGroceryOutput,
  DeleteRecipeInput,
  DeleteRecipeOutput,
  ErrorOutput,
  FeedRecipeInput,
  FeedRecipeOutput,
  GetRecipeInput,
  GetRecipeOutput,
  ListGroceriesInput,
  ListGroceriesOutput,
  ListGroceryListsInput,
  ListGroceryListsOutput,
  ListRecipesInput,
  ListRecipesOutput,
  OperationInput,
  OperationName,
  OperationOutput,
  ReorderGroceriesInput,
  ReorderGroceriesOutput,
  ShareGroceryListInput,
  ShareGroceryListOutput,
  UnshareGroceryListInput,
  UnshareGroceryListOutput,
  UpdateGroceryInput,
  UpdateGroceryOutput,
  UpdateRecipeInput,
  UpdateRecipeOutput,
} from "@rolodex/models";
import { AwsClient } from "aws4fetch";

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export interface RolodexClientOptions {
  /** API base URL, e.g. https://api.rolodex.iammalex.com */
  baseUrl: string;
  region: string;
  /** Called before every request so expiring credentials can be refreshed. */
  getCredentials: () => Promise<AwsCredentials>;
}

export class RolodexApiError extends Error {
  override name = "RolodexApiError";

  constructor(
    readonly status: number,
    readonly code: ErrorOutput["code"] | "UnknownError",
    message: string,
  ) {
    super(message);
  }
}

// Typed client for the Rolodex API. Every operation is `POST /{OperationName}`;
// requests are SigV4-signed because every route uses IAM authorization.
export class RolodexClient {
  readonly #baseUrl: string;
  readonly #region: string;
  readonly #getCredentials: () => Promise<AwsCredentials>;

  constructor({ baseUrl, region, getCredentials }: RolodexClientOptions) {
    this.#baseUrl = baseUrl.replace(/\/$/, "");
    this.#region = region;
    this.#getCredentials = getCredentials;
  }

  listRecipes(input: ListRecipesInput = {}): Promise<ListRecipesOutput> {
    return this.#call("ListRecipes", input);
  }

  getRecipe(input: GetRecipeInput): Promise<GetRecipeOutput> {
    return this.#call("GetRecipe", input);
  }

  createRecipe(input: CreateRecipeInput): Promise<CreateRecipeOutput> {
    return this.#call("CreateRecipe", input);
  }

  updateRecipe(input: UpdateRecipeInput): Promise<UpdateRecipeOutput> {
    return this.#call("UpdateRecipe", input);
  }

  deleteRecipe(input: DeleteRecipeInput): Promise<DeleteRecipeOutput> {
    return this.#call("DeleteRecipe", input);
  }

  /** Reads a recipe from a NYT Cooking page without saving it. */
  feedRecipe(input: FeedRecipeInput): Promise<FeedRecipeOutput> {
    return this.#call("FeedRecipe", input);
  }

  listGroceryLists(input: ListGroceryListsInput = {}): Promise<ListGroceryListsOutput> {
    return this.#call("ListGroceryLists", input);
  }

  createGroceryList(input: CreateGroceryListInput): Promise<CreateGroceryListOutput> {
    return this.#call("CreateGroceryList", input);
  }

  deleteGroceryList(input: DeleteGroceryListInput): Promise<DeleteGroceryListOutput> {
    return this.#call("DeleteGroceryList", input);
  }

  shareGroceryList(input: ShareGroceryListInput): Promise<ShareGroceryListOutput> {
    return this.#call("ShareGroceryList", input);
  }

  unshareGroceryList(input: UnshareGroceryListInput): Promise<UnshareGroceryListOutput> {
    return this.#call("UnshareGroceryList", input);
  }

  listGroceries(input: ListGroceriesInput): Promise<ListGroceriesOutput> {
    return this.#call("ListGroceries", input);
  }

  addGroceries(input: AddGroceriesInput): Promise<AddGroceriesOutput> {
    return this.#call("AddGroceries", input);
  }

  updateGrocery(input: UpdateGroceryInput): Promise<UpdateGroceryOutput> {
    return this.#call("UpdateGrocery", input);
  }

  deleteGrocery(input: DeleteGroceryInput): Promise<DeleteGroceryOutput> {
    return this.#call("DeleteGrocery", input);
  }

  reorderGroceries(input: ReorderGroceriesInput): Promise<ReorderGroceriesOutput> {
    return this.#call("ReorderGroceries", input);
  }

  async #call<N extends OperationName>(
    name: N,
    input: OperationInput<N>,
  ): Promise<OperationOutput<N>> {
    const credentials = await this.#getCredentials();
    const signer = new AwsClient({
      ...credentials,
      service: "execute-api",
      region: this.#region,
    });

    const res = await signer.fetch(`${this.#baseUrl}/${name}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const error = (body ?? {}) as Partial<ErrorOutput>;
      throw new RolodexApiError(
        res.status,
        error.code ?? "UnknownError",
        error.message ?? `${name} failed (${res.status})`,
      );
    }
    return body as OperationOutput<N>;
  }
}
