-- CreateEnum
CREATE TYPE "FacilitatorRole" AS ENUM ('FACILITATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "SubscriptionType" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SETUP', 'ACTIVE', 'PAUSED', 'FINISHED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('PLAYER', 'FACILITATOR', 'SYSTEM');

-- CreateTable
CREATE TABLE "facilitators" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "role" "FacilitatorRole" NOT NULL DEFAULT 'FACILITATOR',
    "subscription_type" "SubscriptionType" NOT NULL DEFAULT 'FREE',
    "subscription_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facilitators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" TEXT NOT NULL,
    "facilitator_id" TEXT NOT NULL,
    "code" VARCHAR(8) NOT NULL,
    "name" VARCHAR(255),
    "status" "SessionStatus" NOT NULL DEFAULT 'SETUP',
    "player_count" INTEGER NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "state" JSONB NOT NULL DEFAULT '{}',
    "progression_enabled" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_players" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role_id" INTEGER NOT NULL,
    "player_name" VARCHAR(255),
    "token" VARCHAR(16) NOT NULL,
    "stats" JSONB NOT NULL DEFAULT '{"strength":5,"agility":5,"negotiation":5,"intellect":5,"charisma":5,"craft":5}',
    "experience_gained" INTEGER NOT NULL DEFAULT 0,
    "is_connected" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_logs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "player_id" TEXT,
    "actor_type" "ActorType" NOT NULL,
    "action_type" VARCHAR(50) NOT NULL,
    "action_data" JSONB NOT NULL DEFAULT '{}',
    "game_context" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_events" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "event_id" INTEGER NOT NULL,
    "triggered_by" VARCHAR(50) NOT NULL,
    "choice_made" TEXT,
    "effects_applied" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_progress" (
    "id" TEXT NOT NULL,
    "facilitator_id" TEXT NOT NULL,
    "player_identifier" VARCHAR(255) NOT NULL,
    "role_id" INTEGER NOT NULL,
    "total_games" INTEGER NOT NULL DEFAULT 0,
    "total_experience" INTEGER NOT NULL DEFAULT 0,
    "stats" JSONB NOT NULL DEFAULT '{}',
    "achievements" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "character_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "facilitators_email_key" ON "facilitators"("email");

-- CreateIndex
CREATE UNIQUE INDEX "game_sessions_code_key" ON "game_sessions"("code");

-- CreateIndex
CREATE INDEX "game_sessions_facilitator_id_idx" ON "game_sessions"("facilitator_id");

-- CreateIndex
CREATE INDEX "game_sessions_status_idx" ON "game_sessions"("status");

-- CreateIndex
CREATE INDEX "game_sessions_code_idx" ON "game_sessions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "session_players_token_key" ON "session_players"("token");

-- CreateIndex
CREATE INDEX "session_players_session_id_idx" ON "session_players"("session_id");

-- CreateIndex
CREATE INDEX "session_players_token_idx" ON "session_players"("token");

-- CreateIndex
CREATE INDEX "action_logs_session_id_idx" ON "action_logs"("session_id");

-- CreateIndex
CREATE INDEX "action_logs_created_at_idx" ON "action_logs"("created_at");

-- CreateIndex
CREATE INDEX "game_events_session_id_idx" ON "game_events"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "character_progress_facilitator_id_player_identifier_role_id_key" ON "character_progress"("facilitator_id", "player_identifier", "role_id");

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_facilitator_id_fkey" FOREIGN KEY ("facilitator_id") REFERENCES "facilitators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_players" ADD CONSTRAINT "session_players_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "session_players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_progress" ADD CONSTRAINT "character_progress_facilitator_id_fkey" FOREIGN KEY ("facilitator_id") REFERENCES "facilitators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
