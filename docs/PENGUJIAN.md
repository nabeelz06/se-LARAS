# Pengujian se-LARAS

Dijalankan **2026-11-14** pada satu mesin pengembangan (Linux, Node 22, Python 3.13, 2 inti CPU). Semua angka di bawah berasal dari eksekusi nyata pada tanggal itu, bukan dari ingatan. Dokumen ini menjelaskan **apa yang diuji, hasilnya, dan apa yang tidak dibuktikan oleh hasil itu**.

## 0. Baca ini dulu: arti "lulus"

1. Semua tes ditulis oleh pengembang yang sama dengan kodenya. **Tidak ada peninjauan kode atau tes oleh orang lain.** Kesalahan pemahaman yang sama bisa ada di kode dan di tesnya sekaligus.
2. Tes membuktikan bahwa perangkat lunak **berperilaku sesuai niat penulisnya**. Tes **tidak** membuktikan bahwa analisis akurat pada rekaman Ludruk, bahwa pelajar belajar lebih baik, bahwa teks Suroboyoan benar, atau bahwa pengguna paham antarmukanya. Tidak ada rekaman Ludruk, maestro, atau pelajar nyata dalam pengujian mana pun.
3. Sebagian besar tes Node memakai **penganalisis tiruan** (hasil analisis tetap). Mereka menguji logika aplikasi (izin, gerbang, privasi), bukan ketepatan analisis. Ketepatan analisis diukur terpisah pada data publik non-Ludruk (`docs/EVALUASI.md`); hanya satu tes Node (`integration.test.js`) menjalankan penganalisis Python yang asli.
4. Klip yang dipakai uji ujung-ke-ujung adalah **klip sintetis** (suara LJSpeech + penari kartun yang digambar dengan kode, `seed/fixtures/make_fixtures.py`), bukan pertunjukan. Detektor orang tidak mengenali gambar kartun, sehingga alur ini menguji **jalur cadangan** analisis gerak, bukan pelacakan orang.
5. **Cakupan kode tidak diukur.**
6. GitHub Actions (`.github/workflows/ci.yml`) **belum pernah berjalan**: proyek ini belum berada di repositori git. Pada 14 Nov 2026 berkas itu ternyata **tidak valid sebagai YAML** (nama langkah memuat titik dua tanpa tanda kutip); sudah diperbaiki dan kini terbaca oleh pengurai YAML, tetapi belum diuji di GitHub.
7. `docker build` **belum pernah dijalankan** (tidak ada daemon Docker di lingkungan pengembangan).

## 1. Ringkasan hasil (14 Nov 2026)

| Pemeriksaan | Perintah | Hasil |
|---|---|---|
| Sintaks modul frontend + pola terlarang | `npm run check:ui` | 44 modul benar; tidak ada `innerHTML`, `eval`, atribut `style`/`on*` inline |
| Tes Node | `npm test` | **46 dari 46 lulus**, 0 dilewati, ±38 dtk |
| Tes Python | `npm run test:py` | **73 dari 73 lulus**, ±6 dtk, dengan data evaluasi publik terunduh. **Tanpa** data itu: 63 lulus, **10 dilewati** (bukan gagal) |
| Keutuhan model | `python3 -I analyzer/verify_models.py` | 3 model cocok dengan sha256 di `analyzer/models/MODELS.json` |
| Pasang bersih dari zip rilis | `python3 scripts/package.py --verify`; tes Python dan e2e dijalankan di ekstrak zip yang sama sebelum baris ini ditambahkan (selisihnya hanya teks dokumen dan tangkapan layar yang diambil ulang dari kode yang sama) | Ekstrak ke direktori **baru**: `npm ci` memasang 76 paket tanpa kompilasi (<1 dtk), `check:ui`, tes Node, dan 3 model lulus; 73 tes Python lulus (data publik diunduh lebih dulu); e2e lulus. Hanya Linux x64 |
| Uji ujung-ke-ujung | `npm run e2e` | **3 dari 3 alur lulus**, 3 mnt 43 dtk (dari ekstrak bersih zip rilis): alur maestro, alur pelajar (kamera palsu), 72 pemeriksaan halaman |
| Kerentanan dependensi runtime Node | `npm audit --omit=dev` | 0 kerentanan **yang ada di basis data advisori npm saat itu**. Bukan audit keamanan. Dependensi Python tidak diaudit |

## 2. Cara menjalankan

```bash
npm ci
python3 -m pip install -r analyzer/requirements.txt
python3 analyzer/evaluation/fetch_data.py     # data evaluasi publik; tanpa ini 10 tes Python dilewati
npm run test:all                               # check:ui + Node + Python
python3 -I analyzer/verify_models.py
python3 scripts/package.py --verify           # zip rilis, lalu pasang bersih + check:ui + tes Node + model dari ekstrak baru

# e2e: butuh Chromium Playwright dan devDependency axe-core
python3 -m pip install -r analyzer/requirements-dev.txt && python3 -m playwright install chromium
npm run e2e                                    # atau: python3 e2e/run_all.py maestro|pelajar|halaman
```

Tes Node memakai basis data dalam memori, direktori unggahan sementara (dihapus setelah tes), dan rahasia sesi khusus tes; tidak menyentuh `./data`.

## 3. Inventaris tes

### 3.1 Node (`test/`, 46 tes, `node --test`)

| Berkas | Tes | Yang dikunci |
|---|---|---|
| `app.test.js` | 16 | Persetujuan pendaftaran; unggah unit wajib izin dan tanggal izin tidak di masa depan; gerbang pengesahan; hanya segmen sah tampil ke pelajar; pencarian bersumber; latihan pelajar (persetujuan, tanpa skor, privasi); ukuran tak andal ditandai; analisis gagal tidak mematikan server; buku jejak (rantai, penyamaran publik, entri tengah dihapus memutus rantai); tarik unit; pembersihan 30 hari; hapus akun; AI teks opsional |
| `v2.test.js` | 17 | Migrasi skema v0.1→v2; unggah media (ffprobe) dan berkas buruk dibuang; salinan putar; usulan momen tersembunyi dari pelajar; pilih penampil utama + gerbang; takarir WebVTT; kelas + kode gabung; glosarium; kemajuan belajar; ASR opsional; ringkasan admin dan ekspor korpus riset; keamanan (Origin, header); hapus akun menghapus berkas; konsistensi pemasangan bersih (`.npmrc`, engines, Dockerfile, tag image) |
| `recovery.test.js` | 3 | Pemulihan pekerjaan analisis yang menggantung setelah server dimulai ulang; basis data bersih tidak berubah |
| `metrics.test.js` | 5 | Toleransi dan lantai, ukuran kosong = tidak andal (bukan nol), tidak ada skor gabungan |
| `glossary-seed.test.js` | 3 | Setiap entri glosarium punya sumber https, istilah unik; dimuat sebagai draf; contoh kalimat hanya bersama padanan Indonesia |
| `dataset-pipeline.test.js` | 1 | Ekspor → manifest ASR → pembagian menurut penutur (klip sintetis; dilewati bila ffmpeg/python tidak ada) |
| `integration.test.js` | 1 | Penganalisis Python **asli**: jeda maestro lebih panjang dari murid terdeteksi (dilewati bila pustaka Python tidak ada) |

### 3.2 Python (`analyzer/tests/`, 73 tes, `unittest`)

| Berkas | Tes | Yang dikunci |
|---|---|---|
| `test_vad.py` | 11 | Segmentasi ucapan, histeresis, penormalan tingkat suara (tidak memotong), invarian terhadap penguatan |
| `test_audiocore.py` | 10 | Jeda dari celah antar segmen, penaksir SNR, kasus diam/pendek/derau saja, kontrak CLI |
| `test_align.py` | 9 | DTW: pelurusan diri, lintasan monoton, **rasio tempo mengikuti peregangan**, segmen tepi liar tidak mengubah rasio, ambang andal, isi berbeda ditandai tak andal |
| `test_moments_detect.py` | 12 | Momen jeda panjang/puncak gerak, pelacakan orang, interpolasi kotak, pendeteksi menemukan orang di foto uji, penyaring titik kunci |
| `test_calibration.py` | 7 | Konstanta di kode (setelan VAD, ambang DTW, lebar tepi penaksir tempo) sama dengan yang tercatat di `results.json`/`calibration.json`; klaim tercatat (mis. galat tempo < 5%, jeda ≥ 0,5 dtk terdeteksi pada klip bersih) masih benar menurut berkas itu; semua ukuran punya lantai. **Memeriksa berkas hasil tersimpan; tidak menjalankan ulang evaluasi** (itu `npm run eval`, beberapa menit) |
| `test_models.py` | 5 | Model terpasang cocok dengan registri; evaluasi dijalankan pada model yang terdaftar; label mesin di UI tidak melenceng dari registri; `calibration.json` cocok dengan `results.json` |
| `test_manifest_to_asr.py` | 10 | Konversi manifest → ujaran 16 kHz mono; batas akhir wajib; `--derive-end` ditandai; filter durasi; peta penutur menimpa akun pengunggah; berkas tanpa media ditolak; jalur keluar direktori ditolak; korpus kosong tidak dikarang |
| `test_tools.py` | 9 | WER/CER (nilai tahu, insersi, normalisasi, pembobotan korpus); pembagi menurut penutur (terpisah, deterministik, menolak < 5 penutur) |

### 3.3 Ujung-ke-ujung (`e2e/`, Playwright + Chromium)

| Alur | Yang dilakukan | Hasil |
|---|---|---|
| `maestro` | Masuk sebagai maestro contoh → unggah berizin → analisis klip → transkrip → momen → ukuran → pengesahan → unit tampil bagi pelajar | lulus (20 dtk) |
| `pelajar` | Masuk sebagai murid → rekam lewat **kamera palsu** Chromium → gerbang persetujuan → kirim → hasil analisis | lulus (11 dtk) |
| `halaman` | 18 rute × 4 tampilan (desktop 1360 px dan ponsel 390 px; terang dan gelap) = **72 pemeriksaan**. Tiap pemeriksaan: tanpa galat konsol, tanpa luber horizontal, dan nol pelanggaran axe-core 4.14.0 (tag `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `best-practice`). Pada tampilan ponsel ditambah: setiap `.wrap` punya jarak kiri-kanan ≥ 12 px dan tidak ada teks polos < 8 px dari tepi kiri | lulus (157 dtk) |

Tangkapan layar halaman diambil oleh alur ini ke `e2e/out/` (tidak ikut dikirim).

## 4. Keterlacakan: klaim → tes yang menguncinya

| Klaim produk | Tes |
|---|---|
| Unit baru butuh klip, izin tertulis, dan tanggal izin sah | `app.test.js` "unit: wajib klip, izin tertulis, dan tanggal izin tidak di masa depan" |
| Maestro tidak bisa mengesahkan tanpa analisis, rubrik, dan segmen sah; momen **tidak** disyaratkan | `app.test.js` "pengesahan unit digerbangi…"; kode `readiness()` di `src/app.js` |
| Pelajar hanya melihat segmen dan momen yang sah; mengubahnya membuka kembali unit | `app.test.js` "unit sah terlihat pelajar…"; `v2.test.js` "momen: sunting mengembalikan ke draf…" |
| Usulan otomatis (momen, segmen) selalu draf dan tersembunyi | `v2.test.js` "usulan momen dari analisis…", "ASR opsional…"; `app.test.js` "AI teks opsional…" |
| Tidak ada skor gabungan; ukuran tak andal bukan angka karangan | `metrics.test.js` ×3; `app.test.js` "latihan pelajar…", "rekaman buruk…" |
| Klip pelajar: persetujuan, privasi, hapus, kedaluwarsa 30 hari, hapus akun | `app.test.js` "latihan pelajar…", "pembersihan otomatis…", "hapus akun…"; `v2.test.js` "hapus akun: berkas asli dan salinan putar…" |
| Penarikan unit menghapus klip, analisis, indeks pencarian | `app.test.js` "tarik unit menghapus klip…" (teks segmen dan momen **tidak** dihapus; lihat `docs/PROTOKOL_PENGUMPULAN_DATA.md` bagian 3) |
| Buku jejak berantai, terverifikasi, penyamaran publik, perusakan terdeteksi | `app.test.js` ×3 "buku jejak…" |
| Ekspor riset hanya unit sah + izin riset + bukan contoh + hash cocok | `v2.test.js` "admin: … korpus riset …"; `dataset-pipeline.test.js` |
| Server tidak menggantung setelah dimulai ulang | `recovery.test.js` ×3 |
| Origin asing ditolak; header keamanan terpasang | `v2.test.js` "keamanan…" |
| Akun peragaan tidak dihitung sebagai "maestro/praktisi" di beranda | `app.test.js` "statistik beranda: akun peragaan tidak dihitung…" |
| Nomor versi di API, `package.json`, dan nama cache service worker selalu sama (cache lama terbuang saat rilis) | `v2.test.js` "keamanan…" (tiga pernyataan di akhir). Perilaku service worker itu sendiri **tidak** diuji (bagian 5) |
| Pemasangan bersih tidak butuh kompilator: `.npmrc` mematikan skrip pasang, tak ada dependensi yang butuh skrip itu, `engines.node` tidak lebih longgar daripada better-sqlite3, Dockerfile menyalin `.npmrc`, tag image = versi | `v2.test.js` "pemasangan bersih…". Dibuktikan **bisa gagal**: empat mutasi manual satu per satu (`ignore-scripts=false`; `engines` `>=20`; tag image `0.2`; Dockerfile tanpa `.npmrc`) masing-masing membuat tes itu gagal, lalu berkas dipulihkan (dicek byte-per-byte). Tes ini dipicu cacat nyata yang ditemukan oleh pemasangan bersih dari zip (`npm ci` mengompilasi better-sqlite3, lihat `.npmrc`); tes **tidak** menjalankan `npm ci`, itu dilakukan `scripts/package.py --verify` |
| Konstanta kalibrasi di kode = konstanta yang dievaluasi; klaim tercatat konsisten dengan hasil tersimpan (bukan eksekusi ulang) | `test_calibration.py` ×7 |
| Model yang dipakai = model yang dievaluasi = model yang terdaftar | `test_models.py` ×5; `verify_models.py` |
| Penaksir tempo tidak terkecoh segmen tepi | `test_align.py` "test_tempo_ratio_ignores_stray_edge_segments", "test_tempo_ratio_follows_stretch"; besarnya galat pada data publik tercatat di `results.json` dan dikunci konsistensinya oleh `test_calibration.py` |
| Peta penutur mencegah kebocoran akun-sebagai-penutur ke pembagian data | `test_manifest_to_asr.py` "test_speaker_map_…" |
| Frontend tanpa `innerHTML`/`eval`/gaya inline; semua modul valid | `npm run check:ui` |
| Semua rute tanpa pelanggaran axe, tanpa luber, tanpa galat konsol | `e2e/flow_pages.py` |
| Isi halaman tidak menempel ke tepi layar ponsel (`.wrap` selalu punya jarak kiri-kanan) | `e2e/flow_pages.py` (`EDGE_CHECK`). Dibuktikan **bisa gagal**: dengan aturan CSS lama (`.pad{padding:2rem 0}`) disuntikkan ke halaman `/unit`, pemeriksaan melaporkan `wrap pad` berjarak 0 px; dengan kode sekarang melaporkan nol temuan. Pemeriksaan tahap pertama yang hanya memeriksa teks polos **gagal menangkap** mutasi yang sama, jadi diganti |

Satu uji regresi dibuktikan **bisa gagal** (diulang 14 Nov 2026): penaksir tempo diganti karena evaluasi sendiri menemukan galat hingga 17,1% pada data latih (`docs/EVALUASI.md` 3.4). Ketika baris penaksir baru dinonaktifkan sementara sehingga kode kembali memakai rasio durasi ucapan lama, `test_tempo_ratio_ignores_stray_edge_segments` **gagal** (1 kegagalan dari 9 tes di `test_align.py`); berkas dikembalikan dan semua tes lulus lagi. `test_calibration.py` tetap lulus pada mutasi itu karena hanya memeriksa konstanta dan berkas hasil. Ini pemeriksaan manual satu kali pada satu tempat; **bukan** pengujian mutasi otomatis, dan tes lain tidak diperiksa dengan cara ini.

## 5. Yang BELUM diuji

| Hal | Status |
|---|---|
| Rekaman Ludruk nyata, maestro nyata, pelajar nyata | **Tidak ada.** Seluruh akurasi pose/jeda pada panggung tidak diketahui |
| Uji kegunaan dengan pengguna sungguhan (maestro, pemain muda, kelas) | Belum |
| Peninjauan desain oleh orang lain; uji kegunaan | Tidak ada. Tata letak diperiksa oleh pengembang yang sama melalui tangkapan layar (`docs/img/`); pemeriksaan itu menemukan dan memperbaiki empat masalah (jarak kiri-kanan hilang, urutan pemutar/transkrip di ponsel, ilustrasi yang menutupi layar pertama ponsel, angka "maestro/praktisi" yang menghitung akun contoh), tetapi **tidak ada tes otomatis** untuk urutan konten atau kerapian visual |
| Pembaca layar sungguhan (NVDA, VoiceOver, TalkBack), navigasi papan ketik menyeluruh oleh manusia | Belum; axe-core hanya menangkap sebagian masalah aksesibilitas dan tidak menilai kejelasan bahasa atau urutan fokus yang bermakna |
| Peramban selain Chromium; perangkat ponsel fisik (hanya viewport 390 px di Chromium) | Belum |
| Kamera dan mikrofon sungguhan (hanya kamera palsu Chromium) | Belum |
| Service worker/PWA luring | Tidak diuji otomatis |
| Beban, banyak pengguna bersamaan, unggahan besar berulang | Belum; semua alur satu pengguna. Analisis memakai CPU (gerak pada video 60 dtk ±19 dtk pada 2 inti, `docs/EVALUASI.md` 3.7) |
| Uji penetrasi / tinjauan keamanan independen | Belum; hanya pemeriksaan sendiri (Origin, CSP ketat, pembatas laju, scrypt) dan `npm audit` |
| Pemulihan cadangan; migrasi data produksi | Belum; migrasi v0.1→v2 diuji pada basis data sintetis |
| `docker build`, `docker compose up`, GitHub Actions | Belum pernah dijalankan. Dockerfile tidak lagi mengompilasi better-sqlite3 (14 Nov 2026); kecocokan biner linux-x64 dengan glibc bookworm hanya dibaca dari simbol (≤ 2,34 terhadap 2,36), tidak dijalankan |
| Windows/macOS | Belum; hanya Linux x64 (Ubuntu 24.04), termasuk pasang bersih dari zip. Pustaka Python seperti `ai-edge-litert` dan `ffmpeg` di Windows belum diperiksa |
| Konsistensi teks Suroboyoan di antarmuka | Tidak dapat diuji oleh mesin; menunggu penutur asli (`docs/DAFTAR_VERIFIKASI.md`) |
