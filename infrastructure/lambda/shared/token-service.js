"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenService = void 0;
var crypto_1 = require("crypto");
var TokenService = /** @class */ (function () {
    function TokenService() {
    }
    /**
     * Generates a cryptographically secure invitation token
     */
    TokenService.generateInvitationToken = function () {
        return (0, crypto_1.randomBytes)(this.TOKEN_LENGTH_BYTES).toString('hex');
    };
    /**
     * Creates a hash of the token for secure storage
     */
    TokenService.hashToken = function (token) {
        return (0, crypto_1.createHash)(this.HASH_ALGORITHM)
            .update(token)
            .digest('hex');
    };
    /**
     * Validates a token format without checking expiration
     */
    TokenService.validateTokenFormat = function (token) {
        // Check if token is a valid hex string of expected length
        var expectedLength = this.TOKEN_LENGTH_BYTES * 2; // hex is 2 chars per byte
        var hexRegex = /^[a-f0-9]+$/i;
        return token.length === expectedLength && hexRegex.test(token);
    };
    /**
     * Checks if an invitation is expired
     */
    TokenService.isExpired = function (expiresAt) {
        var expirationDate = new Date(expiresAt);
        var now = new Date();
        return now > expirationDate;
    };
    /**
     * Calculates expiration date from now
     */
    TokenService.calculateExpirationDate = function (daysFromNow) {
        if (daysFromNow === void 0) { daysFromNow = 7; }
        var expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + daysFromNow);
        return expirationDate.toISOString();
    };
    /**
     * Formats expiration date for email display
     */
    TokenService.formatExpirationDate = function (expiresAt) {
        var date = new Date(expiresAt);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });
    };
    /**
     * Validates token and returns comprehensive result
     */
    TokenService.validateToken = function (token, storedHash, expiresAt) {
        // Check token format
        if (!this.validateTokenFormat(token)) {
            return { isValid: false, isExpired: false };
        }
        // Check if token hash matches
        var tokenHash = this.hashToken(token);
        var isValid = tokenHash === storedHash;
        // Check expiration
        var isExpired = this.isExpired(expiresAt);
        return {
            isValid: isValid,
            isExpired: isExpired,
            tokenHash: isValid ? tokenHash : undefined,
        };
    };
    TokenService.TOKEN_LENGTH_BYTES = 32;
    TokenService.HASH_ALGORITHM = 'sha256';
    return TokenService;
}());
exports.TokenService = TokenService;
