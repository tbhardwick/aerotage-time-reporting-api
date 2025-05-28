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
exports.DomainStack = void 0;
var cdk = require("aws-cdk-lib");
var route53 = require("aws-cdk-lib/aws-route53");
var route53Targets = require("aws-cdk-lib/aws-route53-targets");
var acm = require("aws-cdk-lib/aws-certificatemanager");
var apigateway = require("aws-cdk-lib/aws-apigateway");
var DomainStack = /** @class */ (function (_super) {
    __extends(DomainStack, _super);
    function DomainStack(scope, id, props) {
        var _this = _super.call(this, scope, id, props) || this;
        var stage = props.stage, hostedZoneName = props.hostedZoneName, restApi = props.restApi;
        // Define the API subdomain based on stage
        var apiSubdomain = stage === 'prod' ? 'time-api' : "time-api-".concat(stage);
        _this.domainName = "".concat(apiSubdomain, ".").concat(hostedZoneName);
        _this.apiUrl = "https://".concat(_this.domainName);
        // Look up the existing hosted zone
        var hostedZone = route53.HostedZone.fromLookup(_this, 'HostedZone', {
            domainName: hostedZoneName,
        });
        // Create SSL certificate for the API domain
        var certificate = new acm.Certificate(_this, 'ApiCertificate', {
            domainName: _this.domainName,
            validation: acm.CertificateValidation.fromDns(hostedZone),
            certificateName: "aerotage-time-api-cert-".concat(stage),
        });
        _this.certificateArn = certificate.certificateArn;
        // Create custom domain for API Gateway
        var customDomain = new apigateway.DomainName(_this, 'ApiCustomDomain', {
            domainName: _this.domainName,
            certificate: certificate,
            endpointType: apigateway.EndpointType.REGIONAL,
            securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
        });
        // Map the custom domain to the API Gateway
        var basePath = '';
        customDomain.addBasePathMapping(restApi, {
            basePath: basePath,
        });
        // Create Route 53 record to point to the custom domain
        new route53.ARecord(_this, 'ApiAliasRecord', {
            zone: hostedZone,
            recordName: apiSubdomain,
            target: route53.RecordTarget.fromAlias(new route53Targets.ApiGatewayDomain(customDomain)),
            comment: "API Gateway custom domain for ".concat(stage, " environment"),
        });
        // CloudFormation Outputs
        new cdk.CfnOutput(_this, 'ApiDomainName', {
            value: _this.domainName,
            description: 'Custom domain name for the API',
            exportName: "ApiDomainName-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'ApiUrl', {
            value: _this.apiUrl,
            description: 'API base URL with custom domain',
            exportName: "ApiUrl-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'CertificateArn', {
            value: _this.certificateArn,
            description: 'SSL certificate ARN for the API domain',
            exportName: "ApiCertificateArn-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'CustomDomainName', {
            value: customDomain.domainNameAliasDomainName,
            description: 'CloudFront domain name for the custom domain',
            exportName: "ApiCustomDomainName-".concat(stage),
        });
        return _this;
    }
    return DomainStack;
}(cdk.Stack));
exports.DomainStack = DomainStack;
