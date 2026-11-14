# syntax=docker/dockerfile:1
# se-LARAS: server Node + mesin analisis Python + ffmpeg dalam satu image.
# CATATAN JUJUR: berkas ini ditulis di lingkungan tanpa daemon Docker, jadi `docker build` BELUM pernah dijalankan oleh saya.
# Perintah di bawah memakai versi yang sama dengan yang diuji secara langsung (Node 22, Python 3.13), tetapi
# build image perlu diverifikasi sekali sebelum dipakai (lihat docs/DAFTAR_VERIFIKASI.md).

# --- tahap 1: dependensi Node. better-sqlite3 13 membawa biner siap pakai (prebuilds/); .npmrc mematikan skrip pasang,
#     jadi tidak ada kompilasi dan tidak perlu python3/make/g++. Biner linux-x64 itu butuh glibc <= 2.34 dan
#     GLIBCXX <= 3.4.29 (bookworm: 2.36 dan 3.4.30). Itu hasil membaca simbol biner, BUKAN uji jalan di image ini.
FROM node:22-bookworm-slim AS nodedeps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev

# --- tahap 2: runtime (Python 3.13 + ffmpeg, Node disalin dari tahap 1; keduanya Debian bookworm sehingga glibc sama)
FROM python:3.13-slim-bookworm AS runtime
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libsndfile1 libglib2.0-0 tini curl \
 && rm -rf /var/lib/apt/lists/*
COPY --from=nodedeps /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY analyzer/requirements.txt analyzer/requirements.txt
RUN pip install -r analyzer/requirements.txt
COPY --from=nodedeps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY public ./public
COPY seed ./seed
COPY scripts ./scripts
COPY analyzer ./analyzer
RUN useradd --system --uid 10001 --home-dir /app laras && mkdir -p /data && chown -R laras:laras /data
USER laras
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/healthz" || exit 1
# tini = PID 1 yang menuntaskan proses anak (python/ffmpeg) agar tidak jadi zombi
ENTRYPOINT ["tini", "--"]
CMD ["node", "src/server.js"]
