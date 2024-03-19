import {SecretValue, Stack, StackProps} from "aws-cdk-lib";
import {Construct} from "constructs";
import {
    IS3CloudFrontStaticWebHostingConstructProps,
    S3CloudFrontStaticWebHostingConstruct
} from "../constructs/s3CloudFrontStaticWebHosting.construct";
import {Pipeline} from "aws-cdk-lib/aws-codepipeline";

import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';


export class NextJsStaticAppStack extends Stack{
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const staticS3BucketDistBucket:IS3CloudFrontStaticWebHostingConstructProps = {
            s3BucketConfig:{
                bucketId:"nextjs-static-files",
                bucketName:"nextjs-static-files-sample-123456"
            },
            cloudFrontDistribution:{
                cloudFrontId:"nextjs-static-website"
            }
        }

        this.createS3BucketWithCloudFrontDistribution(staticS3BucketDistBucket);

    }


    private createS3BucketWithCloudFrontDistribution(_props:IS3CloudFrontStaticWebHostingConstructProps) {

        const s3BucketWithCFD :S3CloudFrontStaticWebHostingConstruct = new S3CloudFrontStaticWebHostingConstruct(this,"S3CloudFrontStaticWebHostingConstruct",_props);
        return s3BucketWithCFD;
    }

    private createCodePipeline(){

        const outputSources = new codepipeline.Artifact();
        const outputWebsite = new codepipeline.Artifact();

        const pipeline : Pipeline = new Pipeline(this, 'MyFirstPipeline', {
            pipelineName: 'MyPipeline',
        });



        pipeline.addStage({
            stageName:"Source",
            actions:[
                new codepipeline_actions.GitHubSourceAction({
                    actionName: 'GitHub_Source',
                    owner: 'awslabs',
                    repo: 'aws-cdk',
                    //@ts-ignore
                    oauthToken: "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",
                    output: outputSources,
                    branch: 'develop', // default: 'master'
                    trigger:codepipeline_actions.GitHubTrigger.WEBHOOK
                })
            ]
        })

        pipeline.addStage({
            stageName: "Build",
            actions: [
                // AWS CodePipeline action to run CodeBuild project
                new codepipeline_actions.CodeBuildAction({
                    actionName: "Website",
                    project: new codebuild.PipelineProject(this, "BuildWebsite", {
                        projectName: "Website",
                        buildSpec: codebuild.BuildSpec.fromSourceFilename(
                            "./infra/buildspec.yml"
                        ),
                    }),
                    input: outputSources,
                    outputs: [outputWebsite],
                }),
            ],
        });


        //pipeline.addStage({
        //   stageName: "Source",
        //   actions: [
        //     new CodePipelineAction.GitHubSourceAction({
        //       actionName: "Checkout",
        //       owner: props.github.owner,
        //       repo: props.github.repository,
        //       oauthToken: CDK.SecretValue.secretsManager("GitHubToken"),
        //       output: outputSources,
        //       trigger: CodePipelineAction.GitHubTrigger.WEBHOOK,
        //     }),
        //   ],
        // });


    }


}