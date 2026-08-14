-- CreateTable
CREATE TABLE "arena_followers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "arenaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arena_followers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "arena_followers_userId_arenaId_key" ON "arena_followers"("userId", "arenaId");

-- AddForeignKey
ALTER TABLE "arena_followers" ADD CONSTRAINT "arena_followers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_followers" ADD CONSTRAINT "arena_followers_arenaId_fkey" FOREIGN KEY ("arenaId") REFERENCES "arenas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
