import { Stack, StackProps} from "aws-cdk-lib";

import {Construct} from "constructs";
import {EcsApplicationConstruct, IEcsApplicationConstruct} from "../constructs/ecsApplication.construct";
export class NestJsAppStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const ecsApplicationConstructProps :IEcsApplicationConstruct ={
            account:this.account,
            region:this.region,
            ecrConfig:{
                name:"nestjs-app-sample",
                id:"nestjs-app-sample",
            },
            ecsConfig:{
                clusterName:"SampleCluster",
                executionRole:{
                    name:"fargate-test-task-execution-role",
                    id:"fargate-test-task-execution-role"
                },
                taskDefinitionId:"sample-task-id",
                containerConfig:{
                    id:"sample-task-container",
                    name:"sample-task-container"
                },
            },
            pipelineConfig:{
                    pipelineId:"nestJsBuildingApp",
                    pipelineName:"nestJsBuildingApp",
                    githubConfig:{
                        owner:"dkmostafa",
                        repo:"dev-samples",
                        oAuthSecretManagerName:"GitHubTokend",
                        branch:"nestjs-application"
                    },
                    buildSpecLocation:"./nestjs-app/buildspec.yml"
                }
            }

        const ecsApplicationConstruct: EcsApplicationConstruct = new EcsApplicationConstruct(this,"ecsApplicationConstruct",ecsApplicationConstructProps)

    }
}