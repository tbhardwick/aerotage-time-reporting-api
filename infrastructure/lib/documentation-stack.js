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
exports.DocumentationStack = void 0;
var cdk = require("aws-cdk-lib");
var s3 = require("aws-cdk-lib/aws-s3");
var cloudfront = require("aws-cdk-lib/aws-cloudfront");
var origins = require("aws-cdk-lib/aws-cloudfront-origins");
var s3deploy = require("aws-cdk-lib/aws-s3-deployment");
var iam = require("aws-cdk-lib/aws-iam");
var DocumentationStack = /** @class */ (function (_super) {
    __extends(DocumentationStack, _super);
    function DocumentationStack(scope, id, props) {
        var _this = _super.call(this, scope, id, props) || this;
        var stage = props.stage, apiGatewayUrl = props.apiGatewayUrl;
        // S3 bucket for hosting documentation
        _this.documentationBucket = new s3.Bucket(_this, 'DocumentationBucket', {
            bucketName: "aerotage-api-docs-".concat(stage),
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
        var originAccessIdentity = new cloudfront.OriginAccessIdentity(_this, 'DocumentationOAI', {
            comment: "OAI for Aerotage API Documentation ".concat(stage),
        });
        // Grant CloudFront access to the S3 bucket
        _this.documentationBucket.addToResourcePolicy(new iam.PolicyStatement({
            actions: ['s3:GetObject'],
            resources: [_this.documentationBucket.arnForObjects('*')],
            principals: [originAccessIdentity.grantPrincipal],
        }));
        // CloudFront distribution
        _this.distribution = new cloudfront.Distribution(_this, 'DocumentationDistribution', {
            comment: "Aerotage API Documentation ".concat(stage),
            defaultBehavior: {
                origin: new origins.S3Origin(_this.documentationBucket, {
                    originAccessIdentity: originAccessIdentity,
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
        _this.documentationUrl = "https://".concat(_this.distribution.distributionDomainName);
        // Deploy Swagger UI and OpenAPI spec
        new s3deploy.BucketDeployment(_this, 'DocumentationDeployment', {
            sources: [
                s3deploy.Source.asset('../docs/swagger-ui'),
            ],
            destinationBucket: _this.documentationBucket,
            distribution: _this.distribution,
            distributionPaths: ['/*'],
            memoryLimit: 512,
            ephemeralStorageSize: cdk.Size.mebibytes(1024),
        });
        // CloudFormation Outputs
        new cdk.CfnOutput(_this, 'DocumentationBucketName', {
            value: _this.documentationBucket.bucketName,
            description: 'Documentation S3 bucket name',
            exportName: "DocumentationBucketName-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'DocumentationUrl', {
            value: _this.documentationUrl,
            description: 'API Documentation URL',
            exportName: "DocumentationUrl-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'CloudFrontDistributionId', {
            value: _this.distribution.distributionId,
            description: 'CloudFront Distribution ID',
            exportName: "DocumentationDistributionId-".concat(stage),
        });
        return _this;
    }
    DocumentationStack.prototype.loadOpenApiSpec = function (apiGatewayUrl) {
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
                    description: "".concat(this.stackName.includes('prod') ? 'Production' : 'Development', " server"),
                },
            ],
            // The full spec will be loaded from the YAML file during deployment
        };
    };
    return DocumentationStack;
}(cdk.Stack));
exports.DocumentationStack = DocumentationStack;
