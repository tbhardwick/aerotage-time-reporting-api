"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.EmailService = void 0;
var client_ses_1 = require("@aws-sdk/client-ses");
var EmailService = /** @class */ (function () {
    function EmailService() {
        this.sesClient = new client_ses_1.SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
        this.fromEmail = process.env.SES_FROM_EMAIL || 'noreply@aerotage.com';
        this.replyToEmail = process.env.SES_REPLY_TO_EMAIL || 'support@aerotage.com';
    }
    EmailService.prototype.sendInvitationEmail = function (recipientEmail, templateData) {
        return __awaiter(this, void 0, void 0, function () {
            var templateName, enhancedData;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        templateName = process.env.INVITATION_TEMPLATE_NAME || "aerotage-user-invitation-".concat(process.env.STAGE);
                        enhancedData = __assign(__assign({}, templateData), { recipientEmail: recipientEmail, companyName: 'Aerotage Design Group, Inc.', supportEmail: this.replyToEmail });
                        return [4 /*yield*/, this.sendTemplatedEmail(recipientEmail, templateName, enhancedData)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EmailService.prototype.sendReminderEmail = function (recipientEmail, templateData) {
        return __awaiter(this, void 0, void 0, function () {
            var templateName, enhancedData;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        templateName = process.env.REMINDER_TEMPLATE_NAME || "aerotage-invitation-reminder-".concat(process.env.STAGE);
                        enhancedData = __assign(__assign({}, templateData), { recipientEmail: recipientEmail, companyName: 'Aerotage Design Group, Inc.', supportEmail: this.replyToEmail });
                        return [4 /*yield*/, this.sendTemplatedEmail(recipientEmail, templateName, enhancedData)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EmailService.prototype.sendWelcomeEmail = function (recipientEmail, templateData) {
        return __awaiter(this, void 0, void 0, function () {
            var templateName, enhancedData;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        templateName = process.env.WELCOME_TEMPLATE_NAME || "aerotage-user-welcome-".concat(process.env.STAGE);
                        enhancedData = __assign(__assign({}, templateData), { recipientEmail: recipientEmail, companyName: 'Aerotage Design Group, Inc.', supportEmail: this.replyToEmail, dashboardUrl: templateData.dashboardUrl || process.env.FRONTEND_BASE_URL || 'https://time.aerotage.com' });
                        return [4 /*yield*/, this.sendTemplatedEmail(recipientEmail, templateName, enhancedData)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EmailService.prototype.sendTemplatedEmail = function (recipientEmail, templateName, templateData) {
        return __awaiter(this, void 0, void 0, function () {
            var command, result, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        command = new client_ses_1.SendTemplatedEmailCommand({
                            Source: this.fromEmail,
                            Destination: {
                                ToAddresses: [recipientEmail],
                            },
                            Template: templateName,
                            TemplateData: JSON.stringify(templateData),
                            ReplyToAddresses: [this.replyToEmail],
                        });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.sesClient.send(command)];
                    case 2:
                        result = _a.sent();
                        console.log('Email sent successfully:', {
                            messageId: result.MessageId,
                            recipient: recipientEmail,
                            template: templateName,
                        });
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        console.error('Failed to send email:', {
                            error: error_1,
                            recipient: recipientEmail,
                            template: templateName,
                        });
                        throw new Error("Failed to send email: ".concat(error_1));
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return EmailService;
}());
exports.EmailService = EmailService;
