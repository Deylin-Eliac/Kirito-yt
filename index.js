import express from "express";
import yts from "yt-search";
import crypto from "crypto";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 3000;

const savetube = {
  api: {
    base: "https://media.savetube.me/api",
    info: "/v2/info",
    download: "/download",
    cdn: "/random-cdn",
  },
  headers: {
    accept: "*/*",
    "content-type": "application/json",
    origin: "https://yt.savetube.me",
    referer: "https://yt.savetube.me/",
    "user-agent": "Postify/1.0.0",
  },
  crypto: {
    hexToBuffer: (hexString) => Buffer.from(hexString.match(/.{1,2}/g).join(""), "hex"),
    decrypt: async (enc) => {
      const secretKey = "C5D58EF67A7584E4A29F6C35BBC4EB12";
      const data = Buffer.from(enc, "base64");
      const iv = data.slice(0, 16);
      const content = data.slice(16);
      const key = savetube.crypto.hexToBuffer(secretKey);
      const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
      const decrypted = Buffer.concat([decipher.update(content), decipher.final()]);
      return JSON.parse(decrypted.toString());
    },
  },
  isUrl: (str) => {
    try { new URL(str); return /youtube.com|youtu.be/.test(str); } catch (_) { return false; }
  },
  youtube: (url) => {
    const patterns = [
      /youtube.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      /youtube.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /youtu.be\/([a-zA-Z0-9_-]{11})/,
    ];
    for (let pattern of patterns) if (pattern.test(url)) return url.match(pattern)[1];
    return null;
  },
  request: async (endpoint, data = {}, method = "post") => {
    try {
      const { data: response } = await axios({
        method,
        url: `${endpoint.startsWith("http") ? "" : savetube.api.base}${endpoint}`,
        data: method === "post" ? data : undefined,
        params: method === "get" ? data : undefined,
        headers: savetube.headers,
      });
      return { status: true, code: 200, data: response };
    } catch (error) {
      return { status: false, code: error.response?.status || 500, error: error.message };
    }
  },
  getCDN: async () => {
    const response = await savetube.request(savetube.api.cdn, {}, "get");
    if (!response.status) return response;
    return { status: true, code: 200, data: response.data.cdn };
  },
  download: async (link, type = "audio") => {
    if (!savetube.isUrl(link)) return { status: false, code: 400, error: "URL inválida" };
    const id = savetube.youtube(link);
    if (!id) return { status: false, code: 400, error: "No se pudo obtener ID del video" };
    try {
      const cdnx = await savetube.getCDN();
      if (!cdnx.status) return cdnx;
      const cdn = cdnx.data;
      const videoInfo = await savetube.request(`https://${cdn}${savetube.api.info}`, {
        url: `https://www.youtube.com/watch?v=${id}`,
      });
      if (!videoInfo.status) return videoInfo;
      const decrypted = await savetube.crypto.decrypt(videoInfo.data.data);
      const downloadData = await savetube.request(`https://${cdn}${savetube.api.download}`, {
        id,
        downloadType: type === "audio" ? "audio" : "video",
        quality: type === "audio" ? "mp3" : "720p",
        key: decrypted.key,
      });
      if (!downloadData.data.data || !downloadData.data.data.downloadUrl)
        return { status: false, code: 500, error: "No se pudo obtener link de descarga" };
      return {
        status: true,
        code: 200,
        result: {
          title: decrypted.title || "Desconocido",
          format: type === "audio" ? "mp3" : "mp4",
          download: downloadData.data.data.downloadUrl,
          thumbnail: decrypted.thumbnail || null,
        },
      };
    } catch (error) {
      return { status: false, code: 500, error: error.message };
    }
  },
});

// --- RUTAS GET ---
app.get("/ytmp3", async (req, res) => {
  const urlParam = req.query.url;
  if (!urlParam) return res.status(400).json({ status: false, error: "No URL provided" });

  try {
    let url = urlParam;
    if (!savetube.isUrl(url)) {
      const search = await yts.search({ query: urlParam, pages: 1 });
      if (!search.videos || search.videos.length === 0)
        return res.status(404).json({ status: false, error: "No se encontró nada" });
      url = search.videos[0].url;
    }

    const dl = await savetube.download(url, "audio");
    if (!dl.status) return res.status(500).json(dl);

    res.json(dl.result);
  } catch (e) {
    res.status(500).json({ status: false, error: e.message });
  }
});

app.get("/ytmp4", async (req, res) => {
  const urlParam = req.query.url;
  if (!urlParam) return res.status(400).json({ status: false, error: "No URL provided" });

  try {
    let url = urlParam;
    if (!savetube.isUrl(url)) {
      const search = await yts.search({ query: urlParam, pages: 1 });
      if (!search.videos || search.videos.length === 0)
        return res.status(404).json({ status: false, error: "No se encontró nada" });
      url = search.videos[0].url;
    }

    const dl = await savetube.download(url, "video");
    if (!dl.status) return res.status(500).json(dl);

    res.json(dl.result);
  } catch (e) {
    res.status(500).json({ status: false, error: e.message });
  }
});

// --- HOME ---
app.get("/", (req, res) => res.send("API YT MP3/MP4 funcionando ✅"));

// --- INICIO SERVIDOR ---
app.listen(PORT, () => console.log(`Servidor iniciado en puerto ${PORT}`));