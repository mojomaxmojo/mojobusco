/**
 * Pin Template Definitionen
 * Alle Pinterest-kompatiblen Templates mit Canvas-Rendering
 * Farben basierend auf dem bestehenden Design der Webseite
 */

// ═══════════════════════════════════════════════════════════
// Farben (aus src/index.css)
// ═══════════════════════════════════════════════════════════
export const PIN_COLORS = {
  light: {
    primary: '#0891b2',      // Ocean Teal hsl(188, 88%, 42%)
    accent: '#e11d48',       // Coral Pink hsl(349, 83%, 51%)
    background: '#f0f9ff',   // Hellblau
    card: '#ffffff',
    text: '#1e293b',
    textSecondary: '#64748b',
    overlay: 'rgba(15, 23, 42, 0.55)',
    gradient: ['#0891b2', '#0e7490']
  },
  dark: {
    primary: '#22d3ee',      // Helleres Teal für dark mode
    accent: '#fb7185',       // Helleres Coral für dark mode
    background: '#0f172a',   // Midnight hsl(215, 40%, 7%)
    card: '#1e293b',
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    overlay: 'rgba(0, 0, 0, 0.6)',
    gradient: ['#22d3ee', '#06b6d4']
  }
}

// ═══════════════════════════════════════════════════════════
// Canvas-Hilfsfunktionen
// ═══════════════════════════════════════════════════════════

/** Lade ein Bild von URL in ein Canvas Image */
export async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

/** Text automatisch umbrechen für Canvas */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const metrics = ctx.measureText(testLine)
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) lines.push(currentLine)

  return lines
}

/** Zeichne Text mit automatischer Größe und Wrap */
function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  color: string,
  fontWeight: string = 'normal',
  fontFamily: string = 'Arial, sans-serif'
): number {
  ctx.fillStyle = color
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`

  const lines = wrapText(ctx, text, x, y, maxWidth, fontSize * 1.3)
  lines.forEach((line, i) => {
    ctx.fillText(line, x, y + i * fontSize * 1.3)
  })

  return lines.length * fontSize * 1.3 // Rückgabe: Höhe des Blocks
}

/** Zeichne abgerundetes Rechteck */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
  fill: string, stroke?: string
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

// ═══════════════════════════════════════════════════════════
// Template Render-Funktionen
// Jedes Template: 1000×1500px
// ═══════════════════════════════════════════════════════════

/**
 * Template 1: Infografik-Pin
 * Für: Budget, Kosten, Statistiken, Vergleiche
 */
export async function renderInfographic(
  imageUrl: string,
  title: string,
  subtitle: string,
  colors = PIN_COLORS.light
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 1000
  canvas.height = 1500
  const ctx = canvas.getContext('2d')!

  const img = await loadImage(imageUrl)

  // ── Hintergrund: Bild + Overlay ─────────────────────────
  ctx.drawImage(img, 0, 0, 1000, 1500)
  ctx.fillStyle = colors.overlay
  ctx.fillRect(0, 0, 1000, 1500)

  // ── Header Balken ──────────────────────────────────────
  roundRect(ctx, 50, 80, 900, 80, 20, colors.primary)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 36px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('  📊  ' + title, 500, 135)

  // ── Karten-Bereich ─────────────────────────────────────
  roundRect(ctx, 80, 200, 840, 600, 24, 'rgba(0,0,0,0.3)')

  // Beispiel-Daten (würde später aus dem Artikel kommen)
  const dataItems = [
    { icon: '⛽', label: 'Sprit', value: '320€' },
    { icon: '🏕️', label: 'Camping', value: '200€' },
    { icon: '🍳', label: 'Essen', value: '280€' },
    { icon: '🔧', label: 'Wartung', value: '150€' }
  ]

  let yPos = 250
  const cardHeight = 120
  const gap = 20

  for (const item of dataItems) {
    roundRect(ctx, 100, yPos, 800, cardHeight, 16, 'rgba(255,255,255,0.15)')

    // Icon
    ctx.font = '42px Arial'
    ctx.textAlign = 'left'
    ctx.fillText(item.icon, 130, yPos + 70)

    // Label
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 28px Arial'
    ctx.fillText(item.label, 200, yPos + 55)

    // Value
    ctx.fillStyle = colors.primary
    ctx.font = 'bold 32px Arial'
    ctx.textAlign = 'right'
    ctx.fillText(item.value, 870, yPos + 70)

    yPos += cardHeight + gap
  }

  // ── Footer ─────────────────────────────────────────────
  roundRect(ctx, 100, 850, 800, 100, 20, colors.accent)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 36px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('💰 Gesamt: 950€/Monat', 500, 915)

  // Branding
  roundRect(ctx, 100, 1000, 800, 60, 16, 'rgba(0,0,0,0.4)')
  ctx.fillStyle = '#ffffff'
  ctx.font = '22px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('🌊 perennialtravelers  |  mojobus.co', 500, 1040)

  return new Promise(resolve => canvas.toBlob(resolve!, 'image/jpeg', 0.92))
}

/**
 * Template 2: Top-X Listicle
 * Für: "5 beste...", "10 Tipps...", Rankings
 */
export async function renderListicle(
  imageUrl: string,
  title: string,
  items: string[],
  colors = PIN_COLORS.light
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 1000
  canvas.height = 1500
  const ctx = canvas.getContext('2d')!

  const img = await loadImage(imageUrl)

  // ── Hintergrund ─────────────────────────────────────────
  ctx.drawImage(img, 0, 0, 1000, 1500)
  ctx.fillStyle = colors.overlay
  ctx.fillRect(0, 0, 1000, 1500)

  // ── Header ──────────────────────────────────────────────
  const gradient = ctx.createLinearGradient(0, 0, 1000, 120)
  gradient.addColorStop(0, colors.accent)
  gradient.addColorStop(1, colors.primary)

  roundRect(ctx, 50, 40, 900, 120, 24, gradient)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 38px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('⭐  ' + title, 500, 115)

  // ── Item-Liste ──────────────────────────────────────────
  const listItems = items.length > 0 ? items : [
    'Praia da Marinha',
    'Praia do Camilo',
    'Benagil Cave',
    'Praia da Rocha',
    'Boca do Rio'
  ]

  let yPos = 200
  const itemHeight = 160
  const medals = ['🥇', '🥈', '🥉']

  for (let i = 0; i < Math.min(listItems.length, 7); i++) {
    const bg = i % 2 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.08)'
    roundRect(ctx, 80, yPos, 840, itemHeight, 16, bg)

    // Medal
    ctx.font = '48px Arial'
    ctx.textAlign = 'left'
    ctx.fillText(medals[i] || `${i + 1}`, 110, yPos + 95)

    // Text
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 28px Arial'
    ctx.fillText(listItems[i], 190, yPos + 95)

    yPos += itemHeight + 12
  }

  // ── Footer ──────────────────────────────────────────────
  const footerY = 1100 + (Math.min(listItems.length, 7) * 172)
  const safeFooterY = Math.min(footerY, 1280)

  roundRect(ctx, 100, safeFooterY, 800, 60, 16, 'rgba(0,0,0,0.4)')
  ctx.fillStyle = '#ffffff'
  ctx.font = '22px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('🌊 mojobus.co  –  Perpetual Travelers', 500, safeFooterY + 40)

  return new Promise(resolve => canvas.toBlob(resolve!, 'image/jpeg', 0.92))
}

/**
 * Template 3: How-To / Step-by-Step
 * Für: Anleitungen, DIY, Tutorials
 */
export async function renderHowTo(
  imageUrl: string,
  title: string,
  steps: string[],
  colors = PIN_COLORS.light
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 1000
  canvas.height = 1500
  const ctx = canvas.getContext('2d')!

  const img = await loadImage(imageUrl)

  // ── Hintergrund ─────────────────────────────────────────
  ctx.drawImage(img, 0, 0, 1000, 700)
  ctx.fillStyle = colors.overlay
  ctx.fillRect(0, 0, 1000, 1500)

  // ── Header ──────────────────────────────────────────────
  roundRect(ctx, 50, 50, 900, 100, 20, colors.primary)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 34px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('🔧  ANLEITUNG', 500, 115)

  // ── Titel ───────────────────────────────────────────────
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 38px Arial'
  ctx.fillText(title, 500, 210)

  // ── Schritte ────────────────────────────────────────────
  const stepItems = steps.length > 0 ? steps : [
    'Material besorgen',
    'Vorbereitung',
    'Schritt 1',
    'Schritt 2',
    'Fertig!'
  ]

  const stepY = 260
  const stepHeight = 130
  const stepGap = 16

  for (let i = 0; i < Math.min(stepItems.length, 6); i++) {
    const yPos = stepY + i * (stepHeight + stepGap)

    // Schritt-Box
    roundRect(ctx, 100, yPos, 800, stepHeight, 16, 'rgba(255,255,255,0.1)')

    // Schritt-Nummer
    roundRect(ctx, 120, yPos + 10, 60, 60, 30, colors.accent)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 32px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`${i + 1}`, 150, yPos + 50)

    // Schritt-Text
    ctx.fillStyle = '#ffffff'
    ctx.font = '24px Arial'
    ctx.textAlign = 'left'
    ctx.fillText(stepItems[i], 210, yPos + 50)
  }

  // ── Footer ──────────────────────────────────────────────
  const footerY = stepY + Math.min(stepItems.length, 6) * (stepHeight + stepGap) + 30
  const safeFooterY = Math.min(footerY, 1150)

  roundRect(ctx, 100, safeFooterY, 800, 60, 16, 'rgba(0,0,0,0.4)')
  ctx.fillStyle = '#ffffff'
  ctx.font = '22px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('🌊 mojobus.co  –  Perpetual Travelers', 500, safeFooterY + 40)

  return new Promise(resolve => canvas.toBlob(resolve!, 'image/jpeg', 0.92))
}

/**
 * Template 4: Testimonial / Erfahrung
 * Für: Erfahrungsberichte, Reviews
 */
export async function renderTestimonial(
  imageUrl: string,
  title: string,
  quote: string,
  colors = PIN_COLORS.light
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 1000
  canvas.height = 1500
  const ctx = canvas.getContext('2d')!

  const img = await loadImage(imageUrl)

  // ── Hintergrund ─────────────────────────────────────────
  ctx.drawImage(img, 0, 0, 1000, 1500)
  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.fillRect(0, 0, 1000, 1500)

  // ── Header ──────────────────────────────────────────────
  roundRect(ctx, 100, 80, 800, 100, 20, colors.accent)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 32px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('⭐  ERFAHRUNGSBERICHT', 500, 145)

  // ── Zitat ───────────────────────────────────────────────
  const quoteY = 250
  drawTextBlock(
    ctx,
    quote || '"Das war der beste Moment unseres Trips. Einfach atemlos."',
    100, quoteY, 800, 32,
    '#ffffff', 'italic', 'Georgia, serif'
  )

  // ── Title unten ─────────────────────────────────────────
  roundRect(ctx, 80, 1000, 840, 120, 24, 'rgba(255,255,255,0.1)')
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 30px Arial'
  ctx.textAlign = 'center'
  ctx.fillText(title, 500, 1065)

  // ── Footer ──────────────────────────────────────────────
  roundRect(ctx, 100, 1200, 800, 60, 16, 'rgba(0,0,0,0.4)')
  ctx.fillStyle = '#ffffff'
  ctx.font = '22px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('🌊 mojobus.co  –  Perpetual Travelers', 500, 1240)

  return new Promise(resolve => canvas.toBlob(resolve!, 'image/jpeg', 0.92))
}

/**
 * Template 5: Quick Tip
 * Für: Einzelne Tipps, Hacks, Tricks
 */
export async function renderQuickTip(
  imageUrl: string,
  tip: string,
  colors = PIN_COLORS.light
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 1000
  canvas.height = 1500
  const ctx = canvas.getContext('2d')!

  const img = await loadImage(imageUrl)

  // ── Hintergrund ─────────────────────────────────────────
  ctx.drawImage(img, 0, 0, 1000, 1500)
  ctx.fillStyle = colors.overlay
  ctx.fillRect(0, 0, 1000, 1500)

  // ── Header ──────────────────────────────────────────────
  roundRect(ctx, 100, 100, 800, 120, 24, colors.primary)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 44px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('⚡ QUICK TIP', 500, 175)

  // ── Tip Box ─────────────────────────────────────────────
  roundRect(ctx, 80, 280, 840, 600, 32, 'rgba(255,255,255,0.15)')

  drawTextBlock(
    ctx,
    tip || 'Immer eine Powerbank dabei haben. An der Algarve gibt es kaum Steckdosen an den Stränden.',
    130, 350, 740, 34,
    '#ffffff', 'bold', 'Arial'
  )

  // ── Footer ──────────────────────────────────────────────
  roundRect(ctx, 100, 1100, 800, 60, 16, 'rgba(0,0,0,0.4)')
  ctx.fillStyle = '#ffffff'
  ctx.font = '22px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('🌊 mojobus.co  –  Perpetual Travelers', 500, 1140)

  return new Promise(resolve => canvas.toBlob(resolve!, 'image/jpeg', 0.92))
}

/**
 * Template 6: Vorher/Nachher
 * Für: Transformationen, Ausbauten, Renovierungen
 */
export async function renderBeforeAfter(
  imageUrl: string,
  title: string,
  beforeText: string,
  afterText: string,
  colors = PIN_COLORS.light
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 1000
  canvas.height = 1500
  const ctx = canvas.getContext('2d')!

  const img = await loadImage(imageUrl)

  // ── Hintergrund ─────────────────────────────────────────
  ctx.drawImage(img, 0, 0, 1000, 1500)
  ctx.fillStyle = colors.overlay
  ctx.fillRect(0, 0, 1000, 1500)

  // ── Header ──────────────────────────────────────────────
  roundRect(ctx, 50, 50, 900, 100, 20, colors.gradient[0])
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 34px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('✨  VORHER → NACHHER', 500, 115)

  // ── Vorher Box ──────────────────────────────────────────
  roundRect(ctx, 80, 200, 840, 300, 24, 'rgba(255,0,0,0.15)')
  ctx.fillStyle = '#ff6b6b'
  ctx.font = 'bold 28px Arial'
  ctx.textAlign = 'left'
  ctx.fillText('❌ VORHER', 120, 260)
  ctx.fillStyle = '#ffffff'
  ctx.font = '22px Arial'
  drawTextBlock(ctx, beforeText || 'Leerer Van, keine Einrichtung', 120, 300, 760, 24, '#ffffff')

  // ── Nachher Box ─────────────────────────────────────────
  roundRect(ctx, 80, 550, 840, 300, 24, 'rgba(0,255,0,0.15)')
  ctx.fillStyle = '#51cf66'
  ctx.font = 'bold 28px Arial'
  ctx.fillText('✅ NACHHER', 120, 610)
  ctx.fillStyle = '#ffffff'
  ctx.font = '22px Arial'
  drawTextBlock(ctx, afterText || 'Komplett ausgebaut mit Küche und Bett', 120, 650, 760, 24, '#ffffff')

  // ── Footer ──────────────────────────────────────────────
  roundRect(ctx, 100, 1000, 800, 120, 24, colors.accent)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 30px Arial'
  ctx.textAlign = 'center'
  ctx.fillText(title, 500, 1065)

  // Branding
  roundRect(ctx, 100, 1200, 800, 60, 16, 'rgba(0,0,0,0.4)')
  ctx.fillStyle = '#ffffff'
  ctx.font = '22px Arial'
  ctx.fillText('🌊 mojobus.co  –  Perpetual Travelers', 500, 1240)

  return new Promise(resolve => canvas.toBlob(resolve!, 'image/jpeg', 0.92))
}

/**
 * Template 7: Reiseroute
 * Für: Roadmaps, Routen-Planung, Reiseverläufe
 */
export async function renderRoute(
  imageUrl: string,
  title: string,
  waypoints: string[],
  colors = PIN_COLORS.light
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 1000
  canvas.height = 1500
  const ctx = canvas.getContext('2d')!

  const img = await loadImage(imageUrl)

  // ── Hintergrund ─────────────────────────────────────────
  ctx.drawImage(img, 0, 0, 1000, 1500)
  ctx.fillStyle = colors.overlay
  ctx.fillRect(0, 0, 1000, 1500)

  // ── Header ──────────────────────────────────────────────
  roundRect(ctx, 50, 50, 900, 100, 20, colors.primary)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 36px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('🗺️  OUR ROUTE', 500, 115)

  // ── Titel ───────────────────────────────────────────────
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 38px Arial'
  ctx.fillText(title, 500, 200)

  // ── Wegpunkte ───────────────────────────────────────────
  const routeItems = waypoints.length > 0 ? waypoints : [
    'Start: Lissabon',
    'Stop 1: Sintra',
    'Stop 2: Nazaré',
    'Stop 3: Peniche',
    'Ende: Sagres'
  ]

  const routeY = 250
  const routeItemH = 110

  for (let i = 0; i < Math.min(routeItems.length, 8); i++) {
    const yPos = routeY + i * (routeItemH + 8)

    // Verbindungslinie
    if (i > 0) {
      ctx.strokeStyle = colors.primary
      ctx.lineWidth = 3
      ctx.setLineDash([8, 8])
      ctx.beginPath()
      ctx.moveTo(150, yPos - 8)
      ctx.lineTo(150, yPos + 30)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Kreis
    ctx.beginPath()
    ctx.arc(150, yPos + 15, 20, 0, Math.PI * 2)
    ctx.fillStyle = i === 0 ? '#51cf66' : i === Math.min(routeItems.length, 8) - 1 ? '#ff6b6b' : colors.primary
    ctx.fill()

    // Text
    ctx.fillStyle = '#ffffff'
    ctx.font = '24px Arial'
    ctx.textAlign = 'left'
    ctx.fillText(routeItems[i], 200, yPos + 25)
  }

  // ── Footer ──────────────────────────────────────────────
  const footerY = routeY + Math.min(routeItems.length, 8) * (routeItemH + 8) + 30
  const safeFooterY = Math.min(footerY, 1150)

  roundRect(ctx, 100, safeFooterY, 800, 60, 16, 'rgba(0,0,0,0.4)')
  ctx.fillStyle = '#ffffff'
  ctx.font = '22px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('🌊 mojobus.co  –  Perpetual Travelers', 500, safeFooterY + 40)

  return new Promise(resolve => canvas.toBlob(resolve!, 'image/jpeg', 0.92))
}

// ═══════════════════════════════════════════════════════════
// Template-Konfigurationen
// ═══════════════════════════════════════════════════════════

export const PIN_TEMPLATES = [
  {
    id: 'infographic',
    name: 'Infografik',
    emoji: '📊',
    description: 'Kosten, Budget, Statistiken mit Zahlen-Boxen',
    renderer: renderInfographic
  },
  {
    id: 'listicle',
    name: 'Top-X Liste',
    emoji: '📝',
    description: 'Rankings, Empfehlungen, "Die 5 besten..."',
    renderer: renderListicle
  },
  {
    id: 'howto',
    name: 'How-To',
    emoji: '🔧',
    description: 'Schritt-für-Schritt Anleitungen',
    renderer: renderHowTo
  },
  {
    id: 'testimonial',
    name: 'Erfahrungsbericht',
    emoji: '⭐',
    description: 'Reviews, Erfahrungsberichte, Zitate',
    renderer: renderTestimonial
  },
  {
    id: 'quicktip',
    name: 'Quick Tip',
    emoji: '⚡',
    description: 'Einzelne Tipps, Hacks, Tricks',
    renderer: renderQuickTip
  },
  {
    id: 'beforeafter',
    name: 'Vorher/Nachher',
    emoji: '✨',
    description: 'Transformationen, Ausbauten',
    renderer: renderBeforeAfter
  },
  {
    id: 'route',
    name: 'Reiseroute',
    emoji: '🗺️',
    description: 'Roadmaps, Routen, Reiseverläufe',
    renderer: renderRoute
  }
]

// ═══════════════════════════════════════════════════════════
// Hauptfunktion: Pin basierend auf Template rendern
// ═══════════════════════════════════════════════════════════

interface PinRenderOptions {
  templateId: string
  imageUrl: string
  title: string
  subtitle?: string
  items?: string[]
  quote?: string
  steps?: string[]
  tip?: string
  beforeText?: string
  afterText?: string
  waypoints?: string[]
  darkMode?: boolean
}

export async function renderPin(options: PinRenderOptions): Promise<Blob> {
  const { templateId, imageUrl, title, darkMode = false } = options
  const colors = darkMode ? PIN_COLORS.dark : PIN_COLORS.light

  const template = PIN_TEMPLATES.find(t => t.id === templateId)
  if (!template) {
    throw new Error(`Template ${templateId} nicht gefunden`)
  }

  // Renderer aufrufen mit den richtigen Parametern
  switch (templateId) {
    case 'infographic':
      return renderInfographic(imageUrl, title, options.subtitle || '', colors)
    case 'listicle':
      return renderListicle(imageUrl, title, options.items || [], colors)
    case 'howto':
      return renderHowTo(imageUrl, title, options.steps || [], colors)
    case 'testimonial':
      return renderTestimonial(imageUrl, title, options.quote || '', colors)
    case 'quicktip':
      return renderQuickTip(imageUrl, options.tip || '', colors)
    case 'beforeafter':
      return renderBeforeAfter(imageUrl, title, options.beforeText || '', options.afterText || '', colors)
    case 'route':
      return renderRoute(imageUrl, title, options.waypoints || [], colors)
    default:
      return renderInfographic(imageUrl, title, '', colors)
  }
}
