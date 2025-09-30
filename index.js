import express from 'express'
import { existsSync } from 'fs'
import { join } from 'path'
import { exec } from 'child_process'
import ytdlp from 'yt-dlp-exec'

const app = express()
const PORT = process.env.PORT || 5000

// Ruta del archivo de cookies (formato Netscape)
const COOKIES_FILE = join(process.cwd(), 'cookies.txt')

app.get('/api/video', async (req, res) => {
  const video_url = req.query.url
  if (!video_url) {
    return res.status(400).json({ status: false, error: "Parámetro 'url' no encontrado" })
  }

  try {
    const ydl_opts = {
      quiet: true,
      no_warnings: true,
      force_ipv4: true,
      skip_download: true,
      cookiefile: existsSync(COOKIES_FILE) ? COOKIES_FILE : undefined,
      dump_single_json: true
    }

    // Extraemos info usando yt-dlp-exec
    const info = await ytdlp(video_url, ydl_opts)

    // Elegir el mejor formato con video+audio
    const video_format = info.formats
      .filter(f => f.vcodec !== 'none' && f.acodec !== 'none')
      .sort((a, b) => (b.height || 0) - (a.height || 0))[0]

    let filesize = undefined
    if (video_format?.filesize) {
      filesize = Math.round(video_format.filesize / (1024 * 1024) * 100) / 100
    }

    const response = {
      status: true,
      creator: "Deylin",
      res: {
        title: info.title,
        artist: info.uploader,
        duration: info.duration, // segundos
        thumbnail: info.thumbnail,
        format: video_format?.ext || 'mp4',
        quality: `${video_format?.height || 'Desconocido'}p`,
        filesize: filesize ? `${filesize} MB` : 'Desconocido',
        url: video_format?.url
      }
    }

    return res.json(response)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ status: false, error: err.message })
  }
})

app.listen(PORT, () => console.log(`Server listening on http://0.0.0.0:${PORT}`))