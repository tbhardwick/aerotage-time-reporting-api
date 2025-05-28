"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
var auth_helper_1 = require("../shared/auth-helper");
var response_helper_1 = require("../shared/response-helper");
var client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
var lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
var client_s3_1 = require("@aws-sdk/client-s3");
// Note: In production, install @aws-sdk/s3-request-presigner package
// import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
var client_ses_1 = require("@aws-sdk/client-ses");
var crypto_1 = require("crypto");
var dynamoClient = new client_dynamodb_1.DynamoDBClient({});
var docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
var s3Client = new client_s3_1.S3Client({});
var sesClient = new client_ses_1.SESClient({});
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, user, userRole, userEmail, exportRequest, validFormats, reportData, exportResult, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 7, , 8]);
                console.log('Export report request:', JSON.stringify(event, null, 2));
                userId = (0, auth_helper_1.getCurrentUserId)(event);
                user = (0, auth_helper_1.getAuthenticatedUser)(event);
                userRole = (user === null || user === void 0 ? void 0 : user.role) || 'employee';
                userEmail = user === null || user === void 0 ? void 0 : user.email;
                if (!userId) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(401, 'UNAUTHORIZED', 'User authentication required')];
                }
                exportRequest = void 0;
                try {
                    exportRequest = JSON.parse(event.body || '{}');
                }
                catch (error) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, 'INVALID_JSON', 'Invalid JSON in request body')];
                }
                // Validate required fields
                if (!exportRequest.format) {
                    return [2 /*return*/, {
                            statusCode: 400,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: false,
                                error: {
                                    code: 'MISSING_FORMAT',
                                    message: 'Export format is required',
                                },
                            }),
                        }];
                }
                validFormats = ['pdf', 'csv', 'excel'];
                if (!validFormats.includes(exportRequest.format)) {
                    return [2 /*return*/, {
                            statusCode: 400,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: false,
                                error: {
                                    code: 'INVALID_FORMAT',
                                    message: "Format must be one of: ".concat(validFormats.join(', ')),
                                },
                            }),
                        }];
                }
                reportData = void 0;
                if (!exportRequest.reportId) return [3 /*break*/, 2];
                return [4 /*yield*/, getReportData(exportRequest.reportId, userId, userRole)];
            case 1:
                reportData = _a.sent();
                if (!reportData) {
                    return [2 /*return*/, {
                            statusCode: 404,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: false,
                                error: {
                                    code: 'REPORT_NOT_FOUND',
                                    message: 'Report not found or access denied',
                                },
                            }),
                        }];
                }
                return [3 /*break*/, 3];
            case 2:
                if (exportRequest.reportData) {
                    reportData = exportRequest.reportData;
                }
                else {
                    return [2 /*return*/, {
                            statusCode: 400,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: false,
                                error: {
                                    code: 'MISSING_DATA',
                                    message: 'Either reportId or reportData is required',
                                },
                            }),
                        }];
                }
                _a.label = 3;
            case 3: return [4 /*yield*/, generateExport(reportData, exportRequest.format, exportRequest.options || {}, userId, userEmail)];
            case 4:
                exportResult = _a.sent();
                if (!exportRequest.delivery) return [3 /*break*/, 6];
                return [4 /*yield*/, handleDelivery(exportResult, exportRequest.delivery, userEmail)];
            case 5:
                _a.sent();
                _a.label = 6;
            case 6: return [2 /*return*/, {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                    body: JSON.stringify({
                        success: true,
                        data: exportResult,
                    }),
                }];
            case 7:
                error_1 = _a.sent();
                console.error('Error exporting report:', error_1);
                return [2 /*return*/, {
                        statusCode: 500,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify({
                            success: false,
                            error: {
                                code: 'EXPORT_FAILED',
                                message: 'Failed to export report',
                            },
                        }),
                    }];
            case 8: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
function getReportData(reportId, userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var cacheTable, command, result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    cacheTable = process.env.REPORT_CACHE_TABLE_NAME;
                    if (!cacheTable) {
                        return [2 /*return*/, null];
                    }
                    command = new lib_dynamodb_1.GetCommand({
                        TableName: cacheTable,
                        Key: { cacheKey: reportId },
                    });
                    return [4 /*yield*/, docClient.send(command)];
                case 1:
                    result = _a.sent();
                    if (result.Item && result.Item.expiresAt > Date.now()) {
                        return [2 /*return*/, result.Item.reportData];
                    }
                    return [2 /*return*/, null];
                case 2:
                    error_2 = _a.sent();
                    console.error('Error fetching report data:', error_2);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function generateExport(reportData, format, options, userId, userEmail) {
    return __awaiter(this, void 0, void 0, function () {
        var exportId, timestamp, fileContent, contentType, fileExtension, _a, fileName, uploadResult, downloadUrl;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    exportId = (0, crypto_1.randomUUID)();
                    timestamp = new Date().toISOString();
                    _a = format;
                    switch (_a) {
                        case 'csv': return [3 /*break*/, 1];
                        case 'excel': return [3 /*break*/, 3];
                        case 'pdf': return [3 /*break*/, 5];
                    }
                    return [3 /*break*/, 7];
                case 1: return [4 /*yield*/, generateCSV(reportData, options)];
                case 2:
                    fileContent = _b.sent();
                    contentType = 'text/csv';
                    fileExtension = 'csv';
                    return [3 /*break*/, 8];
                case 3: return [4 /*yield*/, generateExcel(reportData, options)];
                case 4:
                    fileContent = _b.sent();
                    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                    fileExtension = 'xlsx';
                    return [3 /*break*/, 8];
                case 5: return [4 /*yield*/, generatePDF(reportData, options)];
                case 6:
                    fileContent = _b.sent();
                    contentType = 'application/pdf';
                    fileExtension = 'pdf';
                    return [3 /*break*/, 8];
                case 7: throw new Error("Unsupported format: ".concat(format));
                case 8:
                    fileName = "exports/".concat(userId, "/").concat(exportId, ".").concat(fileExtension);
                    return [4 /*yield*/, uploadToS3(fileName, fileContent, contentType)];
                case 9:
                    uploadResult = _b.sent();
                    return [4 /*yield*/, generateDownloadUrl(fileName, options.expiresIn || 24)];
                case 10:
                    downloadUrl = _b.sent();
                    return [2 /*return*/, {
                            exportId: exportId,
                            format: format,
                            status: 'completed',
                            downloadUrl: downloadUrl,
                            expiresAt: new Date(Date.now() + (options.expiresIn || 24) * 60 * 60 * 1000).toISOString(),
                            fileSize: fileContent.length,
                            generatedAt: timestamp,
                        }];
            }
        });
    });
}
function generateCSV(reportData, options) {
    return __awaiter(this, void 0, void 0, function () {
        var csvContent_1, headers_1;
        return __generator(this, function (_a) {
            try {
                csvContent_1 = '';
                // Add header with report info
                csvContent_1 += "Report Type,".concat(reportData.reportType, "\n");
                csvContent_1 += "Generated At,".concat(reportData.generatedAt, "\n");
                csvContent_1 += "Report ID,".concat(reportData.reportId, "\n");
                csvContent_1 += '\n';
                // Add summary section
                if (reportData.summary) {
                    csvContent_1 += 'SUMMARY\n';
                    Object.entries(reportData.summary).forEach(function (_a) {
                        var key = _a[0], value = _a[1];
                        csvContent_1 += "".concat(key, ",").concat(value, "\n");
                    });
                    csvContent_1 += '\n';
                }
                // Add main data
                if (reportData.data && reportData.data.length > 0) {
                    csvContent_1 += 'DETAILED DATA\n';
                    headers_1 = Object.keys(reportData.data[0]);
                    csvContent_1 += headers_1.join(',') + '\n';
                    // Data rows
                    reportData.data.forEach(function (row) {
                        var values = headers_1.map(function (header) {
                            var value = row[header];
                            if (typeof value === 'string' && value.includes(',')) {
                                value = "\"".concat(value, "\"");
                            }
                            return value || '';
                        });
                        csvContent_1 += values.join(',') + '\n';
                    });
                }
                return [2 /*return*/, Buffer.from(csvContent_1, 'utf-8')];
            }
            catch (error) {
                console.error('Error generating CSV:', error);
                throw new Error('Failed to generate CSV export');
            }
            return [2 /*return*/];
        });
    });
}
function generateExcel(reportData, options) {
    return __awaiter(this, void 0, void 0, function () {
        var workbookData, csvBuffer, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    workbookData = {
                        worksheets: [
                            {
                                name: 'Summary',
                                data: reportData.summary ? Object.entries(reportData.summary).map(function (_a) {
                                    var key = _a[0], value = _a[1];
                                    return [key, value];
                                }) : []
                            },
                            {
                                name: 'Data',
                                data: reportData.data || []
                            }
                        ]
                    };
                    return [4 /*yield*/, generateCSV(reportData, options)];
                case 1:
                    csvBuffer = _a.sent();
                    return [2 /*return*/, csvBuffer];
                case 2:
                    error_3 = _a.sent();
                    console.error('Error generating Excel:', error_3);
                    throw new Error('Failed to generate Excel export');
                case 3: return [2 /*return*/];
            }
        });
    });
}
function generatePDF(reportData, options) {
    return __awaiter(this, void 0, void 0, function () {
        var htmlContent_1, headers_2;
        return __generator(this, function (_a) {
            try {
                htmlContent_1 = "\n      <!DOCTYPE html>\n      <html>\n      <head>\n        <title>".concat(reportData.reportType, " Report</title>\n        <style>\n          body { font-family: Arial, sans-serif; margin: 20px; }\n          .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }\n          .summary { background-color: #f5f5f5; padding: 15px; margin-bottom: 20px; }\n          .data-table { width: 100%; border-collapse: collapse; }\n          .data-table th, .data-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }\n          .data-table th { background-color: #f2f2f2; }\n        </style>\n      </head>\n      <body>\n        <div class=\"header\">\n          <h1>").concat(reportData.reportType.toUpperCase(), " Report</h1>\n          <p>Generated: ").concat(new Date(reportData.generatedAt).toLocaleString(), "</p>\n          <p>Report ID: ").concat(reportData.reportId, "</p>\n        </div>\n    ");
                // Add summary
                if (reportData.summary) {
                    htmlContent_1 += '<div class="summary"><h2>Summary</h2>';
                    Object.entries(reportData.summary).forEach(function (_a) {
                        var key = _a[0], value = _a[1];
                        htmlContent_1 += "<p><strong>".concat(key, ":</strong> ").concat(value, "</p>");
                    });
                    htmlContent_1 += '</div>';
                }
                // Add data table
                if (reportData.data && reportData.data.length > 0) {
                    htmlContent_1 += '<h2>Detailed Data</h2>';
                    htmlContent_1 += '<table class="data-table">';
                    headers_2 = Object.keys(reportData.data[0]);
                    htmlContent_1 += '<tr>';
                    headers_2.forEach(function (header) {
                        htmlContent_1 += "<th>".concat(header, "</th>");
                    });
                    htmlContent_1 += '</tr>';
                    // Data rows
                    reportData.data.forEach(function (row) {
                        htmlContent_1 += '<tr>';
                        headers_2.forEach(function (header) {
                            htmlContent_1 += "<td>".concat(row[header] || '', "</td>");
                        });
                        htmlContent_1 += '</tr>';
                    });
                    htmlContent_1 += '</table>';
                }
                htmlContent_1 += '</body></html>';
                // For now, return HTML as PDF generation requires Puppeteer
                // In production, convert HTML to PDF using Puppeteer
                return [2 /*return*/, Buffer.from(htmlContent_1, 'utf-8')];
            }
            catch (error) {
                console.error('Error generating PDF:', error);
                throw new Error('Failed to generate PDF export');
            }
            return [2 /*return*/];
        });
    });
}
function uploadToS3(fileName, content, contentType) {
    return __awaiter(this, void 0, void 0, function () {
        var bucketName, command;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    bucketName = process.env.EXPORTS_BUCKET_NAME;
                    if (!bucketName) {
                        throw new Error('EXPORTS_BUCKET_NAME environment variable not set');
                    }
                    command = new client_s3_1.PutObjectCommand({
                        Bucket: bucketName,
                        Key: fileName,
                        Body: content,
                        ContentType: contentType,
                        ServerSideEncryption: 'AES256',
                        Metadata: {
                            uploadedAt: new Date().toISOString(),
                        },
                    });
                    return [4 /*yield*/, s3Client.send(command)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function generateDownloadUrl(fileName, expiresInHours) {
    return __awaiter(this, void 0, void 0, function () {
        var bucketName;
        return __generator(this, function (_a) {
            bucketName = process.env.EXPORTS_BUCKET_NAME;
            if (!bucketName) {
                throw new Error('EXPORTS_BUCKET_NAME environment variable not set');
            }
            // In production, use getSignedUrl from @aws-sdk/s3-request-presigner
            // For now, return a placeholder URL
            return [2 /*return*/, "https://".concat(bucketName, ".s3.amazonaws.com/").concat(fileName, "?expires=").concat(Date.now() + (expiresInHours * 60 * 60 * 1000))];
        });
    });
}
function handleDelivery(exportResult, delivery, userEmail) {
    return __awaiter(this, void 0, void 0, function () {
        var error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    if (!(delivery.email && delivery.email.length > 0)) return [3 /*break*/, 2];
                    return [4 /*yield*/, sendEmailDelivery(exportResult, delivery, userEmail)];
                case 1:
                    _a.sent();
                    exportResult.deliveryStatus = {
                        email: 'sent',
                        recipients: delivery.email,
                    };
                    _a.label = 2;
                case 2: return [3 /*break*/, 4];
                case 3:
                    error_4 = _a.sent();
                    console.error('Error handling delivery:', error_4);
                    if (exportResult.deliveryStatus) {
                        exportResult.deliveryStatus.email = 'failed';
                    }
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function sendEmailDelivery(exportResult, delivery, userEmail) {
    return __awaiter(this, void 0, void 0, function () {
        var fromEmail, subject, message, htmlBody, textBody, _i, _a, email, command;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    fromEmail = process.env.FROM_EMAIL || 'noreply@aerotage.com';
                    subject = delivery.subject || "Report Export - ".concat(exportResult.format.toUpperCase());
                    message = delivery.message || 'Your requested report export is ready for download.';
                    htmlBody = "\n    <html>\n      <body>\n        <h2>Report Export Ready</h2>\n        <p>".concat(message, "</p>\n        <p><strong>Export Details:</strong></p>\n        <ul>\n          <li>Format: ").concat(exportResult.format.toUpperCase(), "</li>\n          <li>File Size: ").concat(Math.round(exportResult.fileSize / 1024), " KB</li>\n          <li>Generated: ").concat(new Date(exportResult.generatedAt).toLocaleString(), "</li>\n          <li>Expires: ").concat(new Date(exportResult.expiresAt).toLocaleString(), "</li>\n        </ul>\n  ");
                    if (delivery.downloadLink && exportResult.downloadUrl) {
                        htmlBody += "\n        <p><a href=\"".concat(exportResult.downloadUrl, "\" style=\"background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;\">Download Report</a></p>\n        <p><small>This download link will expire in ").concat(delivery.expiresIn || 24, " hours.</small></p>\n    ");
                    }
                    htmlBody += "\n        <p>Best regards,<br>Aerotage Team</p>\n      </body>\n    </html>\n  ";
                    textBody = "\nReport Export Ready\n\n".concat(message, "\n\nExport Details:\n- Format: ").concat(exportResult.format.toUpperCase(), "\n- File Size: ").concat(Math.round(exportResult.fileSize / 1024), " KB\n- Generated: ").concat(new Date(exportResult.generatedAt).toLocaleString(), "\n- Expires: ").concat(new Date(exportResult.expiresAt).toLocaleString(), "\n\n").concat(delivery.downloadLink && exportResult.downloadUrl ?
                        "Download Link: ".concat(exportResult.downloadUrl, "\n\nThis download link will expire in ").concat(delivery.expiresIn || 24, " hours.") :
                        'Please contact support for download instructions.', "\n\nBest regards,\nAerotage Team\n  ");
                    _i = 0, _a = delivery.email;
                    _b.label = 1;
                case 1:
                    if (!(_i < _a.length)) return [3 /*break*/, 4];
                    email = _a[_i];
                    command = new client_ses_1.SendEmailCommand({
                        Source: fromEmail,
                        Destination: {
                            ToAddresses: [email],
                        },
                        Message: {
                            Subject: {
                                Data: subject,
                                Charset: 'UTF-8',
                            },
                            Body: {
                                Html: {
                                    Data: htmlBody,
                                    Charset: 'UTF-8',
                                },
                                Text: {
                                    Data: textBody,
                                    Charset: 'UTF-8',
                                },
                            },
                        },
                    });
                    return [4 /*yield*/, sesClient.send(command)];
                case 2:
                    _b.sent();
                    _b.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
