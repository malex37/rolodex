import {
  CloudFormationClient,
  DescribeStacksCommand,
} from "@aws-sdk/client-cloudformation";

// Name of the main stack in packages/rolodex-cdk/bin/rolodex.ts. Like the CDK
// app, the region comes from the AWS config (AWS_REGION or the profile).
const STACK_NAME = "Rolodex";

/** All CfnOutputs of the deployed stack, by output id (e.g. "UserPoolId"). */
export async function getStackOutputs(): Promise<Record<string, string>> {
  const client = new CloudFormationClient({});
  const { Stacks } = await client.send(
    new DescribeStacksCommand({ StackName: STACK_NAME }),
  );
  return Object.fromEntries(
    (Stacks?.[0]?.Outputs ?? []).flatMap((o) =>
      o.OutputKey && o.OutputValue ? [[o.OutputKey, o.OutputValue]] : [],
    ),
  );
}

/** Reads a CfnOutput (by its id, e.g. "UserPoolId") from the deployed stack. */
export async function getStackOutput(key: string): Promise<string> {
  const value = (await getStackOutputs())[key];
  if (!value) {
    throw new Error(`Stack ${STACK_NAME} has no output ${key}`);
  }
  return value;
}
