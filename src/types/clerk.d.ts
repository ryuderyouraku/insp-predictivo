import type { Role } from '@prisma/client'

declare global {
  interface UserPublicMetadata {
    role: Role
  }
}

export {}
