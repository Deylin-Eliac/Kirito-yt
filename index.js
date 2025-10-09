import express from 'express';
import axios from 'axios';
import cheerio from 'cheerio';
import ytDlp from 'yt-dlp-exec';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/download', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Debes pasar la URL de YouTube' });

  try {
    // === Intento 1: Scraper Y2Mate ===
    try {
      const html = await axios.get('https://www-y2mate.com/es39/youtube-to-mp3/', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      const $ = cheerio.load(html.data);

      // Preparar POST para analizar
      const formData = new URLSearchParams();
      formData.append('url', url);
      formData.append('format', 'mp3');
      formData.append('quality', '128');

      const response = await axios.post('https://www-y2mate.com/mates/en68/analyze/ajax', formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0',
        }
      });

      const $$ = cheerio.load(response.data.result || '');
      const downloadUrl = $$('a').attr('href');

      if (downloadUrl) {
        return res.json({ method: 'y2mate', mp3: downloadUrl });
      }
    } catch (err) {
      console.log('Y2Mate falló, usando yt-dlp...', err.message);
    }

    // === Intento 2: yt-dlp ===
    try {
      const info = await ytDlp(url, {
        dumpSingleJson: true,
        format: 'bestaudio',
        noWarnings: true,
        noCheckCertificates: true,
        preferFreeFormats: true
      });

      const mp3Format = info.formats.find(f => f.ext === 'm4a' || f.ext === 'webm' || f.ext === 'mp3');
      if (!mp3Format) throw new Error('No se pudo obtener formato de audio');

      return res.json({
        method: 'yt-dlp',
        title: info.title,
        uploader: info.uploader,
        mp3: mp3Format.url
      });
    } catch (err) {
      return res.status(500).json({ error: 'Falló yt-dlp: ' + err.message });
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));