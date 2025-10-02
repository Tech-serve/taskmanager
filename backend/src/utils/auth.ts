import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export class AuthUtils {
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  static async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  static generateToken(userId: string): string {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not configured');
    }

    return jwt.sign(
      { userId },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRATION || '24h' } as jwt.SignOptions
    );
  }

  static generateInvitationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  static generateInvitationExpiry(): Date {
    const expiryDays = parseInt(process.env.INVITATION_EXPIRY_DAYS || '7');
    return new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
  }
}