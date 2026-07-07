// ── Zoom/Pan-Effekte für FFmpeg zoompan ────────────────────────────────────
// 8s × 25fps = 200 Frames/Bild (statt 240 bei 30fps)
//
// Bilder werden VOR zoompan auf Zielgröße skaliert+gecroppt (scale+crop).
// zoompan bekommt also bereits ein 1920x1080 Bild und muss nicht mehr skalieren.
// Das reduziert den Speicherbedarf nochmals deutlich.

const ZOOM_PAN_EFFECTS = [
  // 1. Zoom In Mitte — klassischer Ken Burns
  (d, fps) => `zoompan=z='min(zoom+0.0015,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d * fps}:s=1920x1080:fps=${fps}`,
  // 2. Zoom Out Mitte
  (d, fps) => `zoompan=z='if(eq(on,1),1.5,max(zoom-0.0015,1.0))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d * fps}:s=1920x1080:fps=${fps}`,
  // 3. Pan Links → Rechts
  (d, fps) => `zoompan=z='1.3':x='iw/2-(iw/zoom/2)+on/${d * fps}*(iw-(iw/1.3))':y='ih/2-(ih/zoom/2)':d=${d * fps}:s=1920x1080:fps=${fps}`,
  // 4. Pan Rechts → Links
  (d, fps) => `zoompan=z='1.3':x='iw-(iw/zoom)-on/${d * fps}*(iw-(iw/1.3))':y='ih/2-(ih/zoom/2)':d=${d * fps}:s=1920x1080:fps=${fps}`,
  // 5. Deep Pan Oben → Unten
  (d, fps) => `zoompan=z='1.4':x='iw/2-(iw/zoom/2)':y='0+on/${d * fps}*(ih-(ih/1.4))':d=${d * fps}:s=1920x1080:fps=${fps}`,
  // 6. Deep Pan Unten → Oben
  (d, fps) => `zoompan=z='1.4':x='iw/2-(iw/zoom/2)':y='ih-(ih/zoom)-on/${d * fps}*(ih-(ih/1.4))':d=${d * fps}:s=1920x1080:fps=${fps}`,
  // 7. Zoom In + Pan Diagonal
  (d, fps) => `zoompan=z='min(zoom+0.001,1.4)':x='on/${d * fps}*(iw/4)':y='on/${d * fps}*(ih/4)':d=${d * fps}:s=1920x1080:fps=${fps}`,
  // 8. Zoom Out + Pan Diagonal
  (d, fps) => `zoompan=z='if(eq(on,1),1.4,max(zoom-0.001,1.0))':x='iw/2-(iw/zoom/2)':y='ih-(ih/zoom)-on/${d * fps}*(ih/4)':d=${d * fps}:s=1920x1080:fps=${fps}`,
]

// ── Aspect Ratio → ffmpeg Größe ────────────────────────────────────────────
const ASPECT_SIZES = {
  '16:9': '1920x1080',
  '9:16': '1080x1920',
  '1:1':  '1080x1080',
}

// ── Lifestyle → ElevenLabs Musik-Prompt ───────────────────────────────────
// Hier die Musik-Stile für ElevenLabs anpassen.
// Format: kurze englische Beschreibung, Kommas trennen Eigenschaften.
// Tipps: Tempo (slow/mid/fast), Instrumente, Stimmung, Genre angeben.
// Beispiele: 'cinematic orchestral, epic, slow build, strings and brass'
//            'upbeat electronic, energetic, synth beats, modern'
//            'jazz lounge, smooth, piano and bass, relaxed evening'
const LIFESTYLE_MUSIC_PROMPTS = {
  // 🚌 MojoBus — Hauptprofil
  mojobus:
    'Vintage Americana, a leisurely road trip, the hum of a diesel engine, the open highway, deep house, progressive house, warm and weathered',

  // 🚐 Vanlife
  vanlife:
    'chill acoustic guitar, road trip vibes, slow tempo, warm sunset atmosphere, indie folk',

  // 🏕️ RV Life
  rvlife:
    'americana country folk, open road, relaxed tempo, guitar and harmonica',

  // 🏖️ Beach Life
  beachlife:
    'tropical chill, reggae influence, ocean waves, summer vibes, laid back',

  // 🇩🇪 Wohnmobil
  wohnmobil:
    'european cafe music, accordion, relaxed journey, soft piano',

  // ✈️ Perpetual Travelers
  'perpetual-travelers':
    'world music ambient, travel vibes, ethnic instruments, meditative journey',
}

export { ZOOM_PAN_EFFECTS, ASPECT_SIZES, LIFESTYLE_MUSIC_PROMPTS }