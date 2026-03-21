/**
 * Player Auth Service
 *
 * Handles player registration, login, email verification,
 * password reset, and profile management.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient, User, PlayerProfile } from '@prisma/client';
import type { CharacterStatsData } from '../../domain/entities/character-stats.js';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'horizon-jwt-secret-change-me';
const JWT_EXPIRES_IN = '7d';
const RESET_TOKEN_EXPIRES_IN = 60 * 60 * 1000; // 1 hour

// ============================================
// Types
// ============================================

export interface PlayerJwtPayload {
  id: string;
  email: string;
  type: 'player';
  playerProfileId?: string;
}

export interface PlayerAuthResult {
  success: boolean;
  error?: string;
  token?: string;
  user?: SafeUser;
  playerProfile?: PlayerProfile;
}

export interface SafeUser {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}

// ============================================
// Service
// ============================================

export class PlayerAuthService {
  /**
   * Register a new player.
   * Creates User + PlayerProfile.
   */
  async register(input: RegisterInput): Promise<PlayerAuthResult> {
    const { email, password, displayName } = input;

    try {
      // Validate email format
      if (!this.isValidEmail(email)) {
        return { success: false, error: 'Некорректный email' };
      }

      // Validate password strength
      if (password.length < 6) {
        return { success: false, error: 'Пароль должен быть не менее 6 символов' };
      }

      // Check if email already exists
      const existing = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existing) {
        return { success: false, error: 'Email уже зарегистрирован' };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Generate verification token
      const verifyToken = this.generateToken();

      // Create user with player profile (transaction)
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          verifyToken,
          playerProfile: {
            create: {
              displayName: displayName.trim(),
            },
          },
        },
        include: {
          playerProfile: true,
        },
      });

      // TODO: Send verification email
      // await this.sendVerificationEmail(user.email, verifyToken);
      console.log(`[PlayerAuth] Verification token for ${email}: ${verifyToken}`);

      // Generate JWT token
      const token = this.generateJwt(user, user.playerProfile);

      return {
        success: true,
        token,
        user: this.toSafeUser(user),
        playerProfile: user.playerProfile || undefined,
      };
    } catch (error) {
      console.error('[PlayerAuth] Registration error:', error);
      return { success: false, error: 'Ошибка регистрации' };
    }
  }

  /**
   * Login player.
   * Creates auth session and returns JWT.
   */
  async login(input: LoginInput): Promise<PlayerAuthResult> {
    const { email, password, userAgent, ipAddress } = input;

    try {
      // Find user
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        include: {
          playerProfile: true,
        },
      });

      if (!user) {
        return { success: false, error: 'Неверный email или пароль' };
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);

      if (!isValidPassword) {
        return { success: false, error: 'Неверный email или пароль' };
      }

      // Generate JWT token
      const token = this.generateJwt(user, user.playerProfile);

      // Create auth session
      const sessionToken = this.generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await prisma.authSession.create({
        data: {
          userId: user.id,
          token: sessionToken,
          userAgent,
          ipAddress,
          expiresAt,
        },
      });

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      return {
        success: true,
        token,
        user: this.toSafeUser(user),
        playerProfile: user.playerProfile || undefined,
      };
    } catch (error) {
      console.error('[PlayerAuth] Login error:', error);
      return { success: false, error: 'Ошибка входа' };
    }
  }

  /**
   * Logout player - invalidate all sessions.
   */
  async logout(userId: string): Promise<{ success: boolean }> {
    try {
      await prisma.authSession.deleteMany({
        where: { userId },
      });
      return { success: true };
    } catch (error) {
      console.error('[PlayerAuth] Logout error:', error);
      return { success: false };
    }
  }

  /**
   * Verify email with token.
   */
  async verifyEmail(token: string): Promise<PlayerAuthResult> {
    try {
      const user = await prisma.user.findFirst({
        where: { verifyToken: token },
        include: { playerProfile: true },
      });

      if (!user) {
        return { success: false, error: 'Неверный или истёкший токен' };
      }

      // Mark as verified
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          verifyToken: null,
        },
        include: { playerProfile: true },
      });

      return {
        success: true,
        user: this.toSafeUser(updatedUser),
        playerProfile: updatedUser.playerProfile || undefined,
      };
    } catch (error) {
      console.error('[PlayerAuth] Verify email error:', error);
      return { success: false, error: 'Ошибка верификации' };
    }
  }

  /**
   * Request password reset - send email with token.
   */
  async requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      // Always return success to prevent email enumeration
      if (!user) {
        return { success: true };
      }

      const resetToken = this.generateToken();
      const resetTokenExp = new Date(Date.now() + RESET_TOKEN_EXPIRES_IN);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExp,
        },
      });

      // TODO: Send reset email
      // await this.sendPasswordResetEmail(user.email, resetToken);
      console.log(`[PlayerAuth] Reset token for ${email}: ${resetToken}`);

      return { success: true };
    } catch (error) {
      console.error('[PlayerAuth] Request reset error:', error);
      return { success: false, error: 'Ошибка запроса сброса пароля' };
    }
  }

  /**
   * Reset password with token.
   */
  async resetPassword(token: string, newPassword: string): Promise<PlayerAuthResult> {
    try {
      if (newPassword.length < 6) {
        return { success: false, error: 'Пароль должен быть не менее 6 символов' };
      }

      const user = await prisma.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExp: { gt: new Date() },
        },
        include: { playerProfile: true },
      });

      if (!user) {
        return { success: false, error: 'Неверный или истёкший токен' };
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          resetToken: null,
          resetTokenExp: null,
        },
        include: { playerProfile: true },
      });

      // Invalidate all sessions
      await prisma.authSession.deleteMany({
        where: { userId: user.id },
      });

      return {
        success: true,
        user: this.toSafeUser(updatedUser),
        playerProfile: updatedUser.playerProfile || undefined,
      };
    } catch (error) {
      console.error('[PlayerAuth] Reset password error:', error);
      return { success: false, error: 'Ошибка сброса пароля' };
    }
  }

  /**
   * Verify JWT token and return payload.
   */
  async verifyJwt(token: string): Promise<PlayerJwtPayload | null> {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as PlayerJwtPayload;
      if (payload.type !== 'player') {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Get user by ID with profile.
   */
  async getUserById(id: string): Promise<{ user: SafeUser; playerProfile: PlayerProfile | null } | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        include: { playerProfile: true },
      });

      if (!user) return null;

      return {
        user: this.toSafeUser(user),
        playerProfile: user.playerProfile,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get player profile with stats.
   */
  async getPlayerProfile(userId: string): Promise<PlayerProfile | null> {
    try {
      return await prisma.playerProfile.findUnique({
        where: { userId },
      });
    } catch {
      return null;
    }
  }

  /**
   * Update player profile.
   */
  async updateProfile(
    userId: string,
    data: { displayName?: string; avatar?: string }
  ): Promise<PlayerProfile | null> {
    try {
      return await prisma.playerProfile.update({
        where: { userId },
        data,
      });
    } catch {
      return null;
    }
  }

  /**
   * Allocate stat points.
   */
  async allocateStatPoints(
    userId: string,
    statName: keyof CharacterStatsData,
    points: number
  ): Promise<{ success: boolean; error?: string; profile?: PlayerProfile }> {
    try {
      const profile = await prisma.playerProfile.findUnique({
        where: { userId },
      });

      if (!profile) {
        return { success: false, error: 'Профиль не найден' };
      }

      if (points <= 0 || points > profile.availablePoints) {
        return { success: false, error: 'Недостаточно очков развития' };
      }

      const stats = profile.stats as unknown as CharacterStatsData;
      const currentValue = stats[statName];
      const maxValue = 15; // Max with progression

      if (currentValue + points > maxValue) {
        return { success: false, error: `${statName} достиг максимума` };
      }

      const newStats = {
        ...stats,
        [statName]: currentValue + points,
      };

      const updatedProfile = await prisma.playerProfile.update({
        where: { userId },
        data: {
          stats: newStats,
          availablePoints: profile.availablePoints - points,
        },
      });

      return { success: true, profile: updatedProfile };
    } catch (error) {
      console.error('[PlayerAuth] Allocate points error:', error);
      return { success: false, error: 'Ошибка распределения очков' };
    }
  }

  // ============================================
  // Game Integration
  // ============================================

  /**
   * Get profile by ID (for linking during game join).
   */
  async getProfileById(profileId: string): Promise<PlayerProfile | null> {
    try {
      return await prisma.playerProfile.findUnique({
        where: { id: profileId },
      });
    } catch {
      return null;
    }
  }

  /**
   * Add XP to player profile after a game.
   * Calculates level ups and available points.
   */
  async addGameXP(
    profileId: string,
    xpGained: number,
    isWin: boolean
  ): Promise<{ success: boolean; newLevel?: number; leveledUp?: boolean; profile?: PlayerProfile }> {
    try {
      const profile = await prisma.playerProfile.findUnique({
        where: { id: profileId },
      });

      if (!profile) {
        return { success: false };
      }

      const oldLevel = profile.level;
      const newTotalXP = profile.totalXP + xpGained;

      // Calculate new level: level = floor(sqrt(totalXP / 50))
      const newLevel = Math.floor(Math.sqrt(newTotalXP / 50));
      const levelsGained = newLevel - oldLevel;
      const newAvailablePoints = profile.availablePoints + (levelsGained * 2);

      const updatedProfile = await prisma.playerProfile.update({
        where: { id: profileId },
        data: {
          totalXP: newTotalXP,
          level: newLevel,
          availablePoints: newAvailablePoints,
          totalGames: profile.totalGames + 1,
          totalWins: isWin ? profile.totalWins + 1 : profile.totalWins,
        },
      });

      console.log(
        `[PlayerAuth] Profile ${profileId}: +${xpGained} XP, Level ${oldLevel} → ${newLevel}`
      );

      return {
        success: true,
        newLevel,
        leveledUp: levelsGained > 0,
        profile: updatedProfile,
      };
    } catch (error) {
      console.error('[PlayerAuth] Add game XP error:', error);
      return { success: false };
    }
  }

  /**
   * Record game to player history.
   */
  async recordGameHistory(
    profileId: string,
    sessionId: string,
    data: {
      roleId: number;
      roleName: string;
      xpEarned: number;
      teamWon: boolean;
      statsSnapshot: Record<string, number>;
    }
  ): Promise<boolean> {
    try {
      await prisma.playerGameHistory.create({
        data: {
          playerProfileId: profileId,
          sessionId,
          roleId: data.roleId,
          roleName: data.roleName,
          xpEarned: data.xpEarned,
          teamWon: data.teamWon,
          statsSnapshot: data.statsSnapshot,
        },
      });

      return true;
    } catch (error) {
      console.error('[PlayerAuth] Record game history error:', error);
      return false;
    }
  }

  // ============================================
  // Private helpers
  // ============================================

  private generateJwt(user: User, playerProfile: PlayerProfile | null): string {
    const payload: PlayerJwtPayload = {
      id: user.id,
      email: user.email,
      type: 'player',
      playerProfileId: playerProfile?.id,
    };

    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }
}

export const playerAuthService = new PlayerAuthService();
