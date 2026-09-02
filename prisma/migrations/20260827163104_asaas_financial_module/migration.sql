/*
  Warnings:

  - A unique constraint covering the columns `[asaasAccountId]` on the table `arenas` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[asaasWalletId]` on the table `arenas` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[asaasPaymentId]` on the table `payments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[asaasCustomerId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PlanBillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'ANNUALLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PENDING', 'OVERDUE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SplitType" AS ENUM ('PERCENTAGE', 'FIXED');

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "arenas" ADD COLUMN     "asaasAccountId" TEXT,
ADD COLUMN     "asaasWalletId" TEXT,
ADD COLUMN     "isPayoutEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "platformFeePercent" DECIMAL(5,2) DEFAULT 5.00;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "asaasPaymentId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "asaasCustomerId" TEXT;

-- CreateTable
CREATE TABLE "platform_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "billingCycle" "PlanBillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "maxCourts" INTEGER,
    "maxStaff" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arena_subscriptions" (
    "id" TEXT NOT NULL,
    "arenaId" TEXT NOT NULL,
    "platformPlanId" TEXT NOT NULL,
    "asaasSubscriptionId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "currentCycleStart" TIMESTAMP(3) NOT NULL,
    "currentCycleEnd" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arena_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arena_membership_plans" (
    "id" TEXT NOT NULL,
    "arenaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "billingCycle" "PlanBillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arena_membership_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athlete_memberships" (
    "id" TEXT NOT NULL,
    "arenaMembershipPlanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "asaasSubscriptionId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "currentCycleStart" TIMESTAMP(3) NOT NULL,
    "currentCycleEnd" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "arena_subscriptions_asaasSubscriptionId_key" ON "arena_subscriptions"("asaasSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "athlete_memberships_asaasSubscriptionId_key" ON "athlete_memberships"("asaasSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "arenas_asaasAccountId_key" ON "arenas"("asaasAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "arenas_asaasWalletId_key" ON "arenas"("asaasWalletId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_asaasPaymentId_key" ON "payments"("asaasPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "users_asaasCustomerId_key" ON "users"("asaasCustomerId");

-- AddForeignKey
ALTER TABLE "arena_subscriptions" ADD CONSTRAINT "arena_subscriptions_arenaId_fkey" FOREIGN KEY ("arenaId") REFERENCES "arenas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_subscriptions" ADD CONSTRAINT "arena_subscriptions_platformPlanId_fkey" FOREIGN KEY ("platformPlanId") REFERENCES "platform_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_membership_plans" ADD CONSTRAINT "arena_membership_plans_arenaId_fkey" FOREIGN KEY ("arenaId") REFERENCES "arenas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_memberships" ADD CONSTRAINT "athlete_memberships_arenaMembershipPlanId_fkey" FOREIGN KEY ("arenaMembershipPlanId") REFERENCES "arena_membership_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_memberships" ADD CONSTRAINT "athlete_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
