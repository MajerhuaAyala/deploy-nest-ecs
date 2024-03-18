#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {NextJsStaticAppStack} from "../lib/stacks/NextJsStaticApp.stack";

const app = new cdk.App();

const accountEnvironment = {
    account:process.env.AWS_ACCOUNT,
    region:process.env.AWS_REGION,
}

new NextJsStaticAppStack(app,"NextJsStaticAppStack", {
    env:accountEnvironment
});

