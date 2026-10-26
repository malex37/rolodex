# ROLODEX!

The application we'll use at home to create, manage and keep track of cooking recipes we like making

# Functionality

- _Recipes:_
  - Can create recipes and show ingredients with quantities
  - Each recipe has it's 'Cooking' steps section with listed steps to make it
  - "Add to groceries" option automatically adds ingredients to shopping list
  - Tags in each recipe for easy searching
  - "Category" main attribute on how the recipes are grouped by
- _Shopping list_:
  - A list where stuff to be bought can be added individually as needed
  - Can be populated directly from a recipe

# Repository layout

npm workspaces monorepo:

| Package | What it is |
| --- | --- |
| `packages/rolodex-ui` | React + Vite + Tailwind web app (react-router), served at https://rolodex.iammalex.com |
| `packages/rolodex-api` | Lambda handlers (`src/handlers/*.ts`) backed by DynamoDB |
| `packages/rolodex-models` | Shared types and input validation used by the API and the UI |
| `packages/rolodex-client` | `RolodexClient` (SigV4-signed API calls) and `CognitoAuth` (sign-in, no auth library) |
| `packages/rolodex-cdk` | Infrastructure: S3 + CloudFront site, HTTP API at https://api.rolodex.iammalex.com with IAM auth, Cognito user pool (`lib/userRegistry.ts`), DynamoDB |

Everything deployed is pay-per-use; there are no hourly or provisioned resources.

# Development

```sh
npm install
npm run typecheck
npm run lint
npm run rolo -- sync-dev   # writes packages/rolodex-ui/.env.local from the deployed stack
npm run dev        # UI on http://localhost:5173, against the deployed API and user pool
```

# Deploying

```sh
npx -w @rolodex/cdk cdk bootstrap aws://ACCOUNT/us-east-1 aws://ACCOUNT/REGION   # once per account/region
npm run deploy     # builds the UI, deploys both stacks
```

There is no self sign-up. Create users with:

```sh
npm run rolo -- users create --email you@example.com
```

They get a temporary password by email and choose a new one on first sign-in.
