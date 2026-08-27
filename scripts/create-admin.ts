import { prisma } from '../src/lib/prisma'

/** Creates (or promotes) an ADMIN row. Clerk owns credentials — the person just needs to sign in with this email to claim it via the just-in-time link in src/lib/session.ts. */
async function main() {
  const name = process.env.ADMIN_NAME
  const email = process.env.ADMIN_EMAIL

  if (!name || !email) {
    throw new Error('Set ADMIN_NAME and ADMIN_EMAIL env vars before running this script')
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role: 'ADMIN' },
    create: { name, email, role: 'ADMIN' },
  })
  console.log(`Admin user ready: ${user.email} (${user.id}) — sign in at /sign-in with this email to claim it.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
