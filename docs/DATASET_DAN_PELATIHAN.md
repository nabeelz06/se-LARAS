# Dataset dan "pelatihan" di se-LARAS: apa yang ada, apa yang tidak

Dokumen ini sengaja ditulis lebih dulu sebagai **batas klaim**. Isinya menjawab tiga pertanyaan yang pasti diajukan juri atau penguji: *datanya dari mana? modelnya dilatih dengan apa? apa buktinya?*

## 1. Ringkasan jujur

1. **Belum ada dataset Ludruk/Suroboyoan di se-LARAS.** Aplikasi tidak membawa data Ludruk bawaan; satu-satunya data yang akan masuk adalah klip yang diunggah maestro dengan izin tertulis.
2. **Tidak ada model yang dilatih pada data Ludruk atau Suroboyoan.** Tidak ada model ASR yang disertakan. Tidak ada angka WER/CER dari se-LARAS.
3. **Yang dikerjakan nyata** (dan bisa dijalankan ulang): (a) tiga model praktis-pakai (*pretrained*) diverifikasi asal dan checksum-nya; (b) parameter dan ambang pengukuran **dituning dan dikalibrasi pada data publik non-Ludruk**, dengan angka dan batasnya di `docs/EVALUASI.md`; (c) saluran data berizin dari klip maestro sampai manifest ASR dan pembagian menurut penutur, diuji ujung-ke-ujung pada klip sintetis; (d) alat ukur WER/CER siap pakai untuk saat korpus transkripsi ada.
4. Karena itu kata yang boleh dipakai di proposal adalah **"analisis deskriptif berbasis model terlatih-sebelumnya dan terkalibrasi"**, bukan "AI yang dilatih dengan data Ludruk". Lihat bagian 8.

## 2. Apa arti "pelatihan" untuk tiap komponen

| Komponen | Model / metode | Asal dan lisensi | Dilatih ulang proyek ini? | Yang benar-benar dilakukan |
|---|---|---|---|---|
| Deteksi ujaran dan jeda | Silero VAD, rilis v6.2 (ONNX) | Silero Team, MIT | **Tidak** | Memilih ambang dengan pencarian 576 kombinasi pada klip publik (latih: `jfk.wav`, `LJ001-0001.wav`; uji: `sample.wav`, `silero_test.wav`) |
| Deteksi orang | YOLOX-S (ONNX) | Megvii, Apache-2.0 | **Tidak** | Diuji pada satu gambar (`bus.jpg`, 4 orang) dan satu video pejalan kaki (`vtest.avi`) |
| Pose tubuh | BlazePose GHUM *full* (TFLite) | Google MediaPipe, Apache-2.0 | **Tidak** | Mengukur lantai kebisingan ukuran gerak pada gambar diam; akurasi terhadap kebenaran dasar **tidak** diukur |
| Penyejajaran tempo | DTW pada MFCC | Metode klasik, tanpa parameter terlatih | — | Ambang biaya keandalan 0,58 dan lebar tepi penaksir tempo (15%) dipilih dari himpunan latih; penaksir diperbaiki setelah evaluasi sendiri menemukan galat hingga 17% pada rasio durasi lama (`docs/EVALUASI.md` 3.4) |
| Lantai kebisingan ukuran | Statistik stabilitas | — | — | Dari uji gain dan derau (`evaluation/calibration.json`) |
| Pengenalan ujaran (ASR) | **Tidak ada** | — | **Tidak** | Hanya pintu opsional `ASR_COMMAND_JSON` dan penghitung WER/CER |
| Usulan teks | Opsional (`ANTHROPIC_API_KEY`) | API pihak ketiga | **Tidak** | Hasil selalu berstatus draf |

Asal tiap model dicatat di `analyzer/models/MODELS.json` (URL yang dipatok pada tag/rilis, ukuran, sha256, lisensi). **Ketiganya dicocokkan byte-per-byte dengan unduhan dari URL itu pada 2026-11-14**, dan dijaga tes (`analyzer/tests/test_models.py`; `python3 verify_models.py --online` mengunduh ulang). Dalam proses ini ditemukan dan dikoreksi satu kesalahan: berkas VAD ternyata rilis **v6.2** (identik dengan tag v6.2–v6.2.3), bukan v5 seperti sempat tertulis; angka evaluasi tidak terpengaruh karena diukur pada berkas yang sama, tetapi labelnya salah, dan kini ada tes yang mencegah label menyimpang dari registri.

## 3. Pencarian dataset (14 November 2026)

Pencarian dilakukan lewat mesin pencari web dan beberapa halaman sumber. Temuan:

| Sumber | Isi | Cocok untuk se-LARAS? |
|---|---|---|
| [OpenSLR SLR35](https://openslr.org/35/) "Large Javanese ASR training data set" | ±185 ribu ujaran bahasa Jawa; lisensi CC BY-SA 4.0 | **Bukan Suroboyoan.** Dikumpulkan bersama Universitas Gadjah Mada (Yogyakarta); menurut makalah pendampingnya korpus ini disusun lewat urun-suara ([Kjartansson dkk., SLTU 2018](https://www.isca-archive.org/sltu_2018/kjartansson18_sltu.pdf)). Berguna sebagai *awal* untuk model bahasa Jawa umum, bukan untuk dialek *arek* di panggung |
| [Common Voice Spontaneous Speech 3.0 – Javanese](https://datacollective.mozillafoundation.org/datasets/cmmysfmtu00dwnz078kvqu1gp) | 32 klip, 0,17 jam, 3 penutur; CC0 | Terlalu kecil |
| [Krauße, "Features of Surabaya Javanese (Suroboyoan)", ISLOJ 2015](https://indoling.com/isloj/5/abstracts/Krausse.pdf) | Abstrak penelitian fitur dialek memakai bahan JTV dan transkripsi penutur asli | Bukan korpus yang dirilis. Berguna sebagai penegas bahwa ada dua ragam besar bahasa Jawa lisan: *bocah* (Jawa Tengah) dan *arek* (Jawa Timur, termasuk Suroboyoan) |
| Pustaka riset Ludruk | Kajian bunyi, struktur, regenerasi (mis. [Leiden LEAP 2025](https://graduatejournal-leap.universiteitleiden.nl/2025/05/identifying-sounds-comparative-interpretations-of-sonic-histories-of-east-javanese-ludruk-folk-theater-performance/)) | Kajian, bukan data mesin-terbaca |
| [Jawa Pos, 2026](https://www.jawapos.com/nasional/2605250337/arsip-kiprah-cak-kartolo-resmi-jadi-memori-kolektif-bangsa-surabaya-raih-tiga-penghargaan-nasional-kearsipan-2026) | Arsip "Kiprah Kartolo: Maestro Seni Tradisi Kesenian Ludruk 1950–2025" diberi Registrasi Memori Kolektif Bangsa oleh ANRI (upacara 20 Mei 2026). Artikel tidak menyebut siapa pemegang arsipnya | **Petunjuk, bukan dataset.** Bukti bahwa arsip Ludruk bernilai nasional ada; aksesnya harus lewat pemegang arsip dan izin |
| Vendor komersial (mis. Pangeanic menawarkan korpus Jawa 64 jam berlisensi komersial) | Tidak diperiksa | Mutu, dialek, dan harga tidak dinilai; tidak ada indikasi Suroboyoan/Ludruk |

**Kesimpulan:** tidak ditemukan korpus ucapan Ludruk/Suroboyoan yang bisa diunduh. Ini **tidak membuktikan bahwa korpus semacam itu tidak ada**. *Perlu verifikasi* lewat pertanyaan langsung (bukan lewat web) kepada: pemegang arsip Kartolo/ANRI dan Dinas Perpustakaan dan Kearsipan Surabaya, Balai Bahasa Provinsi Jawa Timur, perguruan tinggi yang meneliti Ludruk/Suroboyoan (mis. Universitas Surabaya, UNESA, ITS), dan sanggar Ludruk sendiri.

## 4. Mengapa tidak mengambil suara dari YouTube atau televisi

Pengambilan massal rekaman pertunjukan dari platform tidak dilakukan: hak cipta pertunjukan dan rekaman ada pada pihak lain, suara dan wajah pemain adalah data pribadi yang diproses tanpa persetujuan, dan prinsip produk ini adalah **izin tertulis dahulu**. Pilihan itu lebih lambat, tetapi satu-satunya yang konsisten dengan klaim "pengetahuan tervalidasi maestro".

## 5. Saluran data se-LARAS (nyata, teruji, dan kosong sampai maestro mengisinya)

```
klip maestro + izin tertulis ──► unggah (ffprobe, hash) ──► buku jejak: unit_dibuat
        │
        ▼
maestro menyahkan: transkrip (Suroboyoan + Indonesia), momen, rubrik ──► unit sah
        │
        ▼  izin TERPISAH, dapat dicabut: data_use = "riset"
node scripts/export-dataset.js --out ekspor --media
        │   (hanya: sah + riset + bukan contoh + berkas ada + hash cocok; tanpa nama pemberi izin; latihan pelajar TIDAK PERNAH ikut)
        ▼
ekspor/manifest.jsonl  datacard.md  SHA256SUMS  media/unit_N.ext
        │
        ▼
python3 analyzer/manifest_to_asr.py ekspor/manifest.jsonl asr/ --speaker-map penutur.json   # potong per segmen sah → WAV 16 kHz mono; pemetaan penutur dari lembar izin
        │
        ▼
python3 analyzer/make_splits.py asr/asr_manifest.jsonl splits/      # latih/dev/uji TIDAK berbagi penutur (min. 5 penutur)
        │
        ▼
(pelatihan di luar se-LARAS, mis. di server ber-GPU)  →  hipotesis.jsonl
        │
        ▼
python3 analyzer/asr_eval.py rujukan.jsonl hipotesis.jsonl           # WER dan CER dengan rincian sub/hapus/sisip
```

Yang menjaga rantai ini:

- **Gerbang ekspor** di `src/dataset.js`; tesnya "admin: …korpus riset hanya klip sah+izin riset+bukan contoh…".
- **`manifest_to_asr.py`** hanya memotong segmen yang **disahkan** maestro; segmen tanpa batas akhir yang ditetapkan **dilewati** (kecuali `--derive-end`, ditandai `end_basis: "turunan"` karena kasar); segmen tanpa teks/terlalu pendek/terlalu panjang dihitung dan dilaporkan; jalur media di luar paket ditolak. Tes: `analyzer/tests/test_manifest_to_asr.py` (8 tes).
- **`make_splits.py`** menetapkan bagian lewat hash penutur (tetap dari run ke run) dan **menolak** membagi bila penutur kurang dari 5, agar suara penutur yang sama tidak bocor ke data uji dan menggelembungkan angka.
- **Uji ujung-ke-ujung** `test/dataset-pipeline.test.js`: lima maestro sintetis → unit sah berizin riset → ekspor dengan media → manifest ASR (10 ujaran dari 5 unit) → pembagian menurut penutur tanpa irisan; klip keenam tanpa izin riset terbukti tidak ikut; nama pemberi izin terbukti tidak diekspor. Klip yang dipakai sintetis (pembacaan LJSpeech + penari kartun buatan tim), jadi tes ini menguji **pipa**, bukan mutu data.
- **Kartu data** (`datacard.md`) dibuat otomatis dan menyatakan apa adanya: korpus kosong bila kosong, jumlah penutur, bahwa transkrip belum diperiksa penutur kedua, bahwa kesepakatan antar-anotator belum diukur.

**Batas saluran yang diketahui.**
- `speaker_key` = `m<id akun maestro>`: ia mengidentifikasi **akun pengunggah**, bukan orang yang tampil di klip. Bila satu akun mengunggah klip beberapa penampil, atau satu penampil muncul di beberapa akun, pembagian "menurut penutur" tidak menjamin penutur terpisah. Sebelum membagi, petakan penutur sebenarnya dengan `--speaker-map penutur.json` (`{"unit:12": "penampil-A", "m3": "penampil-B"}`; kunci unit menang atas kunci akun). Pemetaan dibuat manusia dari lembar izin; sistem tidak menebaknya dan belum punya kolom penutur sendiri. Tanpa `--speaker-map`, skrip mencetak peringatan.
- Tidak ada pemeriksaan penutur kedua atas transkrip di dalam aplikasi; kesepakatan antar-pencatat harus diukur di luar (lihat protokol).
- Segmen tanpa batas akhir yang ditetapkan maestro dilewati (kecuali `--derive-end`, yang kasar).

Protokol pengumpulan (izin, perekaman, anotasi, penyimpanan) ada di `docs/PROTOKOL_PENGUMPULAN_DATA.md`.

## 6. Penyesuaian non-ML yang bisa diulang bila data nyata ada

`python3 analyzer/evaluate.py all` menjalankan seluruh evaluasi (jeda, SNR, DTW, visi, nada, stabilitas, kecepatan) dan menulis `evaluation/results.json` serta `evaluation/calibration.json`, yang **dibaca oleh aplikasi saat dimuat** (`src/metrics.js`: lantai kebisingan, ambang keandalan). Hasil kini memuat blok `lingkungan` (hash model dan versi pustaka); tes memastikan hash itu sama dengan `MODELS.json`, sehingga angka tidak bisa menempel pada model yang berbeda. Langkah untuk memasukkan rekaman Ludruk berizin ke evaluasi (menambah kelas data di `evaluate.py`, mengulang, memeriksa diff kalibrasi) dijelaskan di `docs/EVALUASI.md`.

## 7. Rencana pelatihan ASR (rencana, **bukan** kenyataan)

Dasar yang diketahui dari pustaka (sumber yang benar-benar dibaca; keduanya pada bahasa Jawa umum, bukan Suroboyoan panggung):

- Whisper tanpa penyempurnaan buruk pada bahasa Jawa; penyempurnaan efisien-parameter (PEFT/LoRA, <1% parameter dilatih) pada Whisper large-v2 melaporkan WER 13,77% dibanding 89,40% sebelum penyempurnaan ([Pratama & Amrullah, 2024](https://ejournal.nusamandiri.ac.id/index.php/pilar/article/view/4633)). Angka ini dari abstrak; rincian data dan kondisi uji *perlu dibaca di makalahnya*.
- Penyempurnaan Whisper pada subset OpenSLR (±60 jam latih) dan ketahanannya terhadap derau ditelaah di [arXiv 2509.25878](https://arxiv.org/pdf/2509.25878); makalah itu sendiri mengakui korpus OpenSLR bersifat regional (Yogyakarta/Bandung) dan derau yang dipakai sintetis.

Tahapan yang masuk akal, dengan **kriteria berhenti yang ditetapkan sebelum melihat hasil uji**:

1. **Syarat masuk:** ≥ 5 penutur berizin dengan transkrip yang disahkan dan diperiksa penutur kedua; ukur kesepakatan antar-pencatat pada sampel. Tanpa itu, jangan melatih.
2. **Dasar pembanding:** WER/CER model tanpa penyempurnaan pada *uji yang dipegang terpisah* (`asr_eval.py`).
3. **Penyesuaian:** mulai dari model Jawa/multibahasa yang sudah ada, lalu sesuaikan dengan data Suroboyoan berizin; GPU diperlukan dan **tidak tersedia di lingkungan pengembangan ini**.
4. **Evaluasi jujur:** laporkan WER pada penutur yang tidak pernah dilihat model, dipisah menurut kondisi (bersih / ada iringan / ada penonton). Tidak ada ambang jumlah-jam universal; tentukan lewat kurva WER terhadap jumlah data pada himpunan dev.
5. **Keluaran** tetap **draf** yang harus disahkan maestro; ASR tidak pernah menggantikan pengesahan.

Risiko yang sudah terlihat: perbedaan dialek (*arek* vs *bocah*), register panggung dan improvisasi, tumpang-tindih suara/iringan gamelan/penonton, alih kode Jawa–Indonesia, dan **lisensi**: OpenSLR SLR35 berlisensi CC BY-SA 4.0; apakah bobot model yang disempurnakan darinya wajib berlisensi sama adalah pertanyaan hukum yang belum mapan — *perlu verifikasi hukum* sebelum merilis model.

## 8. Yang boleh dan tidak boleh diklaim

**Boleh** (semuanya bisa ditunjukkan dengan perintah di repositori):
- "Analisis deskriptif jeda, tempo, dan gerak memakai model terlatih-sebelumnya (Silero VAD, YOLOX-S, BlazePose), dengan ambang dan lantai kebisingan *diukur* pada data publik."
- "Setiap pengetahuan yang tampil kepada pelajar disahkan maestro; usulan mesin selalu berstatus draf."
- "Saluran data berizin dari maestro sampai manifest ASR dan pembagian menurut penutur sudah berjalan dan teruji pada klip sintetis."
- "Asal dan checksum seluruh model tercatat dan diperiksa tes."

**Tidak boleh:**
- "AI yang dilatih dengan data Ludruk/Suroboyoan", "model ASR Suroboyoan", angka WER apa pun dari se-LARAS.
- "Akurasi X% pada pertunjukan Ludruk": evaluasi hanya pada data publik non-Ludruk dan sintetis.
- "Menilai penampilan" atau skor mutu: produk hanya menyajikan selisih deskriptif terhadap acuan maestro.
- Menyiratkan bahwa klip contoh (LJSpeech + penari kartun buatan tim) adalah rekaman Ludruk, atau bahwa produk ada sebelum 31 Maret 2026 (build pertama 2026-11-14).
