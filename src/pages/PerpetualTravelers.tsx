import { useState, type ChangeEvent } from 'react'
import { getApiBaseUrl } from '@/lib/apiBase'

export function PerpetualTravelers() {
  const [images, setImages] = useState<File[]>([])
  const [text, setText] = useState('')
  const [article, setArticle] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [loading, setLoading] = useState(false)

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 10) {
      alert('Max 10 Bilder erlaubt')
      return
    }
    setImages(files)
  }

  const generateArticle = async () => {
    if (images.length === 0 || text.trim() === '') {
      alert('Bilder und Text erforderlich')
      return
    }
    setLoading(true)
    try {
      const formData = new FormData()
      images.forEach(img => formData.append('images', img))
      formData.append('text', text)
      const response = await fetch(`${getApiBaseUrl()}/api/generate-article`, {
        method: 'POST',
        body: formData
      })
      const data = await response.json()
      setArticle(data.article)
    } catch (error) {
      console.error(error)
    }
    setLoading(false)
  }

  const generateVideo = async () => {
    if (!article) {
      alert('Artikel zuerst generieren')
      return
    }
    setLoading(true)
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/generate-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article, imageUrls: images.map(img => img.name) })
      })
      const data = await response.json()
      setVideoUrl(data.videoUrl)
    } catch (error) {
      console.error(error)
    }
    setLoading(false)
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">🌊 Perpetual Travelers - Unser Leben am Meer</h1>
      <p className="mb-6">Geschichten, Tipps und Einblicke zwischen Sand und Horizont</p>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Bilder hochladen (1-10, max 10MB)</label>
        <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="border p-2" />
        <p>{images.length} Bilder ausgewählt</p>
      </div>

      <textarea
        placeholder="Stichworte eingeben (z.B. Abenteuer, Wellen, Sonnenuntergang)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="border p-2 w-full mb-4"
        maxLength={500}
      />

      <button onClick={generateArticle} disabled={loading} className="bg-blue-500 text-white px-4 py-2 mr-2">
        Artikel generieren
      </button>
      <button onClick={generateVideo} disabled={loading || !article} className="bg-green-500 text-white px-4 py-2">
        Video generieren
      </button>

      {article && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold">Generierter Artikel:</h2>
          <p>{article}</p>
        </div>
      )}

      {videoUrl && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold">Generiertes Video:</h2>
          <video src={videoUrl} controls preload="none" playsInline />
        </div>
      )}
    </div>
  )
}