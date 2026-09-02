-- CreateTable
CREATE TABLE "arena_registration_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "paymentId" TEXT,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arena_registration_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "arena_registration_tokens_token_key" ON "arena_registration_tokens"("token");

-- CreateIndex
CREATE INDEX "arena_registration_tokens_token_idx" ON "arena_registration_tokens"("token");

-- CreateIndex
CREATE INDEX "arena_registration_tokens_email_idx" ON "arena_registration_tokens"("email");

-- AddForeignKey
ALTER TABLE "arena_registration_tokens" ADD CONSTRAINT "arena_registration_tokens_planId_fkey" FOREIGN KEY ("planId") REFERENCES "platform_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
