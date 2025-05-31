import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths?: Record<string, unknown>;
  components?: Record<string, unknown>;
}

export interface DocumentationStackProps extends cdk.StackProps {
  stage: string;
  apiGatewayUrl: string;
}

export class DocumentationStack extends cdk.Stack {
  public readonly documentationBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly documentationUrl: string;

  constructor(scope: Construct, id: string, props: DocumentationStackProps) {
    super(scope, id, props);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { stage, apiGatewayUrl } = props;

    // S3 bucket for hosting documentation
    this.documentationBucket = new s3.Bucket(this, 'DocumentationBucket', {
      bucketName: `aerotage-api-docs-${stage}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true,
      }),
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: stage !== 'prod',
    });

    // Origin Access Identity for CloudFront
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'DocumentationOAI', {
      comment: `OAI for Aerotage API Documentation ${stage}`,
    });

    // Grant CloudFront access to the S3 bucket
    this.documentationBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [this.documentationBucket.arnForObjects('*')],
        principals: [originAccessIdentity.grantPrincipal],
      })
    );

    // CloudFront distribution
    this.distribution = new cloudfront.Distribution(this, 'DocumentationDistribution', {
      comment: `Aerotage API Documentation ${stage}`,
      defaultBehavior: {
        origin: new origins.S3Origin(this.documentationBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        compress: true,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Use only North America and Europe
      enabled: true,
    });

    this.documentationUrl = `https://${this.distribution.distributionDomainName}`;

    // Deploy Swagger UI and OpenAPI spec
    new s3deploy.BucketDeployment(this, 'DocumentationDeployment', {
      sources: [
        s3deploy.Source.asset('../docs/swagger-ui'),
      ],
      destinationBucket: this.documentationBucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
      memoryLimit: 512,
      ephemeralStorageSize: cdk.Size.mebibytes(1024),
    });

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'DocumentationBucketName', {
      value: this.documentationBucket.bucketName,
      description: 'Documentation S3 bucket name',
      exportName: `DocumentationBucketName-${stage}`,
    });

    new cdk.CfnOutput(this, 'DocumentationUrl', {
      value: this.documentationUrl,
      description: 'API Documentation URL',
      exportName: `DocumentationUrl-${stage}`,
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
      exportName: `DocumentationDistributionId-${stage}`,
    });
  }

  private loadOpenApiSpec(apiGatewayUrl: string): OpenApiSpec {
    // This will be replaced with the actual OpenAPI spec
    // For now, return a basic structure that will be updated by the deployment
    return {
      openapi: '3.0.3',
      info: {
        title: 'Aerotage Time Reporting API',
        version: '1.0.0',
        description: 'Comprehensive time tracking and project management API for Aerotage.',
      },
      servers: [
        {
          url: apiGatewayUrl,
          description: `${this.stackName.includes('prod') ? 'Production' : 'Development'} server`,
        },
      ],
      // The full spec will be loaded from the YAML file during deployment
    };
  }
} 