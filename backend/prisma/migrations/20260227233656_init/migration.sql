-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'CLOSER');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NONE', 'PENDING', 'VERIFIED');

-- CreateEnum
CREATE TYPE "TradeDirection" AS ENUM ('CALL', 'PUT');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('ACTIVE', 'WON', 'LOST', 'DRAW', 'FORCED');

-- CreateEnum
CREATE TYPE "ForcedResult" AS ENUM ('WIN', 'LOSS', 'AUTO');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'SUCCESS', 'REJECTED');

-- CreateEnum
CREATE TYPE "SupportMessageSender" AS ENUM ('USER', 'CLOSER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TradeScenario" AS ENUM ('NORMAL', 'FORCE_WIN', 'FORCE_LOSS');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "tg_id" BIGINT NOT NULL,
    "username" TEXT,
    "role" "AdminRole" NOT NULL DEFAULT 'CLOSER',
    "invite_code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tg_id" BIGINT NOT NULL,
    "username" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "language_code" TEXT,
    "owner_id" TEXT,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "trading_enabled" BOOLEAN NOT NULL DEFAULT true,
    "required_tax" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "last_seen" TIMESTAMP(3),
    "next_trade_result" "ForcedResult" NOT NULL DEFAULT 'AUTO',
    "always_lose" BOOLEAN NOT NULL DEFAULT false,
    "trade_scenario" "TradeScenario" NOT NULL DEFAULT 'NORMAL',
    "closer_display_name" TEXT,
    "closer_display_photo" TEXT,
    "kyc_status" "KycStatus" NOT NULL DEFAULT 'NONE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "available" DECIMAL(30,10) NOT NULL DEFAULT 0,
    "locked" DECIMAL(30,10) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BinaryTrade" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "direction" "TradeDirection" NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "entry_price" DECIMAL(20,8) NOT NULL,
    "exit_price" DECIMAL(20,8),
    "expiry_ms" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "pnl" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "status" "TradeStatus" NOT NULL DEFAULT 'ACTIVE',
    "forced_result" "ForcedResult" NOT NULL DEFAULT 'AUTO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at" TIMESTAMP(3),

    CONSTRAINT "BinaryTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "asset" TEXT NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "fee" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "tx_hash" TEXT,
    "address" TEXT,
    "processed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycRequest" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "document_url" TEXT NOT NULL,
    "selfie_url" TEXT,
    "status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "reviewer_id" TEXT,
    "reject_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "KycRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sender" "SupportMessageSender" NOT NULL,
    "text" TEXT NOT NULL,
    "tg_msg_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_tg_id_key" ON "Admin"("tg_id");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_invite_code_key" ON "Admin"("invite_code");

-- CreateIndex
CREATE INDEX "Admin_tg_id_idx" ON "Admin"("tg_id");

-- CreateIndex
CREATE INDEX "Admin_invite_code_idx" ON "Admin"("invite_code");

-- CreateIndex
CREATE UNIQUE INDEX "User_tg_id_key" ON "User"("tg_id");

-- CreateIndex
CREATE INDEX "User_tg_id_idx" ON "User"("tg_id");

-- CreateIndex
CREATE INDEX "User_owner_id_idx" ON "User"("owner_id");

-- CreateIndex
CREATE INDEX "User_last_seen_idx" ON "User"("last_seen");

-- CreateIndex
CREATE INDEX "User_created_at_idx" ON "User"("created_at");

-- CreateIndex
CREATE INDEX "Asset_user_id_idx" ON "Asset"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_user_id_symbol_key" ON "Asset"("user_id", "symbol");

-- CreateIndex
CREATE INDEX "BinaryTrade_user_id_idx" ON "BinaryTrade"("user_id");

-- CreateIndex
CREATE INDEX "BinaryTrade_expires_at_idx" ON "BinaryTrade"("expires_at");

-- CreateIndex
CREATE INDEX "BinaryTrade_status_idx" ON "BinaryTrade"("status");

-- CreateIndex
CREATE INDEX "Transaction_user_id_idx" ON "Transaction"("user_id");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE INDEX "KycRequest_user_id_idx" ON "KycRequest"("user_id");

-- CreateIndex
CREATE INDEX "KycRequest_status_idx" ON "KycRequest"("status");

-- CreateIndex
CREATE INDEX "SupportMessage_user_id_idx" ON "SupportMessage"("user_id");

-- CreateIndex
CREATE INDEX "SupportMessage_created_at_idx" ON "SupportMessage"("created_at");

-- CreateIndex
CREATE INDEX "EventLog_user_id_idx" ON "EventLog"("user_id");

-- CreateIndex
CREATE INDEX "EventLog_event_idx" ON "EventLog"("event");

-- CreateIndex
CREATE INDEX "EventLog_created_at_idx" ON "EventLog"("created_at");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BinaryTrade" ADD CONSTRAINT "BinaryTrade_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycRequest" ADD CONSTRAINT "KycRequest_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
