import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface StorageStackProps extends cdk.StackProps {
  stage: string;
}

export class StorageStack extends cdk.Stack {
  public readonly storageBucket: s3.Bucket;
  public readonly invoicesBucket: s3.Bucket;
  public readonly exportsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const { stage } = props;

    // Main storage bucket for general file uploads (profile pictures, documents)
    this.storageBucket = new s3.Bucket(this, 'StorageBucket', {
      bucketName: `aerotage-time-storage-${stage}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: stage === 'prod',
      lifecycleRules: [
        {
          id: 'delete-old-versions',
          enabled: true,
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
        {
          id: 'delete-incomplete-uploads',
          enabled: true,
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
      ],
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
          ],
          allowedOrigins: ['*'], // Configure this to match your frontend domain in production
          exposedHeaders: ['ETag'],
          maxAge: 3000,
        },
      ],
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Invoices bucket for storing generated invoice PDFs
    this.invoicesBucket = new s3.Bucket(this, 'InvoicesBucket', {
      bucketName: `aerotage-time-invoices-${stage}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: stage === 'prod',
      lifecycleRules: [
        {
          id: 'transition-to-ia',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Exports bucket for storing report exports (CSV, Excel, PDF)
    this.exportsBucket = new s3.Bucket(this, 'ExportsBucket', {
      bucketName: `aerotage-time-exports-${stage}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'delete-old-exports',
          enabled: true,
          expiration: cdk.Duration.days(7), // Auto-delete exports after 7 days
        },
      ],
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // IAM policy for Lambda functions to access buckets
    const bucketAccessPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject',
            's3:GetObjectVersion',
            's3:PutObjectAcl',
          ],
          resources: [
            this.storageBucket.arnForObjects('*'),
            this.invoicesBucket.arnForObjects('*'),
            this.exportsBucket.arnForObjects('*'),
          ],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:ListBucket',
            's3:GetBucketLocation',
            's3:GetBucketVersioning',
          ],
          resources: [
            this.storageBucket.bucketArn,
            this.invoicesBucket.bucketArn,
            this.exportsBucket.bucketArn,
          ],
        }),
      ],
    });

    // Create managed policy for Lambda functions
    const lambdaBucketAccessPolicy = new iam.ManagedPolicy(this, 'LambdaBucketAccessPolicy', {
      managedPolicyName: `aerotage-lambda-bucket-access-${stage}`,
      description: 'Policy for Lambda functions to access S3 buckets',
      document: bucketAccessPolicy,
    });

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'StorageBucketName', {
      value: this.storageBucket.bucketName,
      description: 'Main storage S3 bucket name',
      exportName: `StorageBucketName-${stage}`,
    });

    new cdk.CfnOutput(this, 'StorageBucketArn', {
      value: this.storageBucket.bucketArn,
      description: 'Main storage S3 bucket ARN',
      exportName: `StorageBucketArn-${stage}`,
    });

    new cdk.CfnOutput(this, 'InvoicesBucketName', {
      value: this.invoicesBucket.bucketName,
      description: 'Invoices S3 bucket name',
      exportName: `InvoicesBucketName-${stage}`,
    });

    new cdk.CfnOutput(this, 'InvoicesBucketArn', {
      value: this.invoicesBucket.bucketArn,
      description: 'Invoices S3 bucket ARN',
      exportName: `InvoicesBucketArn-${stage}`,
    });

    new cdk.CfnOutput(this, 'ExportsBucketName', {
      value: this.exportsBucket.bucketName,
      description: 'Exports S3 bucket name',
      exportName: `ExportsBucketName-${stage}`,
    });

    new cdk.CfnOutput(this, 'ExportsBucketArn', {
      value: this.exportsBucket.bucketArn,
      description: 'Exports S3 bucket ARN',
      exportName: `ExportsBucketArn-${stage}`,
    });

    new cdk.CfnOutput(this, 'LambdaBucketAccessPolicyArn', {
      value: lambdaBucketAccessPolicy.managedPolicyArn,
      description: 'IAM policy ARN for Lambda bucket access',
      exportName: `LambdaBucketAccessPolicyArn-${stage}`,
    });
  }
} 