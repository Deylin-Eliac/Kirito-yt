import express from "express"
import fetch from "node-fetch"
import { igdl } from "ruhend-scraper"

const app = express()

app.get("/", (req, res) => {
  res.json({
    author: "Deylin",
    endpoints: ["/Instagram?url=", "/Facebook?url="],
    message: "API activa"
  })
})

app.get("/Instagram", async (req, res) => {
  const { url } = req.query
  if (!url) return res.status(400).json({ estado: false, error: "Falta el parámetro 'url'" })
  const regexInstagram = /^(https?:\/\/)?(www\.)?(instagram\.com|instagr\.am)\/[^\s]+$/i
  if (!regexInstagram.test(url)) return res.status(400).json({ estado: false, error: "URL inválida de Instagram" })
  try {
    const data = await igdl(url)
    res.json({ estado: true, fuente: "Instagram", resultados: data })
  } catch (e) {
    res.status(500).json({ estado: false, error: e.message })
  }
})

app.get("/Facebook", async (req, res) => {
  const { url } = req.query
  if (!url) return res.status(400).json({ estado: false, error: "Falta el parámetro 'url'" })
  const regexFacebook = /^(https?:\/\/)?(www\.)?(facebook\.com|fb\.watch)\/[^\s]+$/i
  if (!regexFacebook.test(url)) return res.status(400).json({ estado: false, error: "URL inválida de Facebook" })
  try {
    const data = await igdl(url)
    res.json({ estado: true, fuente: "Facebook", resultados: data })
  } catch (e) {
    res.status(500).json({ estado: false, error: e.message })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log("API activa en el puerto " + PORT))