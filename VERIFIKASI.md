# Verifikasi se-LARAS v0.3.0 (untuk validator BUDAYA GO! 2026)

Berkas ini ditambahkan setelah rilis v0.3.0 dan **tidak mengubah kode**. Tag `v0.3.0` berisi tepat isi `se-LARAS-v0.3.0.zip`; commit sesudahnya hanya menambah berkas ini.

## 1. Status, apa adanya

| Hal | Keadaan |
|---|---|
| Jenis | Prototipe fungsional (Inovasi Digital, subtema 4). Belum dipakai oleh pengguna nyata. |
| Tanggal pembuatan | Dibangun pertama pada **14 November 2026**. Modul akun, unggah berizin, dan buku jejak dipakai ulang dari LudrukHub, proyek tim yang sama, yang dibuat pada 12 November 2026. **Produk ini tidak tersedia sebelum 31 Maret 2026**, sehingga butir C.3 Juknis tidak terpenuhi. Kami tidak mengklaim sebaliknya. |
| Yang dapat dicek pihak ketiga | Riwayat git dimulai pada commit awal (15 November 2026, 00:02 WIB). Pengembangan sebelumnya tidak tercatat di git. Tanggal berkas di dalam zip hanyalah tanggal sistem berkas dan bukan bukti independen. |
| Pengguna dan data nyata | Belum ada maestro, rekaman Ludruk, pelajar, atau pengguna. Semua uji memakai klip sintetis dan data publik non-Ludruk. Dampak yang telah tercapai: nol. |
| Asal kode | Sebagian besar kode dikembangkan dengan bantuan asisten pemrograman AI atas arahan pengembang tim; sebagian modul berasal dari LudrukHub (Lampiran E proposal). |
| Lisensi | Belum ditetapkan (`"license": "UNLICENSED"` pada `package.json`). Model dan data pihak ketiga mengikuti lisensinya masing-masing: [`analyzer/models/MODELS.json`](analyzer/models/MODELS.json) dan [`docs/SUMBER.md`](docs/SUMBER.md). |

## 2. Tautan untuk validator

- Repositori: <https://github.com/nabeelz06/se-LARAS>
- Rilis v0.3.0 (zip dan `SHA256SUMS.txt`): <https://github.com/nabeelz06/se-LARAS/releases/tag/v0.3.0>
- Riwayat commit: <https://github.com/nabeelz06/se-LARAS/commits/main>
- Hasil CI (GitHub Actions): <https://github.com/nabeelz06/se-LARAS/actions>
- Video penelusuran 115 detik (data sintetis): [`docs/media/penelusuran-se-laras.mp4`](docs/media/penelusuran-se-laras.mp4)
- Dokumen: [`README.md`](README.md) · [`docs/PENGUJIAN.md`](docs/PENGUJIAN.md) (hasil uji dan batasnya) · [`docs/EVALUASI.md`](docs/EVALUASI.md) (evaluasi komponen analisis pada data publik non-Ludruk) · [`docs/DAFTAR_VERIFIKASI.md`](docs/DAFTAR_VERIFIKASI.md) (klaim yang belum terverifikasi) · [`docs/PROTOKOL_PENGUMPULAN_DATA.md`](docs/PROTOKOL_PENGUMPULAN_DATA.md) · [`docs/SUMBER.md`](docs/SUMBER.md) (sumber data dan lisensi) · [`analyzer/evaluation/results.json`](analyzer/evaluation/results.json) (angka mentah evaluasi)

SHA-256 `se-LARAS-v0.3.0.zip`: `4762499bfd088ecf3ec1fe30dba43b9e987b85eca88ea1c2d9735925a50cd449`

## 3. Cara memeriksa

Linux x64, Node ≥ 22, Python 3.13, `ffmpeg` dan `ffprobe`. Windows dan macOS belum dicoba.

```bash
# 1. Cocokkan hash berkas rilis (harus sama dengan nilai di atas)
sha256sum se-LARAS-v0.3.0.zip

# 2. Cocokkan dengan pohon berkas pada tag v0.3.0 (tidak boleh ada perbedaan)
git clone https://github.com/nabeelz06/se-LARAS.git
git -C se-LARAS checkout v0.3.0
unzip -q se-LARAS-v0.3.0.zip -d isi-zip
diff -r isi-zip/se-laras se-LARAS --exclude=.git && echo "identik"

# 3. Pasang dan uji (dari dalam se-LARAS/)
cd se-LARAS
npm ci
python3 -m pip install -r analyzer/requirements.txt
python3 analyzer/evaluation/fetch_data.py     # data uji publik; sha256 diperiksa. Tanpa ini 10 tes Python dilewati
npm run test:all                              # check:ui (44 modul), 46 tes Node, 73 tes Python
python3 -I analyzer/verify_models.py          # tiga model cocok dengan sha256 terdaftar

# 4. Jalankan aplikasi (akun contoh dan kata sandi ada di README.md; hanya untuk lokal)
export SESSION_SECRET=$(openssl rand -hex 24)
npm run seed
LARAS_DEMO=1 npm start                        # http://localhost:3000

# 5. Uji ujung-ke-ujung (sekitar 4 menit)
python3 -m pip install -r analyzer/requirements-dev.txt
python3 -m playwright install chromium
npm run e2e
```

Alur yang layak dicoba sendiri (sekitar 10 menit): masuk sebagai murid contoh dan buka satu unit; masuk sebagai maestro contoh dan lihat daftar kesiapan pengesahan; ubah satu segmen yang sudah sah dan lihat unit kembali ke draf; sebagai murid, rekam atau unggah latihan setelah mencentang persetujuan; buka buku jejak dan jalankan verifikasi rantai.

## 4. Klaim, bukti, dan batasnya

| Klaim | Bukti di repositori | Batas |
|---|---|---|
| Alur maestro dan pelajar berjalan | `npm run e2e` (3 alur), `test/`, [`docs/PENGUJIAN.md`](docs/PENGUJIAN.md), video penelusuran | Data sintetis; satu mesin Linux x64; belum ada pengguna nyata |
| Analisis audio: jeda, tempo, derau, penyejajaran waktu | [`docs/EVALUASI.md`](docs/EVALUASI.md), `analyzer/evaluation/results.json`, `npm run eval` | Data publik non-Ludruk; belum diukur pada rekaman Ludruk |
| Analisis gerak: deteksi orang dan titik kunci tubuh | `analyzer/tests/`, [`docs/EVALUASI.md`](docs/EVALUASI.md) | Akurasi pose tidak diukur; hanya pemeriksaan bentuk dan lantai getaran |
| Isi hanya tampil kepada pelajar setelah disahkan maestro; ditegakkan server | `test/`, [`docs/PENGUJIAN.md`](docs/PENGUJIAN.md) | Diuji dengan akun contoh, bukan maestro sungguhan |
| Buku jejak berantai-hash | `npm test`; menu buku jejak dan verifikasi rantai | Tahan-ubah (terlihat bila diubah), bukan tanda tangan digital |
| Model pihak ketiga utuh dan berlisensi terbuka | `python3 -I analyzer/verify_models.py`, [`analyzer/models/MODELS.json`](analyzer/models/MODELS.json) | Hash dicocokkan dengan unduhan asal pada 14 November 2026; lisensi dibaca dari repositori asal |
| Yang **tidak** diklaim | [`docs/DAFTAR_VERIFIKASI.md`](docs/DAFTAR_VERIFIKASI.md) | Model ASR Suroboyoan; layanan AI teks nyata (hanya diuji dengan layanan tiruan); instalasi publik; build Docker |

## 5. Catatan tentang CI

`README.md` ditulis sebelum repositori ini ada dan menyatakan bahwa CI GitHub Actions belum pernah dijalankan. Itu benar untuk keadaan 14 November 2026 dan tidak kami ubah. Setelah repositori dibuat, alur kerja `.github/workflows/ci.yml` berjalan di GitHub; hasilnya, lulus atau gagal, adalah yang tampil pada tab Actions.

Bila Anda menemukan klaim yang tidak sesuai dengan bukti di repositori ini, silakan buka Issue.
