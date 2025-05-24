import { randomBytes, createHash } from 'crypto';

export interface TokenValidationResult {
  isValid: boolean;
  isExpired: boolean;
  tokenHash?: string;
}

export class TokenService {
  private static readonly TOKEN_LENGTH_BYTES = 32;
  private static readonly HASH_ALGORITHM = 'sha256';

  /**
   * Generates a cryptographically secure invitation token
   */
  static generateInvitationToken(): string {
    return randomBytes(this.TOKEN_LENGTH_BYTES).toString('hex');
  }

  /**
   * Creates a hash of the token for secure storage
   */
  static hashToken(token: string): string {
    return createHash(this.HASH_ALGORITHM)
      .update(token)
      .digest('hex');
  }

  /**
   * Validates a token format without checking expiration
   */
  static validateTokenFormat(token: string): boolean {
    // Check if token is a valid hex string of expected length
    const expectedLength = this.TOKEN_LENGTH_BYTES * 2; // hex is 2 chars per byte
    const hexRegex = /^[a-f0-9]+$/i;
    
    return token.length === expectedLength && hexRegex.test(token);
  }

  /**
   * Checks if an invitation is expired
   */
  static isExpired(expiresAt: string): boolean {
    const expirationDate = new Date(expiresAt);
    const now = new Date();
    return now > expirationDate;
  }

  /**
   * Calculates expiration date from now
   */
  static calculateExpirationDate(daysFromNow: number = 7): string {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysFromNow);
    return expirationDate.toISOString();
  }

  /**
   * Formats expiration date for email display
   */
  static formatExpirationDate(expiresAt: string): string {
    const date = new Date(expiresAt);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  }

  /**
   * Validates token and returns comprehensive result
   */
  static validateToken(token: string, storedHash: string, expiresAt: string): TokenValidationResult {
    // Check token format
    if (!this.validateTokenFormat(token)) {
      return { isValid: false, isExpired: false };
    }

    // Check if token hash matches
    const tokenHash = this.hashToken(token);
    const isValid = tokenHash === storedHash;

    // Check expiration
    const isExpired = this.isExpired(expiresAt);

    return {
      isValid,
      isExpired,
      tokenHash: isValid ? tokenHash : undefined,
    };
  }
} 