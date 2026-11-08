import { App, Tags } from "aws-cdk-lib";
import { ACCOUNT, REGION } from "../lib/config";
import { PerkyStack } from "../lib/perky-stack";

const app = new App();
new PerkyStack(app, "PerkyStack", {
  env: { account: ACCOUNT, region: REGION },
  description: "Perky 로그인·답 저장 (서울)",
});
Tags.of(app).add("project", "perky");
