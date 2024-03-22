import {Construct} from "constructs";
import {BlockPublicAccess, Bucket} from "aws-cdk-lib/aws-s3";
import {Duration, RemovalPolicy, SecretValue} from "aws-cdk-lib";
import {AllowedMethods, Distribution, SecurityPolicyProtocol, ViewerProtocolPolicy} from "aws-cdk-lib/aws-cloudfront";
import {S3Origin} from "aws-cdk-lib/aws-cloudfront-origins";
import {Artifact, Pipeline} from "aws-cdk-lib/aws-codepipeline";
import {CodeBuildAction, GitHubSourceAction, GitHubTrigger, S3DeployAction} from "aws-cdk-lib/aws-codepipeline-actions";
import {PolicyStatement} from "aws-cdk-lib/aws-iam";
import {BuildSpec, LinuxBuildImage, PipelineProject} from "aws-cdk-lib/aws-codebuild";

interface IS3BucketConfig{
    bucketId:string,
    bucketName:string,
}
interface ICloudFrontDistribution{
    cloudFrontId:string,
}
interface IPipelineConfig{
    account:string,
    pipelineName:string,
    pipelineId:string,
    githubConfig:{
        owner:string,
        repo:string,
        oAuthSecretManagerName:string,
        branch:string
    },
    buildSpecLocation:string,
}

export interface IS3CloudFrontStaticWebHostingConstructProps{
    s3BucketConfig:IS3BucketConfig,
    cloudFrontDistribution:ICloudFrontDistribution,
    pipeLineConfig:IPipelineConfig
}

export class S3CloudFrontStaticWebHostingConstruct extends Construct{
    constructor(scope: Construct, id: string,_props:IS3CloudFrontStaticWebHostingConstructProps){
        super(scope, id);

        const bucket:Bucket = this.createS3Bucket(_props.s3BucketConfig);
        const cloudFrontDistribution :Distribution= this.createCloudFrontDistribution(_props.cloudFrontDistribution,bucket);
        const pipeline:Pipeline  = this.buildingS3BucketPipeline(_props.pipeLineConfig,bucket,cloudFrontDistribution);

    }
    private createS3Bucket(_props:IS3BucketConfig):Bucket{
        const bucket : Bucket = new Bucket(this, _props.bucketId, {
            bucketName:  _props.bucketName,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            publicReadAccess: false,
            removalPolicy: RemovalPolicy.DESTROY,
        });

        return bucket;
    }
    private createCloudFrontDistribution(_props:ICloudFrontDistribution,s3Bucket:Bucket):Distribution{
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
    private buildingS3BucketPipeline(_props:IPipelineConfig,webSiteS3Bucket:Bucket,cloudFrontDistribution:Distribution):Pipeline {

        const outputSources: Artifact = new Artifact();
        const outputWebsite: Artifact = new Artifact();

        const sourceAction: GitHubSourceAction = new GitHubSourceAction({
            actionName: 'GitHub_Source',
            owner: _props.githubConfig.owner,
            repo: _props.githubConfig.repo,
            oauthToken: SecretValue.secretsManager(_props.githubConfig.oAuthSecretManagerName),
            output: outputSources,
            branch: _props.githubConfig.branch,
            trigger: GitHubTrigger.WEBHOOK
        })
        const buildAction: CodeBuildAction = new CodeBuildAction({
            actionName: "BuildWebsite",
            project: new PipelineProject(this, "BuildWebsite", {
                projectName: "BuildWebsite",
                buildSpec: BuildSpec.fromSourceFilename(_props.buildSpecLocation),
                environment: {
                    buildImage: LinuxBuildImage.STANDARD_7_0
                }
            }),
            input: outputSources,
            outputs: [outputWebsite],
        });
        const deploymentAction : S3DeployAction =new S3DeployAction({
            actionName:"S3WebDeploy",
            input: outputWebsite,
            bucket: webSiteS3Bucket,
            runOrder:1,
        });
        const invalidateBuildProject = new PipelineProject(this, `InvalidateProject`, {
            buildSpec: BuildSpec.fromObject({
                version: '0.2',
                phases: {
                    build: {
                        commands:[
                            'aws cloudfront create-invalidation --distribution-id ${CLOUDFRONT_ID} --paths "/*"',
                        ],
                    },
                },
            }),
            environmentVariables: {
                CLOUDFRONT_ID: { value: cloudFrontDistribution.distributionId },
            },
        });
        const distributionArn = `arn:aws:cloudfront::${_props.account}:distribution/${cloudFrontDistribution.distributionId}`;
        invalidateBuildProject.addToRolePolicy(new PolicyStatement({
            resources: [distributionArn],
            actions: [
                'cloudfront:CreateInvalidation',
            ],
        }));
        const invalidateCloudFrontAction: CodeBuildAction = new CodeBuildAction({
            actionName: 'InvalidateCache',
            project: invalidateBuildProject,
            input: outputWebsite,
            runOrder: 2,
        });

        const pipeline: Pipeline = new Pipeline(this,_props.pipelineId , {
            pipelineName: _props.pipelineName,
            stages:[
                {
                    stageName:"Source",
                    actions:[sourceAction],
                },
                {
                    stageName:"Build",
                    actions:[buildAction],
                },
                {
                    stageName:"S3Deploy",
                    actions:[deploymentAction,invalidateCloudFrontAction],
                }
            ]
        });

        return pipeline;

    }




}