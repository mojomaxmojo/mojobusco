/**
 * Pin-Template Definitionen für Pinterest
 * 7 Templates mit Canvas-Rendering in 1000x1500px
 */

// ═══ PINTEREST MARKENFARBEN (aus index.css) ═══
export const BRAND = {
  // Light Mode
  teal: '#0891b2',       // Primary hsl(188 88% 42%)
  tealLight: '#22d3ee',
  coral: '#e11d48',      // Accent hsl(349 83% 51%)
  coralLight: '#fb7185',
  bg: '#f0f9ff',
  dark: '#0f172a',       // background-950
  card: '#ffffff',
  text: '#1e293b',
  textMuted: '#64748b',
  white: '#ffffff',
  overlay: 'rgba(15,23,42,0.6)'
}

// Canvas-Größe
export const PIN_W = 1000
export const PIN_H = 1500

// ═══ CANVAS HILFSFUNKTIONEN ═══

async function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Bild nicht ladbar: ' + url))
    img.src = url
  })
}

function fillRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
  ctx.fill()
}

function strokeRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string, lineWidth = 2) {
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
  ctx.stroke()
}

function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)

  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight))
  return lines.length * lineHeight
}

function drawCenteredWrappedText(ctx: CanvasRenderingContext2D, text: string, centerX: number, y: number, maxWidth: number, lineHeight: number): number {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)

  lines.forEach((l) => ctx.fillText(l, centerX, y))
  return lines.length * lineHeight
}

// ═══ TEMPLATE RENDERER ═══

interface PinData {
  pinTitle?: string
  pinDescription?: string
  hashtags?: string[]
  altText?: string
  textOverlay?: string
  subOverlay?: string
  listItems?: string[]
  steps?: string[]
  quote?: string
  tip?: string
  beforeText?: string
  afterText?: string
  waypoints?: string[]
  infographicData?: Array<{ icon: string; label: string; value: string }>
}

export type PinTemplateType =
  | 'infographic' | 'listicle' | 'howto'
  | 'testimonial' | 'quicktip' | 'beforeafter' | 'route'

export async function renderPinTemplate(
  imageUrl: string,
  template: PinTemplateType,
  data: PinData
): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = PIN_W
  canvas.height = PIN_H
  const ctx = canvas.getContext('2d')!

  // Bild laden
  let img: HTMLImageElement | null = null
  try {
    img = await loadImg(imageUrl)
  } catch {
    // Fallback: einfarbiger Hintergrund
  }

  // ── Hintergrund ═══════════════
  if (img) {
    // Bild zentriert crop (cover)
    const imgRatio = img.width / img.height
    const pinRatio = PIN_W / PIN_H
    let sx = 0, sy = 0, sw = img.width, sh = img.height
    if (imgRatio > pinRatio) {
      sw = img.height * pinRatio
      sx = (img.width - sw) / 2
    } else {
      sh = img.width / pinRatio
      sy = (img.height - sh) / 2
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, PIN_W, PIN_H)
    ctx.fillStyle = BRAND.overlay
    ctx.fillRect(0, 0, PIN_W, PIN_H)
  } else {
    const g = ctx.createLinearGradient(0, 0, PIN_W, PIN_H)
    g.addColorStop(0, BRAND.dark)
    g.addColorStop(1, '#1a2744')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, PIN_W, PIN_H)
  }

  // ═══ TEMPLATE RENDERING ═══

  switch (template) {
    case 'infographic':
      await renderInfographic(ctx, data)
      break
    case 'listicle':
      await renderListicle(ctx, data)
      break
    case 'howto':
      await renderHowTo(ctx, data)
      break
    case 'testimonial':
      await renderTestimonial(ctx, data)
      break
    case 'quicktip':
      await renderQuickTip(ctx, data)
      break
    case 'beforeafter':
      await renderBeforeAfter(ctx, data)
      break
    case 'route':
      await renderRoute(ctx, data)
      break
  }

  // ═══ BRANDING FOOTER ════════
  renderBranding(ctx)

  return canvas.toDataURL('image/jpeg', 0.92)
}

async function renderInfographic(ctx: CanvasRenderingContext2D, d: PinData) {
  // HEADER
  fillRoundRect(ctx, 60, 60, 880, 90, 20, BRAND.teal)
  ctx.fillStyle = BRAND.white
  ctx.font = 'bold 38px Arial, Helvetica, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(d.textOverlay || 'VANLIFE BUDGET', 500, 118)

  // SUB
  if (d.subOverlay) {
    ctx.font = '24px Arial'
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.fillText(d.subOverlay, 500, 190)
  }

  // DATA CARDS
  const dataItems = d.infographicData || [
    { icon: '⛽', label: 'Sprit', value: '320€' },
    { icon: '🏕️', label: 'Camping', value: '200€' },
    { icon: '🍳', label: 'Essen', value: '280€' },
    { icon: '🔧', label: 'Wartung', value: '150€' }
  ]

  let y = 240
  for (const item of dataItems) {
    fillRoundRect(ctx, 80, y, 840, 110, 18, 'rgba(255,255,255,0.12)')
    ctx.font = '38px Arial'
    ctx.textAlign = 'left'
    ctx.fillStyle = BRAND.white
    ctx.fillText(item.icon, 110, y + 72)
    ctx.font = 'bold 28px Arial'
    ctx.fillText(item.label, 175, y + 70)
    ctx.textAlign = 'right'
    ctx.font = 'bold 34px Arial'
    ctx.fillStyle = BRAND.tealLight
    ctx.fillText(item.value, 880, y + 68)
    y += 130
  }

  // TOTAL
  if (y < 1000) {
    fillRoundRect(ctx, 120, y + 10, 760, 80, 20, BRAND.coral)
    ctx.fillStyle = BRAND.white
    ctx.font = 'bold 34px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('💰  Gesamt: 950€/Monat', 500, y + 60)
  }
}

async function renderListicle(ctx: CanvasRenderingContext2D, d: PinData) {
  // HEADER
  const g = ctx.createLinearGradient(60, 60, 940, 60)
  g.addColorStop(0, BRAND.coral)
  g.addColorStop(1, BRAND.teal)
  fillRoundRect(ctx, 60, 60, 880, 90, 20, g)
  ctx.fillStyle = BRAND.white
  ctx.font = 'bold 38px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('⭐  ' + (d.textOverlay || 'TOP LISTE'), 500, 118)

  if (d.subOverlay) {
    ctx.font = '24px Arial'
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.fillText(d.subOverlay, 500, 190)
  }

  // LIST ITEMS
  const items = d.listItems || ['Eintrag 1', 'Eintrag 2', 'Eintrag 3', 'Eintrag 4', 'Eintrag 5']
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣']
  let y = 240

  for (let i = 0; i < Math.min(items.length, 7); i++) {
    const bg = i % 2 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)'
    fillRoundRect(ctx, 80, y, 840, 130, 18, bg)
    ctx.font = '44px Arial'
    ctx.textAlign = 'left'
    ctx.fillStyle = BRAND.white
    ctx.fillText(medals[i] || `${i + 1}`, 110, y + 82)
    ctx.font = 'bold 28px Arial'
    ctx.fillText(items[i], 190, y + 78)
    y += 150
  }
}

async function renderHowTo(ctx: CanvasRenderingContext2D, d: PinData) {
  // HEADER
  fillRoundRect(ctx, 60, 60, 880, 90, 20, BRAND.teal)
  ctx.fillStyle = BRAND.white
  ctx.font = 'bold 38px Arial'
  ctx.textAlign = 'center'
  ctx.fillText(d.textOverlay || '🔧  ANLEITUNG', 500, 118)

  // TITLE
  ctx.fillStyle = BRAND.white
  ctx.font = 'bold 36px Arial'
  ctx.fillText(d.pinTitle || 'So gehts', 500, 200)

  // STEPS
  const steps = d.steps || ['Schritt 1', 'Schritt 2', 'Schritt 3', 'Schritt 4']
  let y = 250

  for (let i = 0; i < Math.min(steps.length, 6); i++) {
    fillRoundRect(ctx, 80, y, 840, 120, 18, 'rgba(255,255,255,0.1)')
    fillRoundRect(ctx, 100, y + 12, 55, 55, 14, BRAND.coral)
    ctx.fillStyle = BRAND.white
    ctx.font = 'bold 30px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`${i + 1}`, 127, y + 50)
    ctx.textAlign = 'left'
    ctx.font = '24px Arial'
    ctx.fillStyle = BRAND.white
    ctx.fillText(steps[i], 180, y + 75)
    y += 140
  }
}

async function renderTestimonial(ctx: CanvasRenderingContext2D, d: PinData) {
  // HEADER
  fillRoundRect(ctx, 100, 80, 800, 80, 20, BRAND.coral)
  ctx.fillStyle = BRAND.white
  ctx.font = 'bold 32px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('⭐  ERFAHRUNGSBERICHT', 500, 132)

  // QUOTE
  const quote = d.quote || '"Ein unvergessliches Erlebnis am Meer."'
  ctx.fillStyle = BRAND.white
  ctx.font = 'italic 34px Georgia, serif'
  ctx.textAlign = 'center'
  drawCenteredWrappedText(ctx, quote, 500, 240, 800, 52)

  // TITLE
  ctx.font = 'bold 30px Arial'
  ctx.fillStyle = BRAND.white
  ctx.fillText(d.pinTitle || '', 500, 1100)
}

async function renderQuickTip(ctx: CanvasRenderingContext2D, d: PinData) {
  // HEADER
  fillRoundRect(ctx, 100, 100, 800, 100, 24, BRAND.teal)
  ctx.fillStyle = BRAND.white
  ctx.font = 'bold 44px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('⚡  QUICK TIP', 500, 165)

  // TIP
  fillRoundRect(ctx, 80, 260, 840, 500, 24, 'rgba(255,255,255,0.12)')
  ctx.fillStyle = BRAND.white
  ctx.font = 'bold 30px Arial'
  ctx.textAlign = 'center'
  drawCenteredWrappedText(ctx, d.tip || 'Immer eine Powerbank dabei haben!', 500, 350, 740, 44)
}

async function renderBeforeAfter(ctx: CanvasRenderingContext2D, d: PinData) {
  // HEADER
  fillRoundRect(ctx, 60, 60, 880, 90, 20, BRAND.teal)
  ctx.fillStyle = BRAND.white
  ctx.font = 'bold 36px Arial'
  ctx.textAlign = 'center'
  ctx.fillText(d.textOverlay || '✨  VORHER → NACHHER', 500, 118)

  // BEFORE
  fillRoundRect(ctx, 80, 200, 840, 280, 24, 'rgba(239,68,68,0.15)')
  strokeRoundRect(ctx, 80, 200, 840, 280, 24, 'rgba(239,68,68,0.5)', 3)
  ctx.fillStyle = '#fca5a5'
  ctx.font = 'bold 28px Arial'
  ctx.textAlign = 'left'
  ctx.fillText('❌  VORHER', 120, 260)
  ctx.fillStyle = BRAND.white
  ctx.font = '24px Arial'
  drawWrappedText(ctx, d.beforeText || 'Zustand vorher', 120, 300, 760, 36)

  // AFTER
  fillRoundRect(ctx, 80, 520, 840, 280, 24, 'rgba(34,197,94,0.15)')
  strokeRoundRect(ctx, 80, 520, 840, 280, 24, 'rgba(34,197,94,0.5)', 3)
  ctx.fillStyle = '#86efac'
  ctx.font = 'bold 28px Arial'
  ctx.fillText('✅  NACHHER', 120, 580)
  ctx.fillStyle = BRAND.white
  ctx.font = '24px Arial'
  drawWrappedText(ctx, d.afterText || 'Zustand nachher', 120, 620, 760, 36)

  // TITLE
  ctx.font = 'bold 30px Arial'
  ctx.fillStyle = BRAND.white
  ctx.textAlign = 'center'
  ctx.fillText(d.pinTitle || '', 500, 900)
}

async function renderRoute(ctx: CanvasRenderingContext2D, d: PinData) {
  // HEADER
  fillRoundRect(ctx, 60, 60, 880, 90, 20, BRAND.teal)
  ctx.fillStyle = BRAND.white
  ctx.font = 'bold 38px Arial'
  ctx.textAlign = 'center'
  ctx.fillText(d.textOverlay || '🗺️  UNSERE ROUTE', 500, 118)

  // TITLE
  ctx.font = 'bold 34px Arial'
  ctx.fillText(d.pinTitle || '', 500, 200)

  // WAYPOINTS
  const wps = d.waypoints || ['Start', 'Stop 1', 'Stop 2', 'Ende']
  let y = 250

  for (let i = 0; i < Math.min(wps.length, 8); i++) {
    // Dashed line
    if (i > 0) {
      ctx.strokeStyle = BRAND.tealLight
      ctx.lineWidth = 3
      ctx.setLineDash([6, 8])
      ctx.beginPath()
      ctx.moveTo(150, y - 10)
      ctx.lineTo(150, y + 20)
      ctx.stroke()
      ctx.setLineDash([])
    }
    // Dot
    ctx.beginPath()
    ctx.arc(150, y + 18, 18, 0, Math.PI * 2)
    const isLast = i === Math.min(wps.length, 8) - 1
    ctx.fillStyle = i === 0 ? '#4ade80' : isLast ? '#f87171' : BRAND.teal
    ctx.fill()
    // Label
    ctx.fillStyle = BRAND.white
    ctx.font = '24px Arial'
    ctx.textAlign = 'left'
    ctx.fillText(wps[i], 195, y + 26)
    y += 100
  }
}

function renderBranding(ctx: CanvasRenderingContext2D) {
  // Footer
  const fy = 1250
  fillRoundRect(ctx, 80, fy, 840, 70, 18, 'rgba(0,0,0,0.5)')
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.font = '22px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('🌊 Perpetual Travelers  |  mojobus.co', 500, fy + 44)
}

// ═══ TEMPLATE METADATEN ═══

export const PIN_TEMPLATES = [
  { id: 'infographic' as PinTemplateType, name: 'Infografik', emoji: '📊', desc: 'Budget, Kosten, Statistiken' },
  { id: 'listicle' as PinTemplateType, name: 'Top-Liste', emoji: '📝', desc: 'Rankings, Empfehlungen' },
  { id: 'howto' as PinTemplateType, name: 'Anleitung', emoji: '🔧', desc: 'Step-by-Step, DIY' },
  { id: 'testimonial' as PinTemplateType, name: 'Erfahrungsbericht', emoji: '⭐', desc: 'Reviews, Zitate' },
  { id: 'quicktip' as PinTemplateType, name: 'Quick Tip', emoji: '⚡', desc: 'Schnelle Tipps, Hacks' },
  { id: 'beforeafter' as PinTemplateType, name: 'Vorher/Nachher', emoji: '✨', desc: 'Transformationen' },
  { id: 'route' as PinTemplateType, name: 'Reiseroute', emoji: '🗺️', desc: 'Roadmaps, Strecken' }
]
