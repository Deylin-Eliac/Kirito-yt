import express from "express";
import axios from "axios";
import crypto from "crypto";
import ytdlp from "yt-dlp"; // 🧩 usa el paquete oficial
const app = express();
const PORT = process.env.PORT || 3000;

// Proxy libre para Render
const proxyAPI = "https://g-mini-ia.vercel.app/api/savetube";

const savetube = {
  api: {
    info: "/v2/info",
    download: "/download",
    cdn: "/random-cdn",
  },
  headers: {
    accept: "*/*",
    "content-type": "application/json",
    origin: "https://yt.savetube.me",
    referer: "https://yt.savetube.me/",
    "user-agent": "Mozilla/5.0",
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
      let decrypted = Buffer.concat([decipher.update(content), decipher.final()]);
      return JSON.parse(decrypted.toString());
    },
  },
  isUrl: (str) => {
    try {
      new URL(str);
      return /youtube.com|youtu.be/.test(str);
    } catch {
      return false;
    }
  },
  youtubeId: (url) => {
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
        url: `${proxyAPI}${endpoint}`,
        data: method === "post" ? data : undefined,
        params: method === "get" ? data : undefined,
        headers: savetube.headers,
      });
      return { status: true, data: response };
    } catch (e) {
      return {
        status: false,
        code: e.response?.status || 500,
        error: e.message,
      };
    }
  },
  getCDN: async () => {
    const res = await savetube.request("/cdn", {}, "get");
    if (!res.status) return res;
    return { status: true, cdn: res.data.cdn };
  },
  download: async (url, type = "audio") => {
    if (!savetube.isUrl(url)) return { status: false, error: "URL inválida" };
    const id = savetube.youtubeId(url);
    if (!id) return { status: false, error: "No se pudo obtener ID" };

    try {
      const cdnx = await savetube.getCDN();
      if (!cdnx.status) return cdnx;

      const info = await savetube.request(`/v2/info`, { url: `https://www.youtube.com/watch?v=${id}` });
      if (!info.status) return info;
      const decrypted = await savetube.crypto.decrypt(info.data.data);

      const download = await savetube.request(`/download`, {
        id,
        downloadType: type === "audio" ? "audio" : "video",
        quality: type === "audio" ? "mp3" : "720p",
        key: decrypted.key,
      });

      const downloadUrl = download.data.data?.downloadUrl;
      if (!downloadUrl) throw new Error("No se pudo obtener link");

      return {
        status: true,
        result: {
          title: decrypted.title,
          thumbnail: decrypted.thumbnail,
          format: type === "audio" ? "mp3" : "mp4",
          download: downloadUrl,
        },
      };
    } catch (err) {
      // 🚨 Si SaveTube falla, fallback a yt-dlp oficial
      console.log("⚠️ SaveTube falló, usando yt-dlp fallback...");
      try {
        const info = await ytdlp.getInfo(url);
        const format =
          type === "audio"
            ? info.formats.find((f) => f.ext === "m4a") || info.formats[0]
            : info.formats.find((f) => f.ext === "mp4" && f.height <= 720) || info.formats[0];

        return {
          status: true,
          result: {
            title: info.title,
            author: info.uploader,
            thumbnail: info.thumbnail,
            duration: info.duration_string,
            format: type === "audio" ? "mp3" : "mp4",
            download: format.url,
          },
        };
      } catch (e2) {
        return { status: false, error: e2.message };
      }
    }
  },
};

// 🎧 MP3
app.get("/ytmp3", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ status: false, error: "Falta el parámetro url" });
  const dl = await savetube.download(url, "audio");
  if (!dl.status) return res.status(500).json(dl);
  res.json(dl.result);
});

// 🎬 MP4
app.get("/ytmp4", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ status: false, error: "Falta el parámetro url" });
  const dl = await savetube.download(url, "video");
  if (!dl.status) return res.status(500).json(dl);
  res.json(dl.result);
});

app.get("/", (req, res) => {
  res.send("✅ API YouTube MP3/MP4 activa (SaveTube + yt-dlp fallback)");
});

app.listen(PORT, () => console.log(`Servidor iniciado en puerto ${PORT}`));