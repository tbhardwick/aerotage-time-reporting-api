import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { DatabaseTables } from './database-stack';

export interface MonitoringStackProps extends cdk.StackProps {
  stage: string;
  apiGateway: apigateway.RestApi;
  lambdaFunctions: { [key: string]: lambda.Function };
  dynamoDbTables: DatabaseTables;
}

export class MonitoringStack extends cdk.Stack {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly alertTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { stage, apiGateway, lambdaFunctions, dynamoDbTables } = props;

    // SNS Topic for alerts
    this.alertTopic = new sns.Topic(this, 'AlertTopic', {
      topicName: `aerotage-alerts-${stage}`,
      displayName: 'Aerotage Time API Alerts',
    });

    // Add email subscription for production alerts
    if (stage === 'prod') {
      // Replace with actual admin email
      this.alertTopic.addSubscription(
        new subscriptions.EmailSubscription('admin@aerotage.com')
      );
    }

    // CloudWatch Dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'ApiDashboard', {
      dashboardName: `AerotageTimeAPI-${stage}`,
    });

    // API Gateway Metrics
    const apiRequestsMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Count',
      dimensionsMap: {
        ApiName: apiGateway.restApiName,
        Stage: stage,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const apiLatencyMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Latency',
      dimensionsMap: {
        ApiName: apiGateway.restApiName,
        Stage: stage,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    const apiErrorsMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '4XXError',
      dimensionsMap: {
        ApiName: apiGateway.restApiName,
        Stage: stage,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const apiServerErrorsMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '5XXError',
      dimensionsMap: {
        ApiName: apiGateway.restApiName,
        Stage: stage,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // API Gateway Alarms
    const highLatencyAlarm = new cloudwatch.Alarm(this, 'HighLatencyAlarm', {
      alarmName: `${stage}-api-high-latency`,
      alarmDescription: 'API Gateway high latency detected',
      metric: apiLatencyMetric,
      threshold: 5000, // 5 seconds
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    const highErrorRateAlarm = new cloudwatch.Alarm(this, 'HighErrorRateAlarm', {
      alarmName: `${stage}-api-high-error-rate`,
      alarmDescription: 'API Gateway high error rate detected',
      metric: apiErrorsMetric,
      threshold: 10,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    const serverErrorAlarm = new cloudwatch.Alarm(this, 'ServerErrorAlarm', {
      alarmName: `${stage}-api-server-errors`,
      alarmDescription: 'API Gateway server errors detected',
      metric: apiServerErrorsMetric,
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Add alarms to SNS topic
    highLatencyAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));
    highErrorRateAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));
    serverErrorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));

    // Lambda Function Metrics and Alarms
    const lambdaWidgets: cloudwatch.IWidget[] = [];
    const lambdaAlarms: cloudwatch.Alarm[] = [];

    Object.entries(lambdaFunctions).forEach(([name, func]) => {
      // Lambda Duration Metric
      const durationMetric = func.metricDuration({
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      });

      // Lambda Error Metric
      const errorMetric = func.metricErrors({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // Lambda Invocation Metric
      const invocationMetric = func.metricInvocations({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // Lambda Duration Alarm
      const durationAlarm = new cloudwatch.Alarm(this, `${name}DurationAlarm`, {
        alarmName: `${stage}-lambda-${name.toLowerCase()}-duration`,
        alarmDescription: `Lambda function ${name} high duration`,
        metric: durationMetric,
        threshold: 25000, // 25 seconds (close to 30s timeout)
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      // Lambda Error Alarm
      const errorAlarm = new cloudwatch.Alarm(this, `${name}ErrorAlarm`, {
        alarmName: `${stage}-lambda-${name.toLowerCase()}-errors`,
        alarmDescription: `Lambda function ${name} errors detected`,
        metric: errorMetric,
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      durationAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));
      errorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));

      lambdaAlarms.push(durationAlarm, errorAlarm);

      // Add Lambda metrics widget
      lambdaWidgets.push(
        new cloudwatch.GraphWidget({
          title: `Lambda ${name} Metrics`,
          left: [invocationMetric, errorMetric],
          right: [durationMetric],
          width: 12,
          height: 6,
        })
      );
    });

    // DynamoDB Metrics and Alarms
    const dynamoWidgets: cloudwatch.IWidget[] = [];
    const dynamoAlarms: cloudwatch.Alarm[] = [];

    Object.entries(dynamoDbTables).forEach(([name, table]) => {
      // Read Capacity Metric
      const readCapacityMetric = new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'ConsumedReadCapacityUnits',
        dimensionsMap: {
          TableName: table.tableName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // Write Capacity Metric
      const writeCapacityMetric = new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'ConsumedWriteCapacityUnits',
        dimensionsMap: {
          TableName: table.tableName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // Throttle Metric
      const throttleMetric = new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'ThrottledRequests',
        dimensionsMap: {
          TableName: table.tableName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // Error Metric
      const errorMetric = new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'SystemErrors',
        dimensionsMap: {
          TableName: table.tableName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // Throttle Alarm
      const throttleAlarm = new cloudwatch.Alarm(this, `${name}ThrottleAlarm`, {
        alarmName: `${stage}-dynamodb-${name.toLowerCase()}-throttle`,
        alarmDescription: `DynamoDB table ${name} throttling detected`,
        metric: throttleMetric,
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      // Error Alarm
      const errorAlarm = new cloudwatch.Alarm(this, `${name}ErrorAlarm`, {
        alarmName: `${stage}-dynamodb-${name.toLowerCase()}-errors`,
        alarmDescription: `DynamoDB table ${name} errors detected`,
        metric: errorMetric,
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      throttleAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));
      errorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));

      dynamoAlarms.push(throttleAlarm, errorAlarm);

      // Add DynamoDB metrics widget
      dynamoWidgets.push(
        new cloudwatch.GraphWidget({
          title: `DynamoDB ${name} Metrics`,
          left: [readCapacityMetric, writeCapacityMetric],
          right: [throttleMetric, errorMetric],
          width: 12,
          height: 6,
        })
      );
    });

    // Build Dashboard
    this.dashboard.addWidgets(
      // API Gateway Overview
      new cloudwatch.GraphWidget({
        title: 'API Gateway - Requests & Latency',
        left: [apiRequestsMetric],
        right: [apiLatencyMetric],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway - Errors',
        left: [apiErrorsMetric, apiServerErrorsMetric],
        width: 12,
        height: 6,
      })
    );

    // Add Lambda widgets (first 4)
    const firstLambdaWidgets = lambdaWidgets.slice(0, 4);
    if (firstLambdaWidgets.length > 0) {
      this.dashboard.addWidgets(...firstLambdaWidgets);
    }

    // Add DynamoDB widgets (first 4)
    const firstDynamoWidgets = dynamoWidgets.slice(0, 4);
    if (firstDynamoWidgets.length > 0) {
      this.dashboard.addWidgets(...firstDynamoWidgets);
    }

    // System Health Summary Widget
    const healthWidget = new cloudwatch.SingleValueWidget({
      title: 'System Health Summary',
      metrics: [
        apiRequestsMetric,
        apiErrorsMetric,
        apiServerErrorsMetric,
      ],
      width: 24,
      height: 6,
    });

    this.dashboard.addWidgets(healthWidget);

    // Log Groups for centralized logging
    new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: `/aws/apigateway/${apiGateway.restApiName}`,
      retention: stage === 'prod' ? logs.RetentionDays.SIX_MONTHS : logs.RetentionDays.ONE_WEEK,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Lambda Log Groups
    Object.entries(lambdaFunctions).forEach(([name, func]) => {
      new logs.LogGroup(this, `${name}LogGroup`, {
        logGroupName: `/aws/lambda/${func.functionName}`,
        retention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
        removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      });
    });

    // Composite Alarm for overall system health
    const systemHealthAlarm = new cloudwatch.CompositeAlarm(this, 'SystemHealthAlarm', {
      compositeAlarmName: `${stage}-system-health`,
      alarmDescription: 'Overall system health alarm',
      alarmRule: cloudwatch.AlarmRule.anyOf(
        cloudwatch.AlarmRule.fromAlarm(highLatencyAlarm, cloudwatch.AlarmState.ALARM),
        cloudwatch.AlarmRule.fromAlarm(highErrorRateAlarm, cloudwatch.AlarmState.ALARM),
        cloudwatch.AlarmRule.fromAlarm(serverErrorAlarm, cloudwatch.AlarmState.ALARM),
        ...lambdaAlarms.map(alarm => 
          cloudwatch.AlarmRule.fromAlarm(alarm, cloudwatch.AlarmState.ALARM)
        ),
        ...dynamoAlarms.map(alarm => 
          cloudwatch.AlarmRule.fromAlarm(alarm, cloudwatch.AlarmState.ALARM)
        )
      ),
    });

    systemHealthAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
      exportName: `DashboardUrl-${stage}`,
    });

    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: this.alertTopic.topicArn,
      description: 'SNS Topic ARN for alerts',
      exportName: `AlertTopicArn-${stage}`,
    });

    new cdk.CfnOutput(this, 'SystemHealthAlarmArn', {
      value: systemHealthAlarm.alarmArn,
      description: 'System Health Composite Alarm ARN',
      exportName: `SystemHealthAlarmArn-${stage}`,
    });
  }
} 