import express from 'express'
import xaiRouter from './xai.js'
import legacySlideshowRouter from './legacy-slideshow.js'
import transcodeRouter from './transcode.js'
import musicRouter from './music.js'
import createRemotionRouter from './remotion.js'

export default function createVideoRouter(PORT) {
  const router = express.Router()

  router.use(xaiRouter)
  router.use(legacySlideshowRouter)
  router.use(transcodeRouter)
  router.use(musicRouter)
  router.use(createRemotionRouter(PORT))

  return router
}
