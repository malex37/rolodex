import {
  CloudFormationClient,
  DescribeStacksCommand,
} from "@aws-sdk/client-cloudformation";

// Name of the main stack in packages/rolodex-cdk/bin/rolodex.ts. Like the CDK
// app, the region comes from the AWS config (AWS_REGION or the profile).
const STACK_NAME = "Rolodex";

/** Reads a CfnOutput (by its id, e.g. "UserPoolId") from the deployed stack. */
export async function getStackOutput(key: string): Promise<string> {
  const client = new CloudFormationClient({});
  const { Stacks } = await client.send(
    new DescribeStacksCommand({ StackName: STACK_NAME }),
  );
  const value = Stacks?.[0]?.Outputs?.find((o) => o.OutputKey === key)
    ?.OutputValue;
  if (!value) {
    throw new Error(`Stack ${STACK_NAME} has no output ${key}`);
  }
  return value;
}
