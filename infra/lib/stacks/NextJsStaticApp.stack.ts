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


}