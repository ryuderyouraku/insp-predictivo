-- DropForeignKey
ALTER TABLE "TelegramLinkCode" DROP CONSTRAINT "TelegramLinkCode_userId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "telegramUsername" TEXT;

-- DropTable
DROP TABLE "TelegramLinkCode";

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramUsername_key" ON "User"("telegramUsername");
