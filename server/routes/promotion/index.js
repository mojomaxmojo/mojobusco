import express from 'express'
import promotionRoutes from './routes.js'

const router = express.Router()
router.use(promotionRoutes)

export default router
