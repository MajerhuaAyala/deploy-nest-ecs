import {SecretValue, Stack, StackProps} from "aws-cdk-lib";
import {Repository} from "aws-cdk-lib/aws-ecr"
import {Role,ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {FargateTaskDefinition,ContainerImage,AwsLogDriver,Protocol,Cluster} from "aws-cdk-lib/aws-ecs"
import {Vpc} from "aws-cdk-lib/aws-ec2";
import {ApplicationLoadBalancedFargateService} from "aws-cdk-lib/aws-ecs-patterns";
import {Construct} from "constructs";
import {Artifact, Pipeline} from "aws-cdk-lib/aws-codepipeline";
import {CodeBuildAction, GitHubSourceAction, GitHubTrigger} from "aws-cdk-lib/aws-codepipeline-actions";
import {BuildSpec, LinuxBuildImage, PipelineProject} from "aws-cdk-lib/aws-codebuild";

interface IPipelineConfig{
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
export class NestJsAppStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const ecrRepo = this.createEcrImage();


        const pipeLineConfig : IPipelineConfig = {
            pipelineId:"nestJsBuildingApp",
            pipelineName:"nestJsBuildingApp",
            githubConfig:{
                owner:"dkmostafa",
                repo:"dev-samples",
                oAuthSecretManagerName:"GitHubToken",
                branch:"nestjs-application"
            },
            buildSpecLocation:"buildspec.yml"

        }

        this.createBuildPipeline(pipeLineConfig);
        // this.createEcs();
    }


    createEcs(){
        const taskRole = new Role(this, "fargate-test-task-role", {
            assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com")
        });
        //first create a task role
        //then create a task definition
        //then create a container
        //add logs to the cloudwatch
        //add a health check to the load balancer

        const taskDefinition = new FargateTaskDefinition(
            this,
            "fargate-task-definition",
            {
                taskRole: taskRole,
                executionRole: taskRole
            }
        );

        const container = taskDefinition.addContainer(
            "fargate-test-task-container",
            {
                image: ContainerImage.fromRegistry(
                    "227778490402.dkr.ecr.eu-west-1.amazonaws.com/nestjsappstack-nestjsbackendappc7dcee4e-q3c8i6tomtcn:latest"
                ),
                // logging: new AwsLogDriver({
                //     streamPrefix: "fargate-test-task-log-prefix"
                // }),
                portMappings:[
                    {
                        containerPort:8080,
                        protocol:Protocol.TCP
                    },

                ]
                // healthCheck:""
            }
        );

        const vpc = new Vpc(this, "fargate-test-task-vpc", {
            maxAzs: 2,
            natGateways: 1
        });


        container.addPortMappings({
            containerPort: 8080,
            hostPort: 8080,
            protocol: Protocol.TCP,
        });

        const cluster = new Cluster(this, "fargate-test-task-cluster", { vpc });

        new ApplicationLoadBalancedFargateService(
            this,
            "MyFargateService",
            {
                cluster: cluster, // Required
                cpu: 256, // Default is 256
                desiredCount: 1, // Default is 1
                taskDefinition: taskDefinition,
                memoryLimitMiB: 512, // Default is 512
                publicLoadBalancer: true // Default is false
            }
        );




    }

    createBuildPipeline(_props:IPipelineConfig)
    {
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
                // {
                //     stageName:"S3Deploy",
                //     actions:[deploymentAction,invalidateCloudFrontAction],
                // }
            ]
        });



    }

    createEcrImage(){
        const repository = new Repository(this, 'NestJsBackendApp', {
            imageScanOnPush: true,
            repositoryName:`NestJsBackendAppRepo-${this.account}`
        });

        return repository
    }
}