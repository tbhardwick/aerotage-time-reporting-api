"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageStack = void 0;
var cdk = require("aws-cdk-lib");
var s3 = require("aws-cdk-lib/aws-s3");
var iam = require("aws-cdk-lib/aws-iam");
var StorageStack = /** @class */ (function (_super) {
    __extends(StorageStack, _super);
    function StorageStack(scope, id, props) {
        var _this = _super.call(this, scope, id, props) || this;
        var stage = props.stage;
        // Main storage bucket for general file uploads (profile pictures, documents)
        _this.storageBucket = new s3.Bucket(_this, 'StorageBucket', {
            bucketName: "aerotage-time-storage-".concat(stage),
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
        _this.invoicesBucket = new s3.Bucket(_this, 'InvoicesBucket', {
            bucketName: "aerotage-time-invoices-".concat(stage),
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
        _this.exportsBucket = new s3.Bucket(_this, 'ExportsBucket', {
            bucketName: "aerotage-time-exports-".concat(stage),
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
        var bucketAccessPolicy = new iam.PolicyDocument({
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
                        _this.storageBucket.arnForObjects('*'),
                        _this.invoicesBucket.arnForObjects('*'),
                        _this.exportsBucket.arnForObjects('*'),
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
                        _this.storageBucket.bucketArn,
                        _this.invoicesBucket.bucketArn,
                        _this.exportsBucket.bucketArn,
                    ],
                }),
            ],
        });
        // Create managed policy for Lambda functions
        var lambdaBucketAccessPolicy = new iam.ManagedPolicy(_this, 'LambdaBucketAccessPolicy', {
            managedPolicyName: "aerotage-lambda-bucket-access-".concat(stage),
            description: 'Policy for Lambda functions to access S3 buckets',
            document: bucketAccessPolicy,
        });
        // CloudFormation Outputs
        new cdk.CfnOutput(_this, 'StorageBucketName', {
            value: _this.storageBucket.bucketName,
            description: 'Main storage S3 bucket name',
            exportName: "StorageBucketName-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'StorageBucketArn', {
            value: _this.storageBucket.bucketArn,
            description: 'Main storage S3 bucket ARN',
            exportName: "StorageBucketArn-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'InvoicesBucketName', {
            value: _this.invoicesBucket.bucketName,
            description: 'Invoices S3 bucket name',
            exportName: "InvoicesBucketName-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'InvoicesBucketArn', {
            value: _this.invoicesBucket.bucketArn,
            description: 'Invoices S3 bucket ARN',
            exportName: "InvoicesBucketArn-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'ExportsBucketName', {
            value: _this.exportsBucket.bucketName,
            description: 'Exports S3 bucket name',
            exportName: "ExportsBucketName-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'ExportsBucketArn', {
            value: _this.exportsBucket.bucketArn,
            description: 'Exports S3 bucket ARN',
            exportName: "ExportsBucketArn-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'LambdaBucketAccessPolicyArn', {
            value: lambdaBucketAccessPolicy.managedPolicyArn,
            description: 'IAM policy ARN for Lambda bucket access',
            exportName: "LambdaBucketAccessPolicyArn-".concat(stage),
        });
        return _this;
    }
    return StorageStack;
}(cdk.Stack));
exports.StorageStack = StorageStack;
