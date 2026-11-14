# Sumber dan asal bahan

Dokumen ini mendaftar **dari mana** setiap bahan non-kode berasal. Hanya sumber yang benar-benar tercantum di repositori ini (berkas seed, registri, atau dokumen lain) yang ditulis di sini; tidak ada sumber yang ditambahkan dari ingatan.

**Cara membaca status.** Halaman-halaman ini dibuka atau ditemukan lewat pencarian pada masa pengembangan (sampai 14 Nov 2026); **isi lengkap tiap sumber tidak diaudit**, tautan bisa berubah atau hilang dan tidak dipantau. "Sumber sekunder" berarti klaimnya dibaca dari tulisan pihak ketiga, bukan dari naskah primernya. Sumber populer (mis. artikel media) **bukan sumber akademik** dan hanya dipakai untuk contoh kosakata. Definisi Suroboyoan di kamus adalah **draf** menunggu penutur asli (`docs/DAFTAR_VERIFIKASI.md`).

## 1. Kamus se-LARAS (`seed/glossary.json`, 30 entri)

Tiap entri membawa label dan tautan sumbernya sendiri; berikut 13 tautan yang dipakai dan istilah yang bersandar padanya.

| Sumber | Jenis | Istilah yang bersandar padanya |
|---|---|---|
| [Wikipedia (id): Ludruk](https://id.wikipedia.org/wiki/Ludruk) | Ensiklopedia terbuka | Ludruk, Ngremo, Pak Sakera, Tandak, Wong cilik |
| [Wikipedia (id): Gamelan](https://id.wikipedia.org/wiki/Gamelan) | Ensiklopedia terbuka | Gamelan, Laras, Kendang, Saron |
| [Jurnal Deskovi (UMAHA): cengkok pada lawakan jula-juli](https://e-journal.umaha.ac.id/deskovi/article/download/1766/1027/4853) | Artikel jurnal | Kidungan, Gandangan, Pengidung |
| [Setiawan dkk., *Resital* 18(1), 2017: jula-juli Pandalungan dan Surabayan](https://journal.isi.ac.id/index.php/resital/article/download/2232/926) | Artikel jurnal | Jula-juli |
| [Jurnal Humaniora (UGM), artikel 5241: ludruk dan isu sosial](https://journal.ugm.ac.id/jurnal-humaniora/article/download/5241/4303) | Artikel jurnal | Parikan, Cak Durasim |
| [Lukitosari, *Identifying Sounds*, Leiden LEAP Graduate Journal, 2025](https://graduatejournal-leap.universiteitleiden.nl/wp-content/uploads/2025/05/Identifying-Sounds-Lukitosari.pdf) | Artikel jurnal | Dagelan |
| [Atlantis Press, artikel 125967641: komponen pertunjukan ludruk](https://www.atlantis-press.com/article/125967641.pdf) | Artikel (Atlantis Press) | Bedhayan, Lakon |
| [Jurnal LAKON (UNAIR), artikel 1916](https://e-journal.unair.ac.id/LAKON/article/download/1916/10702) | Artikel jurnal | Besut |
| [Ryanti & Rusmawati, *SAMASTA* (UMJ): ciri dialek Kota Surabaya](https://jurnal.umj.ac.id/index.php/SAMASTA/article/view/554%20%E2%80%93%20560/6640) | Artikel jurnal | Rek, Seh |
| [Subiyatningsih, makalah: Boso Suroboyoan dalam suvenir Cak Cuk](https://ki-demang.com/kbj5/images/MAKALAH%20KOMISI%20C/32%20Boso%20Suroboyoan%20Dalam%20Suvenir%20Cak%20Cuk.pdf) | Makalah | Cak |
| [Good News from Indonesia (2019): Boso Suroboyoan, kosakata khas](https://www.goodnewsfromindonesia.id/2019/03/17/boso-suroboyoan-kosakata-khas-arek-suroboyo-yang-tegas) | **Esai populer** | Boso Suroboyoan, Gak/ogak, Kate/kape, Mene, Maeng |
| [Good News from Indonesia (2019): Boso Suroboyoan, bahasa Jawa dengan keunikan Jawa Timur](https://www.goodnewsfromindonesia.id/2019/03/15/boso-suroboyoan-bahasa-jawa-dengan-keunikan-jawa-timur) | **Esai populer** | Arek |
| [Mojok.co: mertua ngapak dan mantu Suroboyoan](https://mojok.co/terminal/perseteruan-antara-mertua-ngapak-dan-mantu-suroboyoan-terminal-mulok-15/) | **Esai populer** | Sampeyan, Mari |

Beberapa entri mencantumkan lebih dari satu sumber dalam labelnya (`source_label`), tetapi tautan yang tersimpan satu per entri. Tes `test/glossary-seed.test.js` memastikan setiap entri punya sumber https dan istilah yang unik; tes itu **tidak** memeriksa bahwa definisinya benar.

## 2. Data dan literatur untuk dataset/pelatihan (`docs/DATASET_DAN_PELATIHAN.md`)

| Sumber | Dipakai untuk | Status |
|---|---|---|
| [OpenSLR SLR35, data pelatihan ASR bahasa Jawa](https://openslr.org/35/); [Kjartansson dkk., SLTU 2018](https://www.isca-archive.org/sltu_2018/kjartansson18_sltu.pdf) | Rencana pelatihan ASR; **bukan Suroboyoan** (Yogyakarta), CC BY-SA 4.0 | Dilihat; data tidak diunduh |
| [Common Voice Spontaneous Speech 3.0, Javanese](https://datacollective.mozillafoundation.org/datasets/cmmysfmtu00dwnz078kvqu1gp) | Dinilai terlalu kecil (32 klip, 3 penutur) | Dilihat; data tidak diunduh |
| [Krauße, *Features of Surabaya Javanese*, ISLOJ 2015 (abstrak)](https://indoling.com/isloj/5/abstracts/Krausse.pdf) | Penegas dua ragam lisan Jawa | Hanya abstrak |
| [Lukitosari, *Identifying Sounds*, Leiden LEAP 2025 (halaman artikel)](https://graduatejournal-leap.universiteitleiden.nl/2025/05/identifying-sounds-comparative-interpretations-of-sonic-histories-of-east-javanese-ludruk-folk-theater-performance/) | Konteks suara Ludruk | Dilihat |
| [Jawa Pos, 2026: arsip Kiprah Kartolo (ANRI)](https://www.jawapos.com/nasional/2605250337/arsip-kiprah-cak-kartolo-resmi-jadi-memori-kolektif-bangsa-surabaya-raih-tiga-penghargaan-nasional-kearsipan-2026) | Petunjuk arsip untuk ditanyakan langsung, **bukan** dataset | Berita |
| [Pratama & Amrullah, 2024, *PILAR*](https://ejournal.nusamandiri.ac.id/index.php/pilar/article/view/4633) | Angka WER Whisper PEFT dari **abstrak** | Hanya abstrak |
| [arXiv 2509.25878](https://arxiv.org/pdf/2509.25878) | Penyempurnaan Whisper pada subset OpenSLR | Dilihat; isi lengkap tidak diaudit |
| [LJ Speech](https://keithito.com/LJ-Speech-Dataset/) | Suara klip contoh dan data uji; dinyatakan domain publik di AS oleh pengumpulnya | Halaman pengumpul |

Kesimpulan yang tertulis di dokumen itu: **tidak ditemukan korpus ucapan Ludruk/Suroboyoan yang dapat diunduh**; ini tidak membuktikan korpus semacam itu tidak ada.

## 3. Data evaluasi (`analyzer/evaluation/data_registry.json`)

Tidak ikut dibagikan; diunduh dari asalnya dan diperiksa sha256. Status lisensi tiap berkas tertulis di `docs/EVALUASI.md` bagian 1 dan **sebagian besar belum diverifikasi**.

| Berkas | Asal unduhan |
|---|---|
| `jfk.wav` | `ggerganov/whisper.cpp` → `samples/jfk.wav` |
| `LJ001-0001.wav` | `coqui-ai/TTS` → `tests/data/ljspeech/wavs/LJ001-0001.wav` |
| `sample.wav` | `pyannote/pyannote-audio` → `tutorials/assets/sample.wav` |
| `silero_test.wav` | `snakers4/silero-vad` → `tests/data/test.wav` |
| `bus.jpg` | `ultralytics/yolov5` → `data/images/bus.jpg` |
| `vtest.avi` | `opencv/opencv` → `samples/data/vtest.avi` |

URL lengkap dan sha256 ada di registri.

## 4. Model (`analyzer/models/MODELS.json`)

| Model | Asal | Lisensi | sha256 (awal) |
|---|---|---|---|
| Silero VAD v6.2 (`silero_vad.onnx`) | [snakers4/silero-vad, tag v6.2.3](https://raw.githubusercontent.com/snakers4/silero-vad/v6.2.3/src/silero_vad/data/silero_vad.onnx) | MIT | `1a153a22…` |
| YOLOX-S (`yolox_s.onnx`) | [Megvii-BaseDetection/YOLOX, rilis 0.1.1rc0](https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_s.onnx) | Apache-2.0 | `c5c2d13e…` |
| BlazePose GHUM full (`pose_landmark_full.tflite`) | [google/mediapipe, tag v0.8.9](https://raw.githubusercontent.com/google/mediapipe/v0.8.9/mediapipe/modules/pose_landmark/pose_landmark_full.tflite) | Apache-2.0 | `e9a5c5cb…` |

Masing-masing dicocokkan byte demi byte dengan unduhan dari URL-nya pada 14 Nov 2026 dan dijaga oleh `test_models.py` serta `verify_models.py`. Teks lisensi ada di samping modelnya.

## 5. Hukum dan kebijakan (bukan nasihat hukum)

| Sumber | Dipakai untuk | Status |
|---|---|---|
| [PP 56/2022 tentang Kekayaan Intelektual Komunal](https://peraturan.bpk.go.id/Details/233504) | Ekspresi budaya tradisional sebagai KIK | Halaman peraturan.bpk.go.id |
| [UU 27/2022 tentang Pelindungan Data Pribadi (naskah di JDIH Kemenkeu)](https://jdih.kemenkeu.go.id/download/46c17b53-4a45-411c-9b76-c6799e5769fc/UU_Nomor_27_Tahun_2022%20Perlindungan%20Data%20Pribadi.pdf) | Data pribadi, persetujuan | Tautan naskah resmi; **pasal-pasal dikutip dari sumber sekunder** di bawah |
| [Jurnal *Yustisi*](https://ejournal.uika-bogor.ac.id/index.php/YUSTISI/article/download/24313/8693/116069); [SIP Law Firm](https://siplawfirm.id/resources/perlindungan-data-biometrik) | Biometrik sebagai data pribadi spesifik | **Sumber sekunder** |
| [Palas Rev (Unpatti)](https://ojs3.unpatti.ac.id/index.php/palasrev/article/download/13767/8190) | Kutipan UU Hak Cipta Pasal 38 tentang ekspresi budaya tradisional | **Sumber sekunder; kutipan perlu dicek pada naskah UU 28/2014** |

## 6. Aset visual dan huruf

| Bahan | Asal | Lisensi |
|---|---|---|
| Ilustrasi, tirai panggung, penari rangka, motif kawung/parang/ceplok/truntum | **Digambar sendiri** sebagai SVG untuk se-LARAS; pola kain tradisional digambar ulang, bukan salinan karya tertentu | Milik tim |
| Penari kartun pada klip contoh | Digambar dengan kode (`seed/fixtures/make_fixtures.py`) | Milik tim |
| Fraunces, Plus Jakarta Sans, Noto Sans Javanese | Paket npm `@fontsource` 5.3.0; proyek asal: [Fraunces](https://github.com/undercasetype/Fraunces), [Plus Jakarta Sans](https://github.com/tokotype/PlusJakartaSans), [Noto Sans Javanese](https://github.com/notofonts/javanese) | SIL OFL 1.1 (`public/fonts/LISENSI.txt`) |
| Foto dari internet | **Tidak ada yang dibundel.** Foto penampil nyata hanya boleh dipasang bila ada izin tertulis dan hak cipta fotografernya jelas | Tidak berlaku |

## 7. Yang tidak ada di daftar ini

- **Perpustakaan pihak ketiga** (npm dan pip): lisensinya mengikuti paket masing-masing; daftar lengkapnya **belum dikompilasi**.
- **Naskah juknis BUDAYA GO! 2026** adalah dokumen panitia; tidak disertakan di repositori ini dan tidak ditautkan di sini.
- **Pengetahuan tentang Ludruk di luar kamus** (mis. teks "Tentang"): bersandar pada sumber-sumber di bagian 1 dan **belum diperiksa maestro atau sejarawan**.
