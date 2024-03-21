import {Construct} from "constructs";
import {BlockPublicAccess, Bucket} from "aws-cdk-lib/aws-s3";
import {Duration, RemovalPolicy, SecretValue} from "aws-cdk-lib";
import {AllowedMethods, Distribution, SecurityPolicyProtocol, ViewerProtocolPolicy} from "aws-cdk-lib/aws-cloudfront";
import {S3Origin} from "aws-cdk-lib/aws-cloudfront-origins";
import {Artifact, Pipeline} from "aws-cdk-lib/aws-codepipeline";
import {CodeBuildAction, GitHubSourceAction, GitHubTrigger} from "aws-cdk-lib/aws-codepipeline-actions";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as codebuild from "aws-cdk-lib/aws-codebuild";

interface IS3BucketConfig{
    bucketId:string,
    bucketName:string,
}
interface ICloudFrontDistribution{
    cloudFrontId:string,
}
export interface IS3CloudFrontStaticWebHostingConstructProps{
    s3BucketConfig:IS3BucketConfig,
    cloudFrontDistribution:ICloudFrontDistribution
}

export class S3CloudFrontStaticWebHostingConstruct extends Construct{
    constructor(scope: Construct, id: string,_props:IS3CloudFrontStaticWebHostingConstructProps) {
        super(scope, id);


        const bucket = this.createS3Bucket(_props.s3BucketConfig);
        const cloudFrontDistribution :Distribution= this.createCloudFrontDistribution(_props.cloudFrontDistribution,bucket);

        const pipeline  = this.buildingS3BucketPipeline();

    }
    private createS3Bucket(_props:IS3BucketConfig){
        const bucket : Bucket = new Bucket(this, _props.bucketId, {
            bucketName:  _props.bucketName,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            publicReadAccess: false,
            removalPolicy: RemovalPolicy.DESTROY,
        });

        return bucket;
    }
    private createCloudFrontDistribution(_props:ICloudFrontDistribution,s3Bucket:Bucket){
        const distribution = new Distribution(this, _props.cloudFrontId, {
            defaultBehavior: {
                allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                compress: true,
                origin: new S3Origin(s3Bucket),
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
            defaultRootObject: "index.html",
            errorResponses: [
                {
                    httpStatus: 403,
                    responseHttpStatus: 403,
                    responsePagePath: "/error.html",
                    ttl: Duration.minutes(30),
                },
            ],
            minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2019,
        });

        return distribution;
    }

    private buildingS3BucketPipeline(){

        const outputSources : Artifact = new Artifact();
        const outputWebsite :Artifact= new Artifact();

        const pipeline : Pipeline = new Pipeline(this, 'MyFirstPipeline', {
            pipelineName: 'MyPipeline',
        });

        const sourceAction : GitHubSourceAction =   new GitHubSourceAction({
            actionName: 'GitHub_Source',
            owner: 'dkmostafa',
            repo: 'dev-samples',
            oauthToken: SecretValue.secretsManager("GitHubToken"),
            output: outputSources,
            branch: 'next-js-static-branch', // default: 'master'
            trigger:GitHubTrigger.WEBHOOK
        })

        const buildAction : CodeBuildAction =  new codepipeline_actions.CodeBuildAction({
                actionName: "Website",
                project: new codebuild.PipelineProject(this, "BuildWebsite", {
                    projectName: "Website",
                    buildSpec: codebuild.BuildSpec.fromSourceFilename("./nextjs-static-webapp-sample/buildspec.yml"),
                    environment:{
                        buildImage:codebuild.LinuxBuildImage.STANDARD_7_0
                    }
                }),
                input: outputSources,
                outputs: [outputWebsite],
            });

        pipeline.addStage({
            stageName:"Source",
            actions:[sourceAction]
        });

        pipeline.addStage({
            stageName: "Build",
            actions: [buildAction],
        });

        return pipeline;

    }




}