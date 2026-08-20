import express from 'express'
import mediaRouter from './media.js'
import tripRouter from './trip.js'
import articleRouter from './article.js'
import placeRouter from './place.js'
import noteRouter from './note.js'
import translateRouter from './translate.js'
import continuityRouter from './continuity.js'

const router = express.Router()
router.use(mediaRouter)
router.use(tripRouter)
router.use(articleRouter)
router.use(placeRouter)
router.use(noteRouter)
router.use(translateRouter)
router.use(continuityRouter)

export default router
