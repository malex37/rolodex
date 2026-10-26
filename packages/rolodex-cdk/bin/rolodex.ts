import { App } from "aws-cdk-lib";
import { RolodexStack } from "../lib/rolodex-stack.ts";
import { SiteCertificateStack } from "../lib/site-certificate-stack.ts";

const app = new App();

const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION;

const certificates = new SiteCertificateStack(app, "RolodexSiteCertificate", {
  env: { account, region: "us-east-1" },
  crossRegionReferences: true,
});

new RolodexStack(app, "Rolodex", {
  env: { account, region },
  crossRegionReferences: true,
  siteCertificate: certificates.certificate,
});
