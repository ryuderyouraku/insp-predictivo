import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { generateUploadSignature } from '@/lib/cloudinary'

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const body = (await request.json()) as { folder?: string }
  if (!body.folder) {
    return NextResponse.json({ error: 'folder es requerido' }, { status: 400 })
  }
  return NextResponse.json(generateUploadSignature(body.folder))
}
