/**
 * Contentplan-Routen — Abhak-Fortschritt der Contentpläne (Phase 2).
 *
 *   GET  /api/assistant/contentplan-state          → { ok, states }
 *   POST /api/assistant/contentplan-state          { planId, state } → { ok }
 *
 * Liegt bewusst UNTER /api/assistant: Das Prefix steht bereits in
 * PROTECTED_API_PREFIXES (src/config/api-auth.js) → NIP-98-Schutz auf
 * beiden Seiten ohne Config-Änderung. req.authorPubkey wird von der
 * requireAuthor-Middleware gesetzt (undefined im Rollout-Modus ohne
 * AI_AUTH_REQUIRED — dann Fallback-Bucket 'unauth', damit die Route
 * trotzdem funktioniert; Sync bleibt trotzdem erst nach Enforce sauber
 * den Autoren zugeordnet).
 *
 * Merge-Strategie: Client merged per Item-Timestamp und POSTet das Ergebnis —
 * der Server ist ein dumb Blob-Store (siehe contentplan-store.js).
 */

import express from 'express'
import { getPlanStates, savePlanState } from '../../services/contentplan-store.js'

const router = express.Router()

// GET /api/assistant/contentplan-state — alle Pläne des Autors
router.get('/api/assistant/contentplan-state', (req, res) => {
  const pubkey = req.authorPubkey || 'unauth'
  try {
    const states = getPlanStates(pubkey)
    res.json({ ok: true, states })
  } catch (error) {
    console.error('[Contentplan] GET fehlgeschlagen:', error.message)
    res.status(500).json({ error: 'Contentplan-State nicht ladbar' })
  }
})

// POST /api/assistant/contentplan-state — State eines Plans speichern
router.post('/api/assistant/contentplan-state', (req, res) => {
  const pubkey = req.authorPubkey || 'unauth'
  const { planId, state } = req.body || {}
  try {
    const saved = savePlanState(pubkey, planId, state)
    if (!saved) {
      return res
        .status(400)
        .json({ error: 'Ungültige Plan-Daten (planId oder state-Shape)' })
    }
    res.json({ ok: true })
  } catch (error) {
    console.error('[Contentplan] POST fehlgeschlagen:', error.message)
    res.status(500).json({ error: 'Contentplan-State nicht speicherbar' })
  }
})

export default router
