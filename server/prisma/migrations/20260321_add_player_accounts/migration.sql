-- Фаза 5.5: Аккаунты игроков
-- Добавление моделей User, AuthSession, PlayerProfile, PlayerGameHistory

-- ============================================
-- ПОЛЬЗОВАТЕЛИ
-- ============================================

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "verify_token" TEXT,
    "reset_token" TEXT,
    "reset_token_exp" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- ============================================
-- СЕССИИ АВТОРИЗАЦИИ
-- ============================================

CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_sessions_token_key" ON "auth_sessions"("token");
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");
CREATE INDEX "auth_sessions_token_idx" ON "auth_sessions"("token");

ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- ПРОФИЛИ ИГРОКОВ
-- ============================================

CREATE TABLE "player_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar" TEXT,
    "total_xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 0,
    "stats" JSONB NOT NULL DEFAULT '{"strength":5,"agility":5,"negotiation":5,"intellect":5,"charisma":5,"craft":5}',
    "available_points" INTEGER NOT NULL DEFAULT 0,
    "achievements" JSONB NOT NULL DEFAULT '[]',
    "total_games" INTEGER NOT NULL DEFAULT 0,
    "total_wins" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "player_profiles_user_id_key" ON "player_profiles"("user_id");

ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- ИСТОРИЯ ИГР
-- ============================================

CREATE TABLE "player_game_history" (
    "id" TEXT NOT NULL,
    "player_profile_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role_id" INTEGER NOT NULL,
    "role_name" TEXT NOT NULL,
    "xp_earned" INTEGER NOT NULL DEFAULT 0,
    "stats_snapshot" JSONB NOT NULL,
    "team_won" BOOLEAN NOT NULL DEFAULT false,
    "personal_score" INTEGER,
    "played_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,
    "achievements_unlocked" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "player_game_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "player_game_history_player_profile_id_idx" ON "player_game_history"("player_profile_id");
CREATE INDEX "player_game_history_session_id_idx" ON "player_game_history"("session_id");

ALTER TABLE "player_game_history" ADD CONSTRAINT "player_game_history_player_profile_id_fkey"
    FOREIGN KEY ("player_profile_id") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "player_game_history" ADD CONSTRAINT "player_game_history_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- ОБНОВЛЕНИЕ СУЩЕСТВУЮЩИХ ТАБЛИЦ
-- ============================================

-- Добавить BASIC в SubscriptionType (если не существует)
-- PostgreSQL не поддерживает ALTER TYPE ADD VALUE в транзакции, поэтому делаем это отдельно
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'BASIC' AND enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'SubscriptionType'
    )) THEN
        ALTER TYPE "SubscriptionType" ADD VALUE 'BASIC' AFTER 'FREE';
    END IF;
END $$;

-- Добавить связь session_players -> player_profiles
ALTER TABLE "session_players" ADD COLUMN IF NOT EXISTS "player_profile_id" TEXT;

CREATE INDEX IF NOT EXISTS "session_players_player_profile_id_idx" ON "session_players"("player_profile_id");

ALTER TABLE "session_players"
    DROP CONSTRAINT IF EXISTS "session_players_player_profile_id_fkey";

ALTER TABLE "session_players" ADD CONSTRAINT "session_players_player_profile_id_fkey"
    FOREIGN KEY ("player_profile_id") REFERENCES "player_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
