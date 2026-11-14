# Verifikasi se-LARAS v0.3.0 (untuk validator BUDAYA GO! 2026)

Berkas ini ditambahkan setelah rilis v0.3.0. Tiga commit pertama di cabang `main`:

| Commit | Waktu (WIB) | Isi |
|---|---|---|
| `911ef21` | 15 Nov 2026, 00:02 | Isi **identik** dengan `se-LARAS-v0.3.0.zip` (diperiksa dengan `diff -r`, 174 berkas) |
| `1c46d55` | 15 Nov 2026 | Menambah berkas ini; tidak mengubah kode |
| `27a70b4` | 15 Nov 2026, 02:34 | Memperbaiki dependensi OpenCV yang cacat pada instalasi bersih (bagian 5). Mengubah `requirements.txt`, satu pesan galat di `analyzer/posecore.py`, daftar paket di `analyzer/evaluate.py`, dan satu catatan di `docs/EVALUASI.md` |

Jadi **zip v0.3.0 membawa cacat dependensi yang diperbaiki di `main`**. Pemakai zip: lihat bagian 5.

## 1. Status, apa adanya

| Hal | Keadaan |
|---|---|
| Jenis | Prototipe fungsional (Inovasi Digital, subtema 4). Belum dipakai oleh pengguna nyata. |
| Tanggal pembuatan | Dibangun pertama pada **14 November 2026**. Modul akun, unggah berizin, dan buku jejak dipakai ulang dari LudrukHub, proyek tim yang sama, yang dibuat pada 12 November 2026. **Produk ini tidak tersedia sebelum 31 Maret 2026**, sehingga butir C.3 Juknis tidak terpenuhi. Kami tidak mengklaim sebaliknya. |
| Yang dapat dicek pihak ketiga | Riwayat git dimulai pada commit awal (15 November 2026, 00:02 WIB). Pengembangan sebelumnya tidak tercatat di git. Tanggal berkas di dalam zip hanyalah tanggal sistem berkas dan bukan bukti independen. |
| Pengguna dan data nyata | Belum ada maestro, rekaman Ludruk, pelajar, atau pengguna. Semua uji memakai klip sintetis dan data publik non-Ludruk. Dampak yang telah tercapai: nol. |
| Asal kode | Sebagian besar kode dikembangkan dengan bantuan asisten pemrograman AI atas arahan pengembang tim; sebagian modul berasal dari LudrukHub (Lampiran E proposal). |
| Lisensi | Belum ditetapkan (`"license": "UNLICENSED"` pada `package.json`). Model dan data pihak ketiga mengikuti lisensinya masing-masing: [`analyzer/models/MODELS.json`](analyzer/models/MODELS.json) dan [`docs/SUMBER.md`](docs/SUMBER.md). |
| Cacat yang ditemukan setelah rilis | Satu, dan sudah diperbaiki: dependensi OpenCV pada v0.3.0 hanya bekerja di mesin pengembang. Kronologi dan bukti di bagian 5. |

## 2. Tautan untuk validator

- Repositori: <https://github.com/nabeelz06/se-LARAS>
- Snapshot v0.3.0 (identik dengan zip): <https://github.com/nabeelz06/se-LARAS/tree/911ef21e29fdb976f78a3980283dccd3ddb18391>
- Riwayat commit: <https://github.com/nabeelz06/se-LARAS/commits/main>
- Hasil CI (GitHub Actions): <https://github.com/nabeelz06/se-LARAS/actions>. Run pertama (gagal): <https://github.com/nabeelz06/se-LARAS/actions/runs/43631910751>. Run setelah perbaikan (lulus): <https://github.com/nabeelz06/se-LARAS/actions/runs/43632798730>
- Video penelusuran 115 detik (data sintetis): [`docs/media/penelusuran-se-laras.mp4`](docs/media/penelusuran-se-laras.mp4)
- Dokumen: [`README.md`](README.md) · [`docs/PENGUJIAN.md`](docs/PENGUJIAN.md) (hasil uji dan batasnya) · [`docs/EVALUASI.md`](docs/EVALUASI.md) (evaluasi komponen analisis pada data publik non-Ludruk) · [`docs/DAFTAR_VERIFIKASI.md`](docs/DAFTAR_VERIFIKASI.md) (klaim yang belum terverifikasi) · [`docs/PROTOKOL_PENGUMPULAN_DATA.md`](docs/PROTOKOL_PENGUMPULAN_DATA.md) · [`docs/SUMBER.md`](docs/SUMBER.md) (sumber data dan lisensi) · [`analyzer/evaluation/results.json`](analyzer/evaluation/results.json) (angka mentah evaluasi)

SHA-256 `se-LARAS-v0.3.0.zip`: `4762499bfd088ecf3ec1fe30dba43b9e987b85eca88ea1c2d9735925a50cd449`

## 3. Cara memeriksa

Linux x64, Node ≥ 22, Python 3.13, `ffmpeg` dan `ffprobe`. Windows dan macOS belum dicoba. **Pakai lingkungan virtual Python yang bersih** dan jangan memasang varian paket `opencv-*` lain di dalamnya (semuanya berbagi satu direktori `cv2`; inilah yang menutupi cacat pada bagian 5).

```bash
# 1. Ambil kode (cabang main = v0.3.0 + perbaikan pada bagian 5)
git clone https://github.com/nabeelz06/se-LARAS.git
cd se-LARAS

# 2. Pasang dan uji
npm ci
python3 -m venv .venv && . .venv/bin/activate
python -m pip install -r analyzer/requirements.txt
python analyzer/evaluation/fetch_data.py      # data uji publik; sha256 diperiksa. Tanpa ini 10 tes Python dilewati
npm run test:all                              # check:ui (44 modul), 46 tes Node, 73 tes Python
python -I analyzer/verify_models.py           # tiga model cocok dengan sha256 terdaftar

# 3. Jalankan aplikasi (akun contoh dan kata sandi ada di README.md; hanya untuk lokal)
export SESSION_SECRET=$(openssl rand -hex 24)
npm run seed
LARAS_DEMO=1 npm start                        # http://localhost:3000

# 4. Uji ujung-ke-ujung (sekitar 4 menit)
python -m pip install -r analyzer/requirements-dev.txt
python -m playwright install chromium
npm run e2e
```

Hasil yang sama (46 tes Node, 73 tes Python, e2e) tercatat pada run CI yang lulus (bagian 2). Langkah di atas dijalankan juga di lingkungan virtual bersih pada mesin pengembangan, 15 November 2026.

**Bila Anda memiliki `se-LARAS-v0.3.0.zip`** dan ingin memastikan isinya sama dengan commit `911ef21`:

```bash
sha256sum se-LARAS-v0.3.0.zip                 # harus sama dengan nilai pada bagian 2
git clone https://github.com/nabeelz06/se-LARAS.git
git -C se-LARAS checkout 911ef21e29fdb976f78a3980283dccd3ddb18391
unzip -q se-LARAS-v0.3.0.zip -d isi-zip
diff -r isi-zip/se-laras se-LARAS --exclude=.git && echo "identik"
```

Alur yang layak dicoba sendiri (sekitar 10 menit): masuk sebagai murid contoh dan buka satu unit; masuk sebagai maestro contoh dan lihat daftar kesiapan pengesahan; ubah satu segmen yang sudah sah dan lihat unit kembali ke draf; sebagai murid, rekam atau unggah latihan setelah mencentang persetujuan; buka buku jejak dan jalankan verifikasi rantai.

## 4. Klaim, bukti, dan batasnya

| Klaim | Bukti di repositori | Batas |
|---|---|---|
| Alur maestro dan pelajar berjalan | `npm run e2e` (3 alur), `test/`, [`docs/PENGUJIAN.md`](docs/PENGUJIAN.md), video penelusuran, run CI yang lulus | Data sintetis; mesin Linux x64 (mesin pengembang dan runner GitHub); belum ada pengguna nyata |
| Analisis audio: jeda, tempo, derau, penyejajaran waktu | [`docs/EVALUASI.md`](docs/EVALUASI.md), `analyzer/evaluation/results.json`, `npm run eval` | Data publik non-Ludruk; belum diukur pada rekaman Ludruk; angka evaluasi tidak diulang setelah perbaikan bagian 5 |
| Analisis gerak: deteksi orang dan titik kunci tubuh | `analyzer/tests/`, [`docs/EVALUASI.md`](docs/EVALUASI.md) | Akurasi pose tidak diukur; hanya pemeriksaan bentuk dan lantai getaran |
| Isi hanya tampil kepada pelajar setelah disahkan maestro; ditegakkan server | `test/`, [`docs/PENGUJIAN.md`](docs/PENGUJIAN.md) | Diuji dengan akun contoh, bukan maestro sungguhan |
| Buku jejak berantai-hash | `npm test`; menu buku jejak dan verifikasi rantai | Tahan-ubah (terlihat bila diubah), bukan tanda tangan digital |
| Model pihak ketiga utuh dan berlisensi terbuka | `python3 -I analyzer/verify_models.py`, [`analyzer/models/MODELS.json`](analyzer/models/MODELS.json) | Hash dicocokkan dengan unduhan asal pada 14 November 2026; lisensi dibaca dari repositori asal |
| Yang **tidak** diklaim | [`docs/DAFTAR_VERIFIKASI.md`](docs/DAFTAR_VERIFIKASI.md) | Model ASR Suroboyoan; layanan AI teks nyata (hanya diuji dengan layanan tiruan); instalasi publik; Docker di luar runner CI GitHub; Windows dan macOS |

## 5. Catatan tentang CI dan cacat yang ditemukannya

`README.md`, `docs/PENGUJIAN.md`, `docs/ARSITEKTUR.md`, dan `docs/DAFTAR_VERIFIKASI.md` ditulis pada 14 November 2026, sebelum repositori ini ada, dan menyatakan bahwa CI GitHub Actions serta `docker build` belum pernah dijalankan. Itu benar untuk keadaan saat itu; pernyataan aslinya dibiarkan dan diberi catatan pembaruan yang menunjuk ke bagian ini.

**Kronologi (15 November 2026, WIB).**

1. 02:24. CI pertama dijalankan di GitHub (commit `1c46d55`, [run 43631910751](https://github.com/nabeelz06/se-LARAS/actions/runs/43631910751)). **Gagal**: 45 dari 46 tes Node lulus; yang gagal adalah uji dengan penganalisis Python asli, dengan galat `AttributeError: module 'cv2' has no attribute 'HOGDescriptor'`. Langkah sesudahnya (data publik, tes Python, e2e, docker) tidak sempat berjalan.
2. Penyebab, dibuktikan: pada OpenCV 5.0.0.93, paket `opencv-python-headless` (yang diminta `requirements.txt` lama) tidak memuat `cv2.HOGDescriptor`; varian `opencv-contrib-python-headless` memuatnya. Di mesin pengembang ketiga varian OpenCV terpasang berdampingan dan menimpa satu direktori `cv2`; biner yang termuat identik dengan wheel `opencv-contrib-python` (sha256 diawali `c381f4ff`), sehingga cacat itu tidak terlihat pada tes 14 November. Galat yang sama direproduksi di lingkungan virtual bersih.
3. Dampak nyata, bukan hanya pada tes: pada instalasi bersih yang mengikuti `requirements.txt` v0.3.0, analisis klip yang tidak dikenali detektor orang (termasuk klip contoh sintetis) memakai jalur cadangan (HOG) dan gagal.
4. 02:34. Perbaikan di commit `27a70b4` ([run 43632798730](https://github.com/nabeelz06/se-LARAS/actions/runs/43632798730)): **lulus** pada ketiga job: `test` (check:ui, 46 tes Node, data publik, keutuhan model, 73 tes Python), `docker` (`docker build` dan `/healthz` pada runner GitHub), dan `e2e` (3 alur, 72 pemeriksaan halaman). Hasil yang sama diperoleh di lingkungan virtual bersih pada mesin pengembangan: tes Node dan Python sebelum push, e2e sesudahnya.

**Untuk pemakai zip v0.3.0:** sebelum menjalankan analisis, ganti paket OpenCV di lingkungan bersih: `pip uninstall -y opencv-python-headless && pip install "opencv-contrib-python-headless>=4.9"`, atau pakai cabang `main`.

**Batas yang tetap berlaku.** (a) `requirements.txt` hanya memuat batas bawah versi; hasil CI mencerminkan versi yang tersedia pada 15 November 2026 (numpy 2.5.4, scipy 1.18.1, librosa 1.0.1, onnxruntime 1.32.0, opencv-contrib-python-headless 5.0.0.93, ai-edge-litert 2.3.0, Python 3.13) dan dapat berubah bila pustaka berganti versi. (b) Angka evaluasi pada `docs/EVALUASI.md` dihasilkan pada 14 November dengan pustaka yang sedikit lebih lama dan tidak diulang. (c) `docker compose up` dan Docker di mesin pengembang belum dijalankan.

Bila Anda menemukan klaim yang tidak sesuai dengan bukti di repositori ini, silakan buka Issue.
