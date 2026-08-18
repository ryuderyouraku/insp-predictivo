'use server'

// Unlike every other action in `src/server/actions/`, these are meant to be called by an
// anonymous visitor (the invite link works before the user has ever logged in) — they
// deliberately do NOT call requireUser().

import bcrypt from 'bcryptjs'
import { findValidPasswordSetToken, consumePasswordSetToken } from '@/lib/passwordSetToken'

export interface TokenStatus {
  valid: boolean
  userName?: string
}

export async function validatePasswordSetToken(token: string): Promise<TokenStatus> {
  const result = await findValidPasswordSetToken(token)
  if (!result) return { valid: false }
  return { valid: true, userName: result.userName }
}

export async function submitNewPassword(token: string, password: string): Promise<void> {
  if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres')
  const passwordHash = await bcrypt.hash(password, 10)
  const ok = await consumePasswordSetToken(token, passwordHash)
  if (!ok) throw new Error('El enlace expiró o ya fue usado. Pide al administrador que te reenvíe la invitación.')
}
