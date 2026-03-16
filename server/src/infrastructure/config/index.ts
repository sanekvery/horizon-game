import { config } from 'dotenv';

config();

export const appConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  adminPassword: process.env.ADMIN_PASSWORD || 'horizon2024',
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
} as const;
