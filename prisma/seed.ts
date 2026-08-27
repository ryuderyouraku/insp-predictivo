import { prisma } from '../src/lib/prisma'

/**
 * Clerk owns credentials now, so this only seeds the Postgres row an ADMIN needs to exist
 * before anyone can sign in. Register in Clerk with this same email — the just-in-time link
 * in src/lib/session.ts matches your Clerk account to this row on first sign-in.
 */
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@insp.local'
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`Seed admin ${email} already exists, skipping.`)
    return
  }
  await prisma.user.create({
    data: { name: 'Administrador', email, role: 'ADMIN' },
  })
  console.log(`Seed admin created: ${email} — sign in at /sign-in with this email to claim it.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
