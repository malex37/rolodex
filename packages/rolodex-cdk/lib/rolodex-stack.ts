import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import { CorsHttpMethod, DomainName, HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpIamAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import {
  Certificate,
  CertificateValidation,
  type ICertificate,
} from "aws-cdk-lib/aws-certificatemanager";
import {
  Distribution,
  FunctionCode,
  FunctionEventType,
  FunctionRuntime,
  Function as CloudFrontFunction,
  PriceClass,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { AaaaRecord, ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { ApiGatewayv2DomainProperties, CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import type { OperationName } from "@rolodex/models";
import type { Construct } from "constructs";
import { API_DOMAIN, HOSTED_ZONE, SITE_DOMAIN } from "./domains.ts";
import { UserRegistry } from "./userRegistry.ts";

const packagesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const handlersDir = join(packagesDir, "rolodex-api", "src", "handlers");
const uiDistDir = join(packagesDir, "rolodex-ui", "dist");

const SITE_URL = `https://${SITE_DOMAIN}`;
const API_URL = `https://${API_DOMAIN}`;
// Vite dev server, allowed to call the deployed API during local development.
const DEV_ORIGIN = "http://localhost:5173";

// Every operation is `POST /{OperationName}`, handled by the export of the same
// name in packages/rolodex-api/src/handlers/{file}.ts. `users` operations look
// users up in the user pool (to share lists by email).
const operations: {
  [N in OperationName]: {
    file: "recipes" | "groceries" | "feed";
    write: boolean;
    users?: boolean;
  };
} = {
  ListRecipes: { file: "recipes", write: false },
  GetRecipe: { file: "recipes", write: false },
  CreateRecipe: { file: "recipes", write: true },
  DeleteRecipe: { file: "recipes", write: true },
  FeedRecipe: { file: "feed", write: false },
  ListGroceryLists: { file: "groceries", write: false },
  CreateGroceryList: { file: "groceries", write: true, users: true },
  DeleteGroceryList: { file: "groceries", write: true },
  ShareGroceryList: { file: "groceries", write: true, users: true },
  UnshareGroceryList: { file: "groceries", write: true },
  ListGroceries: { file: "groceries", write: false },
  AddGroceries: { file: "groceries", write: true },
  UpdateGrocery: { file: "groceries", write: true },
  DeleteGrocery: { file: "groceries", write: true },
};

export interface RolodexStackProps extends StackProps {
  /** us-east-1 certificate for SITE_DOMAIN (see SiteCertificateStack). */
  siteCertificate: ICertificate;
}

// Everything here is pay-per-use: no hourly or provisioned resources.
export class RolodexStack extends Stack {
  constructor(scope: Construct, id: string, props: RolodexStackProps) {
    super(scope, id, props);

    const zone = HostedZone.fromLookup(this, "Zone", { domainName: HOSTED_ZONE });
    const users = new UserRegistry(this, "UserRegistry");

    // Data: single on-demand table, pk = entity type, sk = item id.
    const table = new Table(this, "Table", {
      partitionKey: { name: "pk", type: AttributeType.STRING },
      sortKey: { name: "sk", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Web: the static build lives in a private S3 bucket. CloudFront in front of
    // it provides HTTPS on the custom domain, which S3 website hosting can't,
    // and which the browser needs for crypto.subtle (SigV4 signing).
    const siteBucket = new Bucket(this, "SiteBucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Client-side routing (react-router): any path without a file extension
    // gets index.html.
    const spaRewrite = new CloudFrontFunction(this, "SpaRewrite", {
      runtime: FunctionRuntime.JS_2_0,
      code: FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  if (!request.uri.includes(".")) request.uri = "/index.html";
  return request;
}`),
    });

    const distribution = new Distribution(this, "Distribution", {
      domainNames: [SITE_DOMAIN],
      certificate: props.siteCertificate,
      priceClass: PriceClass.PRICE_CLASS_100,
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [
          { function: spaRewrite, eventType: FunctionEventType.VIEWER_REQUEST },
        ],
      },
    });

    const siteTarget = RecordTarget.fromAlias(new CloudFrontTarget(distribution));
    new ARecord(this, "SiteRecord", { zone, recordName: SITE_DOMAIN, target: siteTarget });
    new AaaaRecord(this, "SiteRecordIpv6", { zone, recordName: SITE_DOMAIN, target: siteTarget });

    // API: every route requires a SigV4-signed request (IAM auth). The UI signs
    // with the identity pool credentials it gets after signing in.
    const apiDomain = new DomainName(this, "ApiDomain", {
      domainName: API_DOMAIN,
      certificate: new Certificate(this, "ApiCertificate", {
        domainName: API_DOMAIN,
        validation: CertificateValidation.fromDns(zone),
      }),
    });

    const api = new HttpApi(this, "Api", {
      defaultAuthorizer: new HttpIamAuthorizer(),
      defaultDomainMapping: { domainName: apiDomain },
      // Only reachable through api.rolodex.iammalex.com.
      disableExecuteApiEndpoint: true,
      corsPreflight: {
        allowOrigins: [SITE_URL, DEV_ORIGIN],
        allowMethods: [CorsHttpMethod.POST],
        allowHeaders: [
          "content-type",
          "authorization",
          "x-amz-date",
          "x-amz-security-token",
          "x-amz-content-sha256",
        ],
        maxAge: Duration.hours(1),
      },
    });

    new ARecord(this, "ApiRecord", {
      zone,
      recordName: API_DOMAIN,
      target: RecordTarget.fromAlias(
        new ApiGatewayv2DomainProperties(
          apiDomain.regionalDomainName,
          apiDomain.regionalHostedZoneId,
        ),
      ),
    });

    users.authenticatedRole.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ["execute-api:Invoke"],
        resources: [api.arnForExecuteApi()],
      }),
    );

    for (const [name, { file, write, users: lookupUsers }] of Object.entries(operations)) {
      const fn = new NodejsFunction(this, `Fn-${name}`, {
        entry: join(handlersDir, `${file}.ts`),
        handler: name,
        runtime: Runtime.NODEJS_24_X,
        architecture: Architecture.ARM_64,
        memorySize: 256,
        timeout: Duration.seconds(10),
        logGroup: new LogGroup(this, `Logs-${name}`, {
          retention: RetentionDays.ONE_WEEK,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        environment: {
          TABLE_NAME: table.tableName,
          ...(lookupUsers && { USER_POOL_ID: users.userPool.userPoolId }),
        },
        bundling: {
          format: OutputFormat.ESM,
          minify: true,
          sourceMap: true,
          // The AWS SDK v3 ships with the Node.js Lambda runtime.
          externalModules: ["@aws-sdk/*"],
        },
      });

      if (write) table.grantReadWriteData(fn);
      else table.grantReadData(fn);
      if (lookupUsers) users.userPool.grant(fn, "cognito-idp:ListUsers");

      api.addRoutes({
        path: `/${name}`,
        methods: [HttpMethod.POST],
        integration: new HttpLambdaIntegration(`Integration-${name}`, fn),
      });
    }

    // Runtime config the UI loads from /config.json (see packages/rolodex-ui/src/config.js).
    const uiConfig = {
      region: this.region,
      apiUrl: API_URL,
      userPoolId: users.userPool.userPoolId,
      userPoolClientId: users.userPoolClient.userPoolClientId,
      identityPoolId: users.identityPool.identityPoolId,
    };

    new BucketDeployment(this, "DeploySite", {
      sources: [Source.asset(uiDistDir), Source.jsonData("config.json", uiConfig)],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ["/*"],
    });

    new CfnOutput(this, "SiteUrl", { value: SITE_URL });
    new CfnOutput(this, "ApiUrl", { value: API_URL });
    new CfnOutput(this, "Region", { value: this.region });
    new CfnOutput(this, "UserPoolId", { value: uiConfig.userPoolId });
    new CfnOutput(this, "UserPoolClientId", { value: uiConfig.userPoolClientId });
    new CfnOutput(this, "IdentityPoolId", { value: uiConfig.identityPoolId });
    new CfnOutput(this, "TableName", { value: table.tableName });
  }
}
