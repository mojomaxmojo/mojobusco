import express from 'express'
import mediaRouter from './media.js'
import tripRouter from './trip.js'
import articleRouter from './article.js'
import placeRouter from './place.js'
import noteRouter from './note.js'

const router = express.Router()
router.use(mediaRouter)
router.use(tripRouter)
router.use(articleRouter)
router.use(placeRouter)
router.use(noteRouter)

export default router
