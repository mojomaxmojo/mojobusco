import express from 'express'
import textRouter from './text.js'
import visionRouter from './vision.js'
import uploadRouter from './upload.js'

const router = express.Router()
router.use(textRouter)
router.use(visionRouter)
router.use(uploadRouter)

export default router
