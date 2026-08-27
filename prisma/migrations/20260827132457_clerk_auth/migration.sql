-- Migrate off NextAuth/bcrypt to Clerk: drop all existing users (their
-- passwordHash is meaningless under Clerk), drop the password-set-invite
-- flow, and add clerkId to link User rows to Clerk accounts.

-- DropForeignKey
ALTER TABLE "PasswordSetToken" DROP CONSTRAINT "PasswordSetToken_userId_fkey";

-- DeleteData
DELETE FROM "User";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "mustSetPassword",
DROP COLUMN "passwordHash",
ADD COLUMN     "clerkId" TEXT;

-- DropTable
DROP TABLE "PasswordSetToken";

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");
