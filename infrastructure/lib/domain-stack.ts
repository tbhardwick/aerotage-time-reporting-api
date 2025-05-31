import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export interface DomainStackProps extends cdk.StackProps {
  stage: string;
  hostedZoneName: string; // e.g., 'aerotage.com'
  restApi: apigateway.IRestApi;
  apiGatewayStage: string;
}

export class DomainStack extends cdk.Stack {
  public readonly domainName: string;
  public readonly certificateArn: string;
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: DomainStackProps) {
    super(scope, id, props);

    const { stage, restApi } = props;

    const domainName = stage === 'prod' ? 'aerotage.com' : 'dev.aerotage.com';
    const apiDomainName = `api.${domainName}`;

    this.domainName = domainName;
    this.apiUrl = `https://${apiDomainName}`;

    // Create hosted zone
    const hostedZone = new route53.HostedZone(this, 'HostedZone', {
      zoneName: domainName,
      comment: `Aerotage Time Reporting API ${stage} environment`,
    });

    // Create SSL certificate for the API domain
    const certificate = new acm.Certificate(this, 'ApiCertificate', {
      domainName: apiDomainName,
      validation: acm.CertificateValidation.fromDns(hostedZone),
      certificateName: `aerotage-time-api-cert-${stage}`,
    });

    this.certificateArn = certificate.certificateArn;

    // Create custom domain for API Gateway
    const customDomain = new apigateway.DomainName(this, 'ApiCustomDomain', {
      domainName: apiDomainName,
      certificate: certificate,
      endpointType: apigateway.EndpointType.REGIONAL,
      securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
    });

    // Map the custom domain to the API Gateway
    const basePath = '';
    customDomain.addBasePathMapping(restApi, {
      basePath,
    });

    // Create Route 53 record to point to the custom domain
    new route53.ARecord(this, 'ApiAliasRecord', {
      zone: hostedZone,
      recordName: apiDomainName,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.ApiGatewayDomain(customDomain)
      ),
      comment: `API Gateway custom domain for ${stage} environment`,
    });

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'ApiDomainName', {
      value: apiDomainName,
      description: 'Custom domain name for the API',
      exportName: `ApiDomainName-${stage}`,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.apiUrl,
      description: 'API base URL with custom domain',
      exportName: `ApiUrl-${stage}`,
    });

    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.certificateArn,
      description: 'SSL certificate ARN for the API domain',
      exportName: `ApiCertificateArn-${stage}`,
    });

    new cdk.CfnOutput(this, 'CustomDomainName', {
      value: customDomain.domainNameAliasDomainName,
      description: 'CloudFront domain name for the custom domain',
      exportName: `ApiCustomDomainName-${stage}`,
    });
  }
} 