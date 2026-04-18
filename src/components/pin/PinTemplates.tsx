/**
 * Pin-Template Definitionen für Pinterest
 * 8 Templates mit Canvas-Rendering in 1000x1500px
 *
 * Templates:
 * - infographic    📊 Infografik / Budget
 * - listicle       📝 Top-Liste
 * - howto          🔧 Anleitung / DIY
 * - testimonial    ⭐ Erfahrungsbericht (Quote-Bubble)
 * - quicktip       ⚡ Quick-Tipp
 * - beforeafter    ✨ Vorher/Nachher
 * - route          🗺️ Reiseroute
 * - mojobus-story  🚌 MojoBus Story (authentisch, minimalistisch)
 */

// ═══ MARKENFARBEN ═══
export const BRAND = {
  teal:        '#0891b2',
  tealLight:   '#22d3ee',
  tealDark:    '#0e7490',
  coral:       '#e11d48',
  coralLight:  '#fb7185',
  coralDark:   '#9f1239',
  amber:       '#d97706',
  amberLight:  '#fbbf24',
  green:       '#16a34a',
  greenLight:  '#4ade80',
  bg:          '#f0f9ff',
  dark:        '#0f172a',
  darker:      '#020617',
  card:        '#ffffff',
  text:        '#1e293b',
  textMuted:   '#64748b',
  white:       '#ffffff',
  overlay:     'rgba(10,20,40,0.58)',
  overlayHard: 'rgba(10,20,40,0.75)',
}

// Canvas-Größe (Pinterest 2:3)
export const PIN_W = 1000
export const PIN_H = 1500

// ═══ LIFESTYLE BRANDING ═══
const LIFESTYLE_BRANDING: Record<string, { label: string; icon: string; url: string; footer: string }> = {
  mojobus:             { label: 'MojoBus',            icon: '🚌', url: 'mojobus.co', footer: '🚌 MojoBus  ·  mojobus.co' },
  'perpetual-travelers': { label: 'Perpetual Travelers', icon: '🌊', url: 'mojobus.co', footer: '🌊 Perpetual Travelers  ·  mojobus.co' },
  vanlife:             { label: 'Vanlife',             icon: '🚐', url: 'mojobus.co', footer: '🚐 Vanlife  ·  mojobus.co' },
  wohnmobil:           { label: 'Wohnmobil-Leben',    icon: '🏕️', url: 'mojobus.co', footer: '🏕️ Wohnmobil  ·  mojobus.co' },
  rvlife:              { label: 'RV Life',             icon: '🚗', url: 'mojobus.co', footer: '🚗 RV Life  ·  mojobus.co' },
  beachlife:           { label: 'Beach Life',          icon: '🏖️', url: 'mojobus.co', footer: '🏖️ Beach Life  ·  mojobus.co' },
}

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

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number, color: string | CanvasGradient
) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y,     x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x,     y + h, r)
  ctx.arcTo(x,     y + h, x,     y,     r)
  ctx.arcTo(x,     y,     x + w, y,     r)
  ctx.closePath()
  ctx.fill()
}

function strokeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number, color: string, lineWidth = 2
) {
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y,     x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x,     y + h, r)
  ctx.arcTo(x,     y + h, x,     y,     r)
  ctx.arcTo(x,     y,     x + w, y,     r)
  ctx.closePath()
  ctx.stroke()
}

/** Zeilenumbruch-Text, linksbündig – gibt neue Y-Position zurück */
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  maxWidth: number, lineHeight: number,
  maxLines = 99
): number {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
      if (lines.length >= maxLines) break
    } else {
      line = test
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight))
  return y + lines.length * lineHeight
}

/** Zeilenumbruch-Text, zentriert – FIXED VERSION – gibt neue Y-Position zurück */
function drawWrappedTextCenter(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number, y: number,
  maxWidth: number, lineHeight: number,
  maxLines = 99
): number {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
      if (lines.length >= maxLines) break
    } else {
      line = test
    }
  }
  if (line && lines.length < maxLines) lines.push(line)

  const savedAlign = ctx.textAlign
  ctx.textAlign = 'center'
  lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lineHeight))
  ctx.textAlign = savedAlign
  return y + lines.length * lineHeight
}

/** Schatten setzen */
function setShadow(ctx: CanvasRenderingContext2D, blur = 8, color = 'rgba(0,0,0,0.6)') {
  ctx.shadowBlur = blur
  ctx.shadowColor = color
}
function clearShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowBlur = 0
  ctx.shadowColor = 'transparent'
}

// ═══ TYPES ═══

interface PinData {
  pinTitle?:       string
  pinDescription?: string
  hashtags?:       string[]
  altText?:        string
  textOverlay?:    string
  subOverlay?:     string
  listItems?:      string[]
  steps?:          string[]
  quote?:          string
  tip?:            string
  beforeText?:     string
  afterText?:      string
  waypoints?:      string[]
  storyTag?:       string
  infographicData?: Array<{ icon: string; label: string; value: string }>
}

export type PinTemplateType =
  | 'infographic' | 'listicle' | 'howto'
  | 'testimonial' | 'quicktip' | 'beforeafter'
  | 'route' | 'mojobus-story'

// ═══════════════════════════════════════════════════════════
// HAUPT-RENDERER
// ═══════════════════════════════════════════════════════════

export async function renderPinTemplate(
  imageUrl: string,
  template: PinTemplateType,
  data: PinData,
  lifestyle = 'mojobus'
): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width  = PIN_W
  canvas.height = PIN_H
  const ctx = canvas.getContext('2d')!

  // Bild laden
  let img: HTMLImageElement | null = null
  try { img = await loadImg(imageUrl) } catch { /* Fallback */ }

  // ── Hintergrund: Bild (cover) oder Gradient ──
  if (img) {
    const ir = img.width / img.height
    const pr = PIN_W / PIN_H
    let sx = 0, sy = 0, sw = img.width, sh = img.height
    if (ir > pr) { sw = img.height * pr; sx = (img.width - sw) / 2 }
    else          { sh = img.width / pr;  sy = (img.height - sh) / 2 }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, PIN_W, PIN_H)

    // Template-spezifisches Overlay
    if (template === 'mojobus-story') {
      // Story: sanftes Gradient-Overlay, Bild dominiert
      const g = ctx.createLinearGradient(0, 0, 0, PIN_H)
      g.addColorStop(0,   'rgba(0,0,0,0.08)')
      g.addColorStop(0.5, 'rgba(0,0,0,0.0)')
      g.addColorStop(0.72,'rgba(0,0,0,0.45)')
      g.addColorStop(1,   'rgba(0,0,0,0.82)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, PIN_W, PIN_H)
    } else {
      // Standard: gleichmäßiges dunkles Overlay
      ctx.fillStyle = BRAND.overlay
      ctx.fillRect(0, 0, PIN_W, PIN_H)
    }
  } else {
    const g = ctx.createLinearGradient(0, 0, PIN_W, PIN_H)
    g.addColorStop(0, BRAND.dark)
    g.addColorStop(1, '#162032')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, PIN_W, PIN_H)
  }

  // ── Template rendern ──
  switch (template) {
    case 'infographic':    renderInfographic(ctx, data);  break
    case 'listicle':       renderListicle(ctx, data);     break
    case 'howto':          renderHowTo(ctx, data);        break
    case 'testimonial':    renderTestimonial(ctx, data);  break
    case 'quicktip':       renderQuickTip(ctx, data);     break
    case 'beforeafter':    renderBeforeAfter(ctx, data);  break
    case 'route':          renderRoute(ctx, data);        break
    case 'mojobus-story':  renderMojoBusStory(ctx, data); break
  }

  // ── Branding Footer ──
  renderBranding(ctx, lifestyle)

  return canvas.toDataURL('image/jpeg', 0.93)
}

// ═══════════════════════════════════════════════════════════
// TEMPLATE: INFOGRAFIK
// ═══════════════════════════════════════════════════════════

function renderInfographic(ctx: CanvasRenderingContext2D, d: PinData) {
  // Header-Gradient
  const hg = ctx.createLinearGradient(60, 55, 940, 55)
  hg.addColorStop(0, BRAND.tealDark)
  hg.addColorStop(1, BRAND.teal)
  fillRoundRect(ctx, 60, 55, 880, 95, 22, hg)

  setShadow(ctx, 6)
  ctx.fillStyle = BRAND.white
  ctx.font = 'bold 40px Arial, Helvetica, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText((d.textOverlay || 'INFOGRAFIK').toUpperCase().substring(0, 22), 500, 116)
  clearShadow(ctx)

  // Sub
  if (d.subOverlay) {
    ctx.font = '24px Arial'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.textAlign = 'center'
    ctx.fillText(d.subOverlay.substring(0, 55), 500, 196)
  }

  // Data Cards
  const items = (d.infographicData && d.infographicData.length > 0)
    ? d.infographicData
    : [
        { icon: '⛽', label: 'Sprit',   value: '?' },
        { icon: '🏕️', label: 'Camping', value: '?' },
        { icon: '💰', label: 'Gesamt',  value: '?' },
      ]

  const startY = d.subOverlay ? 230 : 195
  const cardH  = Math.min(130, Math.floor((1100 - startY) / items.length))
  let y = startY

  for (const item of items.slice(0, 6)) {
    // Card bg mit leichtem Hover-Effekt
    fillRoundRect(ctx, 75, y, 850, cardH - 8, 18, 'rgba(255,255,255,0.11)')
    strokeRoundRect(ctx, 75, y, 850, cardH - 8, 18, 'rgba(255,255,255,0.08)', 1)

    const midY = y + (cardH - 8) / 2 + 14

    // Icon
    ctx.font = `${Math.min(44, cardH - 20)}px Arial`
    ctx.textAlign = 'left'
    ctx.fillStyle = BRAND.white
    ctx.fillText(item.icon, 108, midY)

    // Label
    ctx.font = `bold ${Math.min(28, cardH - 30)}px Arial`
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fillText(item.label.substring(0, 22), 180, midY - 2)

    // Value – rechts, hervorgehoben
    setShadow(ctx, 4)
    ctx.font = `bold ${Math.min(36, cardH - 20)}px Arial`
    ctx.fillStyle = BRAND.amberLight
    ctx.textAlign = 'right'
    ctx.fillText(item.value.substring(0, 18), 890, midY)
    clearShadow(ctx)

    y += cardH
  }

  // Gesamt-Box
  if (y < 1130) {
    const dg = ctx.createLinearGradient(120, y + 10, 880, y + 10)
    dg.addColorStop(0, BRAND.coral)
    dg.addColorStop(1, BRAND.coralDark)
    fillRoundRect(ctx, 120, y + 10, 760, 72, 22, dg)
    setShadow(ctx, 8)
    ctx.fillStyle = BRAND.white
    ctx.font = 'bold 30px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('mojobus.co  →  mehr Infos', 500, y + 57)
    clearShadow(ctx)
  }
}

// ═══════════════════════════════════════════════════════════
// TEMPLATE: LISTICLE
// ═══════════════════════════════════════════════════════════

function renderListicle(ctx: CanvasRenderingContext2D, d: PinData) {
  // Header Gradient
  const hg = ctx.createLinearGradient(60, 55, 940, 55)
  hg.addColorStop(0, BRAND.coral)
  hg.addColorStop(1, BRAND.teal)
  fillRoundRect(ctx, 60, 55, 880, 95, 22, hg)

  setShadow(ctx, 6)
  ctx.fillStyle = BRAND.white
  ctx.font = 'bold 40px Arial'
  ctx.textAlign = 'center'
  ctx.fillText((d.textOverlay || 'TOP LISTE').toUpperCase().substring(0, 24), 500, 116)
  clearShadow(ctx)

  if (d.subOverlay) {
    ctx.font = '24px Arial'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText(d.subOverlay.substring(0, 55), 500, 196)
  }

  const items = (d.listItems && d.listItems.length > 0)
    ? d.listItems
    : ['Eintrag 1', 'Eintrag 2', 'Eintrag 3', 'Eintrag 4', 'Eintrag 5']

  const startY = d.subOverlay ? 230 : 195
  const count  = Math.min(items.length, 7)
  const cardH  = Math.min(148, Math.floor((1110 - startY) / count))
  let y = startY

  for (let i = 0; i < count; i++) {
    const even = i % 2 === 0
    fillRoundRect(ctx, 75, y, 850, cardH - 10, 18,
      even ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)')

    const midY = y + (cardH - 10) / 2

    // Nummerierter Kreis statt Emoji-Zahlen
    const circleX = 130
    const circleY = midY
    const cr = Math.min(28, (cardH - 10) / 2 - 6)
    ctx.beginPath()
    ctx.arc(circleX, circleY, cr, 0, Math.PI * 2)
    ctx.fillStyle = i === 0 ? BRAND.amberLight : i === 1 ? 'rgba(255,255,255,0.4)' : BRAND.teal
    ctx.fill()
    setShadow(ctx, 4)
    ctx.fillStyle = i <= 1 ? BRAND.dark : BRAND.white
    ctx.font = `bold ${Math.min(26, cr)}px Arial`
    ctx.textAlign = 'center'
    ctx.fillText(`${i + 1}`, circleX, circleY + Math.min(9, cr / 3))
    clearShadow(ctx)

    // Item-Text
    ctx.textAlign = 'left'
    ctx.fillStyle = BRAND.white
    ctx.font = `bold ${Math.min(28, cardH - 28)}px Arial`
    // Text abschneiden wenn zu lang
    let itemText = items[i]
    while (itemText.length > 0 && ctx.measureText(itemText).width > 650) {
      itemText = itemText.slice(0, -1)
    }
    if (itemText.length < items[i].length) itemText += '…'
    ctx.fillText(itemText, 185, midY + Math.min(10, (cardH - 28) / 3))

    y += cardH
  }
}

// ═══════════════════════════════════════════════════════════
// TEMPLATE: HOW-TO
// ═══════════════════════════════════════════════════════════

function renderHowTo(ctx: CanvasRenderingContext2D, d: PinData) {
  // Header
  fillRoundRect(ctx, 60, 55, 880, 95, 22, BRAND.teal)
  setShadow(ctx, 6)
  ctx.fillStyle = BRAND.white
  ctx.font = 'bold 40px Arial'
  ctx.textAlign = 'center'
  ctx.fillText((d.textOverlay || 'ANLEITUNG').toUpperCase().substring(0, 22), 500, 116)
  clearShadow(ctx)

  if (d.subOverlay) {
    ctx.font = '24px Arial'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText(d.subOverlay.substring(0, 55), 500, 192)
  }

  const steps = (d.steps && d.steps.length > 0) ? d.steps : ['Schritt 1', 'Schritt 2', 'Schritt 3']
  const startY = d.subOverlay ? 228 : 195
  const count  = Math.min(steps.length, 5)
  const cardH  = Math.min(155, Math.floor((1115 - startY) / count))
  let y = startY

  for (let i = 0; i < count; i++) {
    fillRoundRect(ctx, 75, y, 850, cardH - 10, 18, 'rgba(255,255,255,0.09)')
    strokeRoundRect(ctx, 75, y, 850, cardH - 10, 18, 'rgba(255,255,255,0.07)', 1)

    const midY = y + (cardH - 10) / 2
    const boxSize = Math.min(55, cardH - 24)

    // Nummerierungsbox
    const dg = ctx.createLinearGradient(100, midY - boxSize / 2, 100, midY + boxSize / 2)
    dg.addColorStop(0, BRAND.coral)
    dg.addColorStop(1, BRAND.coralDark)
    fillRoundRect(ctx, 100, midY - boxSize / 2, boxSize, boxSize, 12, dg)
    setShadow(ctx, 4)
    ctx.fillStyle = BRAND.white
    ctx.font = `bold ${Math.min(28, boxSize - 6)}px Arial`
    ctx.textAlign = 'center'
    ctx.fillText(`${i + 1}`, 100 + boxSize / 2, midY + Math.min(10, (boxSize - 6) / 2.8))
    clearShadow(ctx)

    // Schritt-Text mit Wrap
    ctx.textAlign = 'left'
    ctx.fillStyle = BRAND.white
    ctx.font = `${Math.min(26, cardH - 30)}px Arial`
    drawWrappedText(ctx, steps[i], 180, midY - Math.min(10, (cardH - 30) / 2.5), 700, Math.min(32, cardH / 3), 2)

    y += cardH
  }
}

// ═══════════════════════════════════════════════════════════
// TEMPLATE: TESTIMONIAL (komplett neu – Quote-Bubble)
// ═══════════════════════════════════════════════════════════

function renderTestimonial(ctx: CanvasRenderingContext2D, d: PinData) {
  // Oberer Akzentstreifen
  const hg = ctx.createLinearGradient(0, 0, PIN_W, 0)
  hg.addColorStop(0, BRAND.coral)
  hg.addColorStop(1, BRAND.teal)
  ctx.fillStyle = hg
  ctx.fillRect(0, 0, PIN_W, 12)

  // "ERFAHRUNGSBERICHT" Badge oben
  fillRoundRect(ctx, 200, 55, 600, 68, 34, 'rgba(225,29,72,0.85)')
  setShadow(ctx, 6)
  ctx.fillStyle = BRAND.white
  ctx.font = 'bold 28px Arial'
  ctx.textAlign = 'center'
  ctx.fillText((d.textOverlay || 'ERFAHRUNGSBERICHT').toUpperCase().substring(0, 22), 500, 99)
  clearShadow(ctx)

  // Großes Anführungszeichen
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.font = 'bold 260px Georgia, serif'
  ctx.textAlign = 'left'
  ctx.fillText('"', 52, 440)

  // Quote-Bubble
  const quoteText = d.quote || 'Ein ehrlicher Blick auf das Leben auf Rädern.'
  fillRoundRect(ctx, 70, 200, 860, 480, 28, 'rgba(255,255,255,0.10)')
  strokeRoundRect(ctx, 70, 200, 860, 480, 28, 'rgba(255,255,255,0.18)', 2)

  // Quote Text
  setShadow(ctx, 4)
  ctx.fillStyle = BRAND.white
  ctx.font = 'italic bold 38px Georgia, serif'
  ctx.textAlign = 'center'
  // Mehrzeilig zentriert
  drawWrappedTextCenter(ctx, `"${quoteText}"`, 500, 290, 760, 56, 5)
  clearShadow(ctx)

  // Bubble-Pfeil nach unten
  ctx.fillStyle = 'rgba(255,255,255,0.10)'
  ctx.beginPath()
  ctx.moveTo(450, 680)
  ctx.lineTo(500, 730)
  ctx.lineTo(550, 680)
  ctx.closePath()
  ctx.fill()

  // Sub-Text
  if (d.subOverlay) {
    ctx.font = '26px Arial'
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.textAlign = 'center'
    ctx.fillText(d.subOverlay.substring(0, 55), 500, 790)
  }

  // Sterne
  ctx.font = '44px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('⭐⭐⭐⭐⭐', 500, 880)

  // Pin-Titel
  if (d.pinTitle) {
    setShadow(ctx, 5)
    ctx.font = 'bold 32px Arial'
    ctx.fillStyle = BRAND.amberLight
    ctx.textAlign = 'center'
    drawWrappedTextCenter(ctx, d.pinTitle, 500, 950, 820, 44, 2)
    clearShadow(ctx)
  }

  // Unterer Akzentstreifen
  ctx.fillStyle = hg
  ctx.fillRect(0, PIN_H - 12, PIN_W, 12)
}

// ═══════════════════════════════════════════════════════════
// TEMPLATE: QUICK-TIP
// ═══════════════════════════════════════════════════════════

function renderQuickTip(ctx: CanvasRenderingContext2D, d: PinData) {
  // Blitz-Header
  const hg = ctx.createLinearGradient(60, 55, 940, 55)
  hg.addColorStop(0, BRAND.amber)
  hg.addColorStop(1, BRAND.coral)
  fillRoundRect(ctx, 60, 55, 880, 110, 28, hg)

  setShadow(ctx, 8)
  ctx.fillStyle = BRAND.white
  ctx.font = 'bold 52px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('⚡  ' + (d.textOverlay || 'TIPP').toUpperCase().substring(0, 16), 500, 130)
  clearShadow(ctx)

  // Tipp-Karte
  fillRoundRect(ctx, 65, 215, 870, 550, 30, 'rgba(255,255,255,0.10)')
  strokeRoundRect(ctx, 65, 215, 870, 550, 30, 'rgba(255,255,255,0.18)', 2)

  // Tipp-Text
  const tipText = d.subOverlay || d.tip || 'Kein Tipp angegeben.'
  setShadow(ctx, 4)
  ctx.fillStyle = BRAND.white
  ctx.font = 'bold 36px Arial'
  drawWrappedTextCenter(ctx, tipText, 500, 320, 780, 52, 6)
  clearShadow(ctx)

  // Dekoratives Element unten
  const dg = ctx.createLinearGradient(200, 850, 800, 850)
  dg.addColorStop(0, 'transparent')
  dg.addColorStop(0.5, 'rgba(255,255,255,0.2)')
  dg.addColorStop(1, 'transparent')
  ctx.fillStyle = dg
  ctx.fillRect(200, 855, 600, 2)

  // Pin-Titel
  if (d.pinTitle) {
    ctx.font = '28px Arial'
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.textAlign = 'center'
    drawWrappedTextCenter(ctx, d.pinTitle, 500, 900, 820, 40, 2)
  }
}

// ═══════════════════════════════════════════════════════════
// TEMPLATE: VORHER / NACHHER
// ═══════════════════════════════════════════════════════════

function renderBeforeAfter(ctx: CanvasRenderingContext2D, d: PinData) {
  // Header
  fillRoundRect(ctx, 60, 55, 880, 95, 22, BRAND.teal)
  setShadow(ctx, 6)
  ctx.fillStyle = BRAND.white
  ctx.font = 'bold 38px Arial'
  ctx.textAlign = 'center'
  ctx.fillText((d.textOverlay || 'VORHER → NACHHER').substring(0, 24), 500, 116)
  clearShadow(ctx)

  if (d.subOverlay) {
    ctx.font = '24px Arial'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText(d.subOverlay.substring(0, 55), 500, 192)
  }

  const startY = d.subOverlay ? 225 : 195

  // VORHER Box
  fillRoundRect(ctx, 72, startY,      856, 310, 26, 'rgba(239,68,68,0.13)')
  strokeRoundRect(ctx, 72, startY,    856, 310, 26, 'rgba(239,68,68,0.55)', 2.5)
  ctx.fillStyle = '#fca5a5'
  ctx.font = 'bold 32px Arial'
  ctx.textAlign = 'left'
  setShadow(ctx, 4)
  ctx.fillText('❌  VORHER', 115, startY + 55)
  clearShadow(ctx)
  ctx.fillStyle = BRAND.white
  ctx.font = '26px Arial'
  drawWrappedText(ctx, d.beforeText || '–', 115, startY + 100, 780, 38, 4)

  // Pfeil zwischen den Boxen
  const arrowY = startY + 310 + 22
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = 'bold 54px Arial'
  ctx.textAlign = 'center'
  setShadow(ctx, 8)
  ctx.fillText('↓', 500, arrowY + 44)
  clearShadow(ctx)

  // NACHHER Box
  const afterY = arrowY + 68
  fillRoundRect(ctx, 72, afterY,      856, 310, 26, 'rgba(34,197,94,0.13)')
  strokeRoundRect(ctx, 72, afterY,    856, 310, 26, 'rgba(34,197,94,0.55)', 2.5)
  ctx.fillStyle = '#86efac'
  ctx.font = 'bold 32px Arial'
  ctx.textAlign = 'left'
  setShadow(ctx, 4)
  ctx.fillText('✅  NACHHER', 115, afterY + 55)
  clearShadow(ctx)
  ctx.fillStyle = BRAND.white
  ctx.font = '26px Arial'
  drawWrappedText(ctx, d.afterText || '–', 115, afterY + 100, 780, 38, 4)

  // Pin-Titel
  if (d.pinTitle) {
    const titleY = afterY + 330
    if (titleY < 1160) {
      ctx.font = 'bold 28px Arial'
      ctx.fillStyle = BRAND.amberLight
      ctx.textAlign = 'center'
      drawWrappedTextCenter(ctx, d.pinTitle, 500, titleY, 820, 38, 2)
    }
  }
}

// ═══════════════════════════════════════════════════════════
// TEMPLATE: REISEROUTE
// ═══════════════════════════════════════════════════════════

function renderRoute(ctx: CanvasRenderingContext2D, d: PinData) {
  // Header
  const hg = ctx.createLinearGradient(60, 55, 940, 55)
  hg.addColorStop(0, BRAND.tealDark)
  hg.addColorStop(1, '#0e4f6e')
  fillRoundRect(ctx, 60, 55, 880, 95, 22, hg)
  setShadow(ctx, 6)
  ctx.fillStyle = BRAND.white
  ctx.font = 'bold 38px Arial'
  ctx.textAlign = 'center'
  ctx.fillText((d.textOverlay || 'UNSERE ROUTE').toUpperCase().substring(0, 22), 500, 116)
  clearShadow(ctx)

  if (d.subOverlay) {
    ctx.font = '26px Arial'
    ctx.fillStyle = BRAND.amberLight
    ctx.textAlign = 'center'
    ctx.fillText(d.subOverlay.substring(0, 55), 500, 194)
  }

  const wps = (d.waypoints && d.waypoints.length > 0) ? d.waypoints : ['Start', 'Stop 1', 'Ende']
  const startY = d.subOverlay ? 235 : 200
  const count  = Math.min(wps.length, 8)
  const spacing = Math.min(112, Math.floor((1115 - startY) / count))
  const lineX = 155

  for (let i = 0; i < count; i++) {
    const y = startY + i * spacing

    // Verbindungslinie
    if (i > 0) {
      ctx.strokeStyle = 'rgba(34,211,238,0.5)'
      ctx.lineWidth = 3
      ctx.setLineDash([6, 8])
      ctx.beginPath()
      ctx.moveTo(lineX, y - spacing + 22)
      ctx.lineTo(lineX, y - 2)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Punkt
    const isFirst = i === 0
    const isLast  = i === count - 1
    ctx.beginPath()
    ctx.arc(lineX, y + 20, 20, 0, Math.PI * 2)
    ctx.fillStyle = isFirst ? BRAND.greenLight : isLast ? BRAND.coralLight : BRAND.tealLight
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = 2
    ctx.stroke()

    // Emoji
    ctx.font = '20px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(isFirst ? '🟢' : isLast ? '🔴' : '📍', lineX, y + 26)

    // Waypoint-Text – maxWidth begrenzt
    ctx.textAlign = 'left'
    ctx.fillStyle = BRAND.white
    ctx.font = `bold 28px Arial`
    setShadow(ctx, 4)
    // Text kürzen falls zu lang
    let wpText = wps[i]
    while (wpText.length > 0 && ctx.measureText(wpText).width > 690) wpText = wpText.slice(0, -1)
    if (wpText.length < wps[i].length) wpText += '…'
    ctx.fillText(wpText, 205, y + 28)
    clearShadow(ctx)

    // Kleine Trennlinie
    if (i < count - 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 1
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(200, y + spacing - 8)
      ctx.lineTo(900, y + spacing - 8)
      ctx.stroke()
    }
  }
}

// ═══════════════════════════════════════════════════════════
// TEMPLATE: MOJOBUS STORY (neu – authentisch, minimalistisch)
// ═══════════════════════════════════════════════════════════

function renderMojoBusStory(ctx: CanvasRenderingContext2D, d: PinData) {
  // Das Bild dominiert komplett – nur subtile Text-Elemente unten

  // Kleines Brand-Tag oben links
  const storyTag = d.storyTag || 'mojobus.co'
  fillRoundRect(ctx, 55, 55, Math.min(storyTag.length * 18 + 40, 400), 52, 26, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = 'bold 22px Arial'
  ctx.textAlign = 'left'
  ctx.fillText(storyTag.substring(0, 22), 78, 89)

  // Story-Text unten (Hauptbereich)
  const textAreaY = PIN_H - 460

  // Gradient-Bereich für Text
  const tg = ctx.createLinearGradient(0, textAreaY - 60, 0, PIN_H - 95)
  tg.addColorStop(0, 'rgba(0,0,0,0)')
  tg.addColorStop(1, 'rgba(0,0,0,0.72)')
  ctx.fillStyle = tg
  ctx.fillRect(0, textAreaY - 60, PIN_W, PIN_H - 95 - (textAreaY - 60))

  // Haupt-Story-Zeile
  const mainText = d.textOverlay || ''
  if (mainText) {
    setShadow(ctx, 8, 'rgba(0,0,0,0.8)')
    ctx.fillStyle = BRAND.white
    ctx.font = 'bold 52px Arial'
    ctx.textAlign = 'left'
    drawWrappedText(ctx, mainText, 65, textAreaY + 10, 870, 62, 2)
    clearShadow(ctx)
  }

  // Akzentlinie
  const lineY = textAreaY + (mainText ? 90 : 20)
  const lg = ctx.createLinearGradient(65, lineY, 500, lineY)
  lg.addColorStop(0, BRAND.tealLight)
  lg.addColorStop(1, 'rgba(34,211,238,0)')
  ctx.fillStyle = lg
  ctx.fillRect(65, lineY, 420, 3)

  // Sub-Text
  const subText = d.subOverlay || ''
  if (subText) {
    ctx.fillStyle = 'rgba(255,255,255,0.88)'
    ctx.font = '30px Arial'
    ctx.textAlign = 'left'
    drawWrappedText(ctx, subText, 65, lineY + 28, 870, 42, 3)
  }

  // Pin-Titel (kleine Ergänzung)
  if (d.pinTitle) {
    const titleY = lineY + (subText ? 145 : 45)
    if (titleY < PIN_H - 110) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.font = '22px Arial'
      ctx.textAlign = 'left'
      drawWrappedText(ctx, d.pinTitle, 65, titleY, 870, 30, 2)
    }
  }
}

// ═══════════════════════════════════════════════════════════
// BRANDING FOOTER (dynamisch je nach Lifestyle)
// ═══════════════════════════════════════════════════════════

function renderBranding(ctx: CanvasRenderingContext2D, lifestyle = 'mojobus') {
  const lb = LIFESTYLE_BRANDING[lifestyle] || LIFESTYLE_BRANDING.mojobus
  const fy = PIN_H - 88

  fillRoundRect(ctx, 65, fy, 870, 62, 18, 'rgba(0,0,0,0.60)')
  strokeRoundRect(ctx, 65, fy, 870, 62, 18, 'rgba(255,255,255,0.08)', 1)

  setShadow(ctx, 3)
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = 'bold 24px Arial'
  ctx.textAlign = 'center'
  ctx.fillText(lb.footer, 500, fy + 40)
  clearShadow(ctx)
}

// ═══════════════════════════════════════════════════════════
// TEMPLATE METADATEN
// ═══════════════════════════════════════════════════════════

export const PIN_TEMPLATES = [
  { id: 'mojobus-story' as PinTemplateType, name: 'MojoBus Story',    emoji: '🚌', desc: 'Authentisch, Bild dominiert' },
  { id: 'infographic'   as PinTemplateType, name: 'Infografik',       emoji: '📊', desc: 'Budget, Kosten, Statistiken' },
  { id: 'listicle'      as PinTemplateType, name: 'Top-Liste',        emoji: '📝', desc: 'Rankings, Empfehlungen' },
  { id: 'howto'         as PinTemplateType, name: 'Anleitung',        emoji: '🔧', desc: 'Step-by-Step, DIY' },
  { id: 'testimonial'   as PinTemplateType, name: 'Erfahrungsbericht',emoji: '⭐', desc: 'Quote-Bubble, Zitate' },
  { id: 'quicktip'      as PinTemplateType, name: 'Quick Tip',        emoji: '⚡', desc: 'Schnelle Tipps, Hacks' },
  { id: 'beforeafter'   as PinTemplateType, name: 'Vorher/Nachher',   emoji: '✨', desc: 'Transformationen, Umbau' },
  { id: 'route'         as PinTemplateType, name: 'Reiseroute',       emoji: '🗺️', desc: 'Roadmaps, Touren' },
]
