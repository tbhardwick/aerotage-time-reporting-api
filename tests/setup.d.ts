declare const mockDynamoDBClient: {
    send: jest.Mock<any, any, any>;
};
declare const mockCognitoClient: {
    send: jest.Mock<any, any, any>;
};
declare const mockS3Client: {
    send: jest.Mock<any, any, any>;
};
declare global {
    var mockApiGatewayEvent: (options?: any) => any;
    var mockLambdaContext: any;
}
declare const originalConsole: Console;
//# sourceMappingURL=setup.d.ts.map