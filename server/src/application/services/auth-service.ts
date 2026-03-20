import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient, Facilitator, SubscriptionType } from '@prisma/client';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'horizon-jwt-secret-change-me';
const JWT_EXPIRES_IN = '7d';

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
  subscriptionType: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  token?: string;
  facilitator?: Omit<Facilitator, 'passwordHash'>;
}

export class AuthService {
  async register(email: string, password: string, name?: string): Promise<AuthResult> {
    try {
      // Check if email already exists
      const existing = await prisma.facilitator.findUnique({
        where: { email },
      });

      if (existing) {
        return { success: false, error: 'Email уже зарегистрирован' };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create facilitator
      const facilitator = await prisma.facilitator.create({
        data: {
          email,
          passwordHash,
          name,
        },
      });

      // Generate token
      const token = this.generateToken(facilitator);

      // Remove passwordHash from response
      const { passwordHash: _, ...facilitatorWithoutPassword } = facilitator;

      return {
        success: true,
        token,
        facilitator: facilitatorWithoutPassword,
      };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Ошибка регистрации' };
    }
  }

  async login(email: string, password: string): Promise<AuthResult> {
    try {
      // Find facilitator
      const facilitator = await prisma.facilitator.findUnique({
        where: { email },
      });

      if (!facilitator) {
        return { success: false, error: 'Неверный email или пароль' };
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, facilitator.passwordHash);

      if (!isValidPassword) {
        return { success: false, error: 'Неверный email или пароль' };
      }

      // Generate token
      const token = this.generateToken(facilitator);

      // Remove passwordHash from response
      const { passwordHash: _, ...facilitatorWithoutPassword } = facilitator;

      return {
        success: true,
        token,
        facilitator: facilitatorWithoutPassword,
      };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Ошибка входа' };
    }
  }

  async verifyToken(token: string): Promise<JwtPayload | null> {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
      return payload;
    } catch {
      return null;
    }
  }

  async getFacilitatorById(id: string): Promise<Omit<Facilitator, 'passwordHash'> | null> {
    try {
      const facilitator = await prisma.facilitator.findUnique({
        where: { id },
      });

      if (!facilitator) return null;

      const { passwordHash: _, ...facilitatorWithoutPassword } = facilitator;
      return facilitatorWithoutPassword;
    } catch {
      return null;
    }
  }

  canCreateGameWithPlayers(subscriptionType: SubscriptionType, playerCount: number): boolean {
    if (playerCount <= 4) {
      return true; // Free tier allows up to 4 players
    }

    // More than 4 players requires paid subscription
    return subscriptionType === 'PRO' || subscriptionType === 'ENTERPRISE';
  }

  private generateToken(facilitator: Facilitator): string {
    const payload: JwtPayload = {
      id: facilitator.id,
      email: facilitator.email,
      role: facilitator.role,
      subscriptionType: facilitator.subscriptionType,
    };

    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }
}

export const authService = new AuthService();
