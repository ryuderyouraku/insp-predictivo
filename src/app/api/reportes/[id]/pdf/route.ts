import { NextResponse } from 'next/server'
import type { Browser } from 'puppeteer-core'
import { getReporteById } from '@/server/actions/reportes'
import { generatePrintToken } from '@/lib/printToken'

export const runtime = 'nodejs'
export const maxDuration = 60

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
      import('@sparticuz/chromium'),
      import('puppeteer-core'),
    ])
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }

  const { default: puppeteer } = await import('puppeteer')
  return puppeteer.launch({ headless: true })
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  let reporte
  try {
    reporte = await getReporteById(params.id)
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!reporte) {
    return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })
  }

  const baseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000'
  const token = generatePrintToken(params.id)
  const printUrl = `${baseUrl}/reportes/${params.id}/print?token=${token}`

  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    const response = await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 30000 })
    if (!response || !response.ok()) {
      throw new Error('No se pudo cargar la vista de impresión del reporte')
    }
    await page.waitForSelector('#print-ready', { timeout: 30000 })

    const tag = escapeHtml(reporte.faja.tag)
    const cliente = escapeHtml(reporte.faja.cliente.nombre)
    const fecha = escapeHtml(new Date(reporte.fecha).toLocaleDateString('es-PE'))

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', bottom: '14mm', left: '14mm', right: '14mm' },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="width:100%;font-size:8px;color:#9ca3af;padding:0 14mm;display:flex;justify-content:space-between;font-family:Arial,sans-serif;">
          <span>${tag}</span>
          <span>${cliente}</span>
        </div>
      `,
      footerTemplate: `
        <div style="width:100%;font-size:8px;color:#9ca3af;padding:0 14mm;display:flex;justify-content:space-between;font-family:Arial,sans-serif;">
          <span>${fecha}</span>
          <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
        </div>
      `,
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="reporte-${params.id}.pdf"`,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al generar el PDF' },
      { status: 500 }
    )
  } finally {
    await browser.close()
  }
}
