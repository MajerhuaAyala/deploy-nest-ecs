import {SecretValue, Stack, StackProps} from "aws-cdk-lib";
import {Repository} from "aws-cdk-lib/aws-ecr"
import {Effect, PolicyStatement, Role, ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {
    FargateTaskDefinition,
    ContainerImage,
    AwsLogDriver,
    Protocol,
    Cluster, CpuArchitecture, OperatingSystemFamily,
} from "aws-cdk-lib/aws-ecs"
import {Vpc} from "aws-cdk-lib/aws-ec2";
import {ApplicationLoadBalancedFargateService} from "aws-cdk-lib/aws-ecs-patterns";
import {Construct} from "constructs";
import {Artifact, Pipeline} from "aws-cdk-lib/aws-codepipeline";
import {CodeBuildAction, GitHubSourceAction, GitHubTrigger} from "aws-cdk-lib/aws-codepipeline-actions";
import {BuildSpec, LinuxBuildImage, PipelineProject} from "aws-cdk-lib/aws-codebuild";
import {EcsApplicationConstruct, IEcsApplicationConstruct} from "../constructs/ecsApplication.construct";

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

        // const repository:Repository = this.createEcrImage();
        //
        // repository.repositoryName;
        //
        // this.createEcs();
        //
        //
        //
        // const pipeLineConfig : IPipelineConfig = {
        //     pipelineId:"nestJsBuildingApp",
        //     pipelineName:"nestJsBuildingApp",
        //     githubConfig:{
        //         owner:"dkmostafa",
        //         repo:"dev-samples",
        //         oAuthSecretManagerName:"GitHubTokend",
        //         branch:"nestjs-application"
        //     },
        //     buildSpecLocation:"./nestjs-app/buildspec.yml"
        // }
        //
        // this.createBuildPipeline(pipeLineConfig);
    }


    createEcs(){
        const executionRole:Role = new Role(this, "fargate-test-task-role", {
            assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com"),
            roleName:"taskDefinitionExecutionRole"
        });


        executionRole.addToPolicy(new PolicyStatement({
            resources:["*"],
            actions: [
                "ecr:GetAuthorizationToken",
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            effect: Effect.ALLOW
        }));

        const taskDefinition : FargateTaskDefinition = new FargateTaskDefinition(
            this,
            "fargate-task-definition",
            {
                executionRole:executionRole,
                runtimePlatform:{
                    cpuArchitecture:CpuArchitecture.X86_64,
                    operatingSystemFamily:OperatingSystemFamily.LINUX
                },
            },
        );

        const container = taskDefinition.addContainer(
            "fargate-test-task-container",
            {
                image: ContainerImage.fromRegistry("227778490402.dkr.ecr.eu-west-1.amazonaws.com/nestjs-backend-app-ecr-227778490402:latest"),
                containerName:"testContainer",
                essential:true,
                portMappings:[
                    {
                        containerPort:8080,
                        protocol:Protocol.TCP
                    },
                ],
                logging:new AwsLogDriver({
                    streamPrefix: "ecs-logs"
                })
                // healthCheck:""
            }
        );

        const vpc = new Vpc(this, "fargate-test-task-vpc", {
        });

        const cluster = new Cluster(this, "fargate-test-task-cluster", { vpc });

       const applicationLoadBalancer =  new ApplicationLoadBalancedFargateService(
            this,
            "MyFargateService",
            {
                cluster: cluster, // Required
                cpu: 256, // Default is 256
                desiredCount: 1, // Default is 1
                taskDefinition: taskDefinition,
                memoryLimitMiB: 512, // Default is 512
                publicLoadBalancer: true, // Default is false
                loadBalancerName:"nestJsAppLoadBalancer",
            },
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
        });

        const buildProject= new PipelineProject(this, "BuildWebsite", {
            projectName: "BuildWebsite",
            buildSpec: BuildSpec.fromSourceFilename(_props.buildSpecLocation),
            environment: {
                buildImage: LinuxBuildImage.STANDARD_7_0
            }
        });

        buildProject.addToRolePolicy(new PolicyStatement({
            resources:["*"],
            actions: ['ecr:*'],
            effect: Effect.ALLOW
        }))

        const buildAction: CodeBuildAction = new CodeBuildAction({
            actionName: "BuildWebsite",
            project:buildProject ,
            input: outputSources,
            outputs: [outputWebsite],
        });

        //add manual approval for the pipelieline here

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

        return pipeline;

    }

    createEcrImage():Repository{
        const repository = new Repository(this, 'NestJsBackendApp', {
            imageScanOnPush: true,
            repositoryName:`nestjs-backend-app-ecr-${this.account}`
        });
        return repository;
    }
}