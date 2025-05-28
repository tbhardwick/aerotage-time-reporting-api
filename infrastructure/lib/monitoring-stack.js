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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringStack = void 0;
var cdk = require("aws-cdk-lib");
var cloudwatch = require("aws-cdk-lib/aws-cloudwatch");
var cloudwatchActions = require("aws-cdk-lib/aws-cloudwatch-actions");
var logs = require("aws-cdk-lib/aws-logs");
var sns = require("aws-cdk-lib/aws-sns");
var subscriptions = require("aws-cdk-lib/aws-sns-subscriptions");
var MonitoringStack = /** @class */ (function (_super) {
    __extends(MonitoringStack, _super);
    function MonitoringStack(scope, id, props) {
        var _a, _b, _c;
        var _this = _super.call(this, scope, id, props) || this;
        var stage = props.stage, apiGateway = props.apiGateway, lambdaFunctions = props.lambdaFunctions, dynamoDbTables = props.dynamoDbTables, cognitoPasswordResetAlarm = props.cognitoPasswordResetAlarm;
        // SNS Topic for alerts
        _this.alertTopic = new sns.Topic(_this, 'AlertTopic', {
            topicName: "aerotage-alerts-".concat(stage),
            displayName: 'Aerotage Time API Alerts',
        });
        // Add email subscription for production alerts
        if (stage === 'prod') {
            // Replace with actual admin email
            _this.alertTopic.addSubscription(new subscriptions.EmailSubscription('bhardwick@aerotage.com'));
        }
        // CloudWatch Dashboard
        _this.dashboard = new cloudwatch.Dashboard(_this, 'ApiDashboard', {
            dashboardName: "AerotageTimeAPI-".concat(stage),
        });
        // API Gateway Metrics
        var apiRequestsMetric = new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Count',
            dimensionsMap: {
                ApiName: apiGateway.restApiName,
                Stage: stage,
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
        });
        var apiLatencyMetric = new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Latency',
            dimensionsMap: {
                ApiName: apiGateway.restApiName,
                Stage: stage,
            },
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
        });
        var apiErrorsMetric = new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '4XXError',
            dimensionsMap: {
                ApiName: apiGateway.restApiName,
                Stage: stage,
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
        });
        var apiServerErrorsMetric = new cloudwatch.Metric({
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
        var highLatencyAlarm = new cloudwatch.Alarm(_this, 'HighLatencyAlarm', {
            alarmName: "".concat(stage, "-api-high-latency"),
            alarmDescription: 'API Gateway high latency detected',
            metric: apiLatencyMetric,
            threshold: 5000, // 5 seconds
            evaluationPeriods: 2,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        var highErrorRateAlarm = new cloudwatch.Alarm(_this, 'HighErrorRateAlarm', {
            alarmName: "".concat(stage, "-api-high-error-rate"),
            alarmDescription: 'API Gateway high error rate detected',
            metric: apiErrorsMetric,
            threshold: 10,
            evaluationPeriods: 2,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        var serverErrorAlarm = new cloudwatch.Alarm(_this, 'ServerErrorAlarm', {
            alarmName: "".concat(stage, "-api-server-errors"),
            alarmDescription: 'API Gateway server errors detected',
            metric: apiServerErrorsMetric,
            threshold: 1,
            evaluationPeriods: 1,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        // Add alarms to SNS topic
        highLatencyAlarm.addAlarmAction(new cloudwatchActions.SnsAction(_this.alertTopic));
        highErrorRateAlarm.addAlarmAction(new cloudwatchActions.SnsAction(_this.alertTopic));
        serverErrorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(_this.alertTopic));
        // Lambda Function Metrics and Alarms
        var lambdaWidgets = [];
        var lambdaAlarms = [];
        Object.entries(lambdaFunctions).forEach(function (_a) {
            var name = _a[0], func = _a[1];
            // Lambda Duration Metric
            var durationMetric = func.metricDuration({
                statistic: 'Average',
                period: cdk.Duration.minutes(5),
            });
            // Lambda Error Metric
            var errorMetric = func.metricErrors({
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
            });
            // Lambda Invocation Metric
            var invocationMetric = func.metricInvocations({
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
            });
            // Lambda Duration Alarm
            var durationAlarm = new cloudwatch.Alarm(_this, "".concat(name, "DurationAlarm"), {
                alarmName: "".concat(stage, "-lambda-").concat(name.toLowerCase(), "-duration"),
                alarmDescription: "Lambda function ".concat(name, " high duration"),
                metric: durationMetric,
                threshold: 25000, // 25 seconds (close to 30s timeout)
                evaluationPeriods: 2,
                treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            });
            // Lambda Error Alarm
            var errorAlarm = new cloudwatch.Alarm(_this, "".concat(name, "ErrorAlarm"), {
                alarmName: "".concat(stage, "-lambda-").concat(name.toLowerCase(), "-errors"),
                alarmDescription: "Lambda function ".concat(name, " errors detected"),
                metric: errorMetric,
                threshold: 1,
                evaluationPeriods: 1,
                treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            });
            durationAlarm.addAlarmAction(new cloudwatchActions.SnsAction(_this.alertTopic));
            errorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(_this.alertTopic));
            lambdaAlarms.push(durationAlarm, errorAlarm);
            // Add Lambda metrics widget
            lambdaWidgets.push(new cloudwatch.GraphWidget({
                title: "Lambda ".concat(name, " Metrics"),
                left: [invocationMetric, errorMetric],
                right: [durationMetric],
                width: 12,
                height: 6,
            }));
        });
        // DynamoDB Metrics and Alarms
        var dynamoWidgets = [];
        var dynamoAlarms = [];
        // Filter out null tables before processing
        var validTables = Object.entries(dynamoDbTables).filter(function (_a) {
            var _ = _a[0], table = _a[1];
            return table !== null;
        });
        validTables.forEach(function (_a) {
            var name = _a[0], table = _a[1];
            // Read Capacity Metric
            var readCapacityMetric = new cloudwatch.Metric({
                namespace: 'AWS/DynamoDB',
                metricName: 'ConsumedReadCapacityUnits',
                dimensionsMap: {
                    TableName: table.tableName,
                },
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
            });
            // Write Capacity Metric
            var writeCapacityMetric = new cloudwatch.Metric({
                namespace: 'AWS/DynamoDB',
                metricName: 'ConsumedWriteCapacityUnits',
                dimensionsMap: {
                    TableName: table.tableName,
                },
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
            });
            // Throttle Metric
            var throttleMetric = new cloudwatch.Metric({
                namespace: 'AWS/DynamoDB',
                metricName: 'ThrottledRequests',
                dimensionsMap: {
                    TableName: table.tableName,
                },
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
            });
            // Error Metric
            var errorMetric = new cloudwatch.Metric({
                namespace: 'AWS/DynamoDB',
                metricName: 'SystemErrors',
                dimensionsMap: {
                    TableName: table.tableName,
                },
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
            });
            // Throttle Alarm
            var throttleAlarm = new cloudwatch.Alarm(_this, "".concat(name, "ThrottleAlarm"), {
                alarmName: "".concat(stage, "-dynamodb-").concat(name.toLowerCase(), "-throttle"),
                alarmDescription: "DynamoDB table ".concat(name, " throttling detected"),
                metric: throttleMetric,
                threshold: 1,
                evaluationPeriods: 1,
                treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            });
            // Error Alarm
            var errorAlarm = new cloudwatch.Alarm(_this, "".concat(name, "ErrorAlarm"), {
                alarmName: "".concat(stage, "-dynamodb-").concat(name.toLowerCase(), "-errors"),
                alarmDescription: "DynamoDB table ".concat(name, " errors detected"),
                metric: errorMetric,
                threshold: 1,
                evaluationPeriods: 1,
                treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            });
            throttleAlarm.addAlarmAction(new cloudwatchActions.SnsAction(_this.alertTopic));
            errorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(_this.alertTopic));
            dynamoAlarms.push(throttleAlarm, errorAlarm);
            // Add DynamoDB metrics widget
            dynamoWidgets.push(new cloudwatch.GraphWidget({
                title: "DynamoDB ".concat(name, " Metrics"),
                left: [readCapacityMetric, writeCapacityMetric],
                right: [throttleMetric, errorMetric],
                width: 12,
                height: 6,
            }));
        });
        // Build Dashboard
        _this.dashboard.addWidgets(
        // API Gateway Overview
        new cloudwatch.GraphWidget({
            title: 'API Gateway - Requests & Latency',
            left: [apiRequestsMetric],
            right: [apiLatencyMetric],
            width: 12,
            height: 6,
        }), new cloudwatch.GraphWidget({
            title: 'API Gateway - Errors',
            left: [apiErrorsMetric, apiServerErrorsMetric],
            width: 12,
            height: 6,
        }));
        // Add Lambda widgets (first 4)
        var firstLambdaWidgets = lambdaWidgets.slice(0, 4);
        if (firstLambdaWidgets.length > 0) {
            (_a = _this.dashboard).addWidgets.apply(_a, firstLambdaWidgets);
        }
        // Add DynamoDB widgets (first 4)
        var firstDynamoWidgets = dynamoWidgets.slice(0, 4);
        if (firstDynamoWidgets.length > 0) {
            (_b = _this.dashboard).addWidgets.apply(_b, firstDynamoWidgets);
        }
        // ✅ NEW: Add password reset monitoring widget if available
        if (cognitoPasswordResetAlarm) {
            // Add password reset monitoring to dashboard
            var passwordResetWidget = new cloudwatch.GraphWidget({
                title: 'Cognito Password Reset Monitoring',
                left: [cognitoPasswordResetAlarm.metric],
                width: 12,
                height: 6,
            });
            _this.dashboard.addWidgets(passwordResetWidget);
        }
        // System Health Summary Widget
        var healthWidget = new cloudwatch.SingleValueWidget({
            title: 'System Health Summary',
            metrics: [
                apiRequestsMetric,
                apiErrorsMetric,
                apiServerErrorsMetric,
            ],
            width: 24,
            height: 6,
        });
        _this.dashboard.addWidgets(healthWidget);
        // Log Groups for centralized logging
        new logs.LogGroup(_this, 'ApiLogGroup', {
            logGroupName: "/aws/apigateway/".concat(apiGateway.restApiName),
            retention: stage === 'prod' ? logs.RetentionDays.SIX_MONTHS : logs.RetentionDays.ONE_WEEK,
            removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        });
        // Lambda Log Groups
        Object.entries(lambdaFunctions).forEach(function (_a) {
            var name = _a[0], func = _a[1];
            new logs.LogGroup(_this, "".concat(name, "LogGroup"), {
                logGroupName: "/aws/lambda/".concat(func.functionName),
                retention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
                removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
            });
        });
        // ✅ ENHANCED: Composite Alarm for overall system health including password reset monitoring
        var systemHealthAlarmRules = __spreadArray(__spreadArray([
            cloudwatch.AlarmRule.fromAlarm(highLatencyAlarm, cloudwatch.AlarmState.ALARM),
            cloudwatch.AlarmRule.fromAlarm(highErrorRateAlarm, cloudwatch.AlarmState.ALARM),
            cloudwatch.AlarmRule.fromAlarm(serverErrorAlarm, cloudwatch.AlarmState.ALARM)
        ], lambdaAlarms.map(function (alarm) {
            return cloudwatch.AlarmRule.fromAlarm(alarm, cloudwatch.AlarmState.ALARM);
        }), true), dynamoAlarms.map(function (alarm) {
            return cloudwatch.AlarmRule.fromAlarm(alarm, cloudwatch.AlarmState.ALARM);
        }), true);
        // Include password reset alarm in system health if provided
        if (cognitoPasswordResetAlarm) {
            systemHealthAlarmRules.push(cloudwatch.AlarmRule.fromAlarm(cognitoPasswordResetAlarm, cloudwatch.AlarmState.ALARM));
        }
        var systemHealthAlarm = new cloudwatch.CompositeAlarm(_this, 'SystemHealthAlarm', {
            compositeAlarmName: "".concat(stage, "-system-health"),
            alarmDescription: 'Overall system health alarm including password reset monitoring',
            alarmRule: (_c = cloudwatch.AlarmRule).anyOf.apply(_c, systemHealthAlarmRules),
        });
        systemHealthAlarm.addAlarmAction(new cloudwatchActions.SnsAction(_this.alertTopic));
        // CloudFormation Outputs
        new cdk.CfnOutput(_this, 'DashboardUrl', {
            value: "https://console.aws.amazon.com/cloudwatch/home?region=".concat(_this.region, "#dashboards:name=").concat(_this.dashboard.dashboardName),
            description: 'CloudWatch Dashboard URL',
            exportName: "DashboardUrl-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'AlertTopicArn', {
            value: _this.alertTopic.topicArn,
            description: 'SNS Topic ARN for alerts',
            exportName: "AlertTopicArn-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'SystemHealthAlarmArn', {
            value: systemHealthAlarm.alarmArn,
            description: 'System Health Composite Alarm ARN',
            exportName: "SystemHealthAlarmArn-".concat(stage),
        });
        return _this;
    }
    return MonitoringStack;
}(cdk.Stack));
exports.MonitoringStack = MonitoringStack;
