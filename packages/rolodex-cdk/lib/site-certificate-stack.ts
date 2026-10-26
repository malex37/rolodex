import { Stack, type StackProps } from "aws-cdk-lib";
import { Certificate, CertificateValidation, type ICertificate } from "aws-cdk-lib/aws-certificatemanager";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import type { Construct } from "constructs";
import { HOSTED_ZONE, SITE_DOMAIN } from "./domains.ts";

// CloudFront only accepts ACM certificates from us-east-1, so the site
// certificate lives in its own stack pinned to that region.
export class SiteCertificateStack extends Stack {
  readonly certificate: ICertificate;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const zone = HostedZone.fromLookup(this, "Zone", { domainName: HOSTED_ZONE });

    this.certificate = new Certificate(this, "SiteCertificate", {
      domainName: SITE_DOMAIN,
      validation: CertificateValidation.fromDns(zone),
    });
  }
}
