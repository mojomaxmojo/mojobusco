import express from 'express'
import visionRouter from './tiktok/vision.js'
import textRouter from './tiktok/text.js'

const router = express.Router()

router.use(visionRouter)
router.use(textRouter)

export default router
