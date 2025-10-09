import express from 'express';
import yts from 'yt-search';
import { savetube } from './savetube.js';

const app = express();
const PORT = process.env.PORT || 3000;

// GET /ytmp3?url=...
app.get('/ytmp3', async (req, res) => {
  const urlParam = req.query.url;
  if (!urlParam) return res.status(400).json({ status: false, error: "No URL provided" });

  try {
    const url = savetube.isUrl(urlParam)
      ? urlParam
      : (await yts.search({ query: urlParam, pages: 1 })).videos[0]?.url;

    if (!url) return res.status(404).json({ status: false, error: "No se encontró nada" });

    const dl = await savetube.download(url, 'mp3');
    res.status(dl.status ? 200 : 500).json(dl.status ? dl.result : dl);
  } catch (e) {
    res.status(500).json({ status: false, error: e.message });
  }
});

// GET /ytmp4?url=...
app.get('/ytmp4', async (req, res) => {
  const urlParam = req.query.url;
  if (!urlParam) return res.status(400).json({ status: false, error: "No URL provided" });

  try {
    const url = savetube.isUrl(urlParam)
      ? urlParam
      : (await yts.search({ query: urlParam, pages: 1 })).videos[0]?.url;

    if (!url) return res.status(404).json({ status: false, error: "No se encontró nada" });

    const dl = await savetube.download(url, '720'); // formato '720' para MP4
    res.status(dl.status ? 200 : 500).json(dl.status ? dl.result : dl);
  } catch (e) {
    res.status(500).json({ status: false, error: e.message });
  }
});

app.get('/', (req, res) => res.send('API YT MP3/MP4 funcionando ✅'));

app.listen(PORT, () => console.log(`Servidor iniciado en puerto ${PORT}`));