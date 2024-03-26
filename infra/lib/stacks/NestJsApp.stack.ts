import {Stack, StackProps} from "aws-cdk-lib";

import {Repository} from "aws-cdk-lib/aws-ecr"
import {Role,ServicePrincipal} from "aws-cdk-lib/aws-iam";

import {FargateTaskDefinition,ContainerImage,AwsLogDriver,Protocol,Cluster} from "aws-cdk-lib/aws-ecs"
import {Vpc} from "aws-cdk-lib/aws-ec2";
import {ApplicationLoadBalancedFargateService} from "aws-cdk-lib/aws-ecs-patterns";
import {Construct} from "constructs";
export class NestJsAppStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);
        this.createEcrImage();
        this.createEcs();
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

    createEcrImage(){
        const repository = new Repository(this, 'NestJsBackendApp', {
            imageScanOnPush: true,
        });

        return repository
    }
}