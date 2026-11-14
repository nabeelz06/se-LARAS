# Evaluasi terukur mesin analisis se-LARAS

Dokumen ini melaporkan apa yang **diukur**, pada **data apa**, dengan **hasil dan batas** yang apa adanya. Semua angka berasal dari `analyzer/evaluation/results.json` (dibuat oleh `python3 -I evaluate.py all`; `npm run eval`). Angka yang dipakai kode (`calibration.json`) dibuat dari berkas yang sama, dan tes (`analyzer/tests/test_calibration.py`, `test_models.py`) gagal bila kode dan bukti menyimpang.

## 0. Baca ini dulu

1. **Tidak ada satu pun rekaman Ludruk di evaluasi ini.** Datanya publik dan non-Ludruk: pidato berbahasa Inggris, pembacaan buku berbahasa Inggris, satu foto jalan, satu video pejalan kaki. Hasilnya menunjukkan bahwa **komponen** bekerja pada data semacam itu; **tidak** menunjukkan akurasi pada pertunjukan Ludruk (gamelan, penonton, panggung, kostum, bahasa Jawa).
2. **Sampel kecil.** Bagian uji jeda hanya dua rekaman (±90 detik). "58 jeda sisipan" bukan 58 percobaan bebas: jeda disisipkan ke klip yang sama dengan empat undian acak. Selisih kecil antar kondisi tidak bermakna.
3. **Yang diukur adalah ukuran deskriptif**, bukan mutu penampilan dan bukan hasil belajar. se-LARAS tidak memberi skor; ia menyajikan selisih terhadap acuan maestro.
4. **Akurasi pose terhadap kebenaran dasar tidak diukur.** Hanya diperiksa bahwa model berjalan dan seberapa besar getarannya pada gambar diam.
5. **Data uji pernah terlihat** saat saya memilih lebar tepi penaksir tempo (bagian 3.4). Aturan pemilihan memakai himpunan latih saja, tetapi himpunan uji bukan data yang benar-benar bersih dari keputusan.

## 1. Data evaluasi

Berkas tidak dibagikan bersama kode (hak ciptanya milik pihak lain); `analyzer/evaluation/fetch_data.py` mengunduhnya dan memeriksa sha256 (`data_registry.json`). Enam berkas dipakai; empat berkas lain yang sempat ada di registri **dibuang karena tidak dipakai kode mana pun**.

| Berkas | Isi | Dipakai untuk | Sumber | Lisensi (status verifikasi) |
|---|---|---|---|---|
| `jfk.wav` | pidato 11 detik | latih jeda, DTW; SNR; stabilitas | `ggerganov/whisper.cpp`, `samples/` | Kode repositori MIT. **Asal dan lisensi berkas suaranya tidak tertulis di README sampel: perlu verifikasi** |
| `LJ001-0001.wav` | satu penutur perempuan membaca | latih jeda, DTW; nada; SNR; stabilitas | `coqui-ai/TTS`, `tests/data/ljspeech/` | Repositori MPL-2.0. LJSpeech menyatakan dirinya *public domain* di AS ([keithito.com](https://keithito.com/LJ-Speech-Dataset/)) |
| `sample.wav` | 30 detik, dua penutur | uji jeda; latih DTW (0–12 s); SNR; stabilitas | `pyannote/pyannote-audio`, `tutorials/assets/` | Repositori MIT. **Lisensi berkasnya: perlu verifikasi** |
| `silero_test.wav` | 60 detik | uji jeda; uji DTW (3 irisan 12 s); SNR; stabilitas | `snakers4/silero-vad`, `tests/data/` | Repositori MIT. **Lisensi berkasnya: perlu verifikasi** |
| `bus.jpg` | foto jalan: 4 orang dan 1 bus | deteksi orang, kewajaran pose, lantai getaran | `ultralytics/yolov5`, `data/images/` | Repositori **AGPL-3.0**. **Lisensi gambarnya: perlu verifikasi** |
| `vtest.avi` | video pejalan kaki | statistik jejak/pose pada kerumunan | `opencv/opencv`, `samples/data/` | Repositori Apache-2.0. **Lisensi videonya: perlu verifikasi** |

Lisensi repositori diperiksa pada 14 November 2026 dari berkas LICENSE masing-masing. Lisensi sebuah repositori **belum tentu** berlaku untuk berkas data di dalamnya, karena itu berkasnya tidak disalin ke dalam repositori se-LARAS.

Mesin dan pustaka (dicatat di blok `lingkungan` pada `results.json`): Python 3.13, numpy 2.5.3, scipy 1.18.1, librosa 1.0.1, onnxruntime 1.29.0, opencv-python-headless 5.0.0.93, ai-edge-litert 2.3.0; CPU 2 inti (Intel Xeon 2,30 GHz). Hash tiga model tercatat pada hasil dan dicocokkan dengan `analyzer/models/MODELS.json` oleh tes.

**Koreksi lingkungan (15 November 2026).** Di mesin evaluasi ini tiga distribusi OpenCV (`opencv-python`, `opencv-contrib-python`, `opencv-python-headless`; semuanya 5.0.0.93) terpasang berdampingan dan menimpa satu direktori `cv2` yang sama. Biner yang benar-benar termuat identik bit demi bit (sha256 diawali `c381f4ff`, 93.054.377 byte) dengan `cv2.abi3.so` pada wheel `opencv-contrib-python` 5.0.0.93, **bukan** dengan wheel `opencv-python-headless`. Jadi baris `opencv-python-headless 5.0.0.93` di atas dan di `results.json` benar sebagai paket yang terpasang, tetapi bukan build yang menjalankan evaluasi. Pada instalasi bersih yang hanya berisi `opencv-python-headless` (sesuai `requirements.txt` versi lama), `cv2.HOGDescriptor` tidak ada, sehingga jalur cadangan analisis gerak gagal; hal ini ditemukan oleh CI GitHub Actions pertama dan direproduksi lokal di lingkungan bersih. `analyzer/requirements.txt` kini meminta `opencv-contrib-python-headless`. Angka pada dokumen ini **tidak diulang** setelah koreksi: versi inti OpenCV sama (5.0.0), tetapi pustaka lain pada instalasi bersih lebih baru (mis. onnxruntime 1.32.0 dan numpy 2.5.4, dibanding 1.29.0 dan 2.5.3 pada tabel di atas).

**Keterulangan.** Evaluasi penuh dijalankan dua kali pada hari yang sama (sebelum dan sesudah perbaikan penaksir tempo, bagian 3.4): seluruh angka jeda, SNR, visi, nada, dan stabilitas **identik**; hanya waktu proses yang berbeda.

## 2. Ringkasan

| Komponen | Hasil utama | Batas terpenting |
|---|---|---|
| Deteksi jeda (Silero VAD, ambang dituning) | Pada himpunan uji, jeda sisipan ≥ 0,5 detik terdeteksi 94–100% di semua kondisi derau; rata-rata recall 0,874 dengan 0,67 jeda ekstra/menit (setelan resmi Silero: 0,766 dan 1,46) | Jeda 0,3 detik hanya 27–53% terdeteksi bila ada derau; jeda sisipan berupa keheningan digital, lebih mudah daripada jeda panggung |
| Perkiraan SNR | Galat −0,9 … +1,4 dB pada SNR nominal 0–10 dB (18 baris) | Tidak menghasilkan angka untuk satu dari empat klip; menaksir terlalu rendah pada klip yang sudah berderau |
| Penyejajaran DTW | Isi-sama dinilai andal 60/60, isi-beda dinilai tak andal 6/6 pada uji; galat rasio tempo ≤ 3,1% (uji) dan ≤ 1,4% (latih) pada kasus andal | Isi-beda hanya 3 pasang irisan satu rekaman; margin tipis (0,561 vs 0,62); "penutur berbeda" hanya disimulasikan |
| Deteksi orang (YOLOX-S) | 4 dari 4 orang pada foto uji | Satu foto |
| Pose (BlazePose) | Berjalan; getaran gambar diam terukur | **Akurasi tidak diukur**; lantai getaran dari 3 orang pada 1 foto |
| Nada | Rentang nada stabil terhadap pergeseran ±4 semiton (10,2 → 10,4 / 9,6) | Uji kewajaran satu klip, bukan akurasi |
| Stabilitas ukuran | Lantai kebisingan terukur untuk 9 ukuran; 4 ukuran ditandai rapuh terhadap derau | Empat klip, satu realisasi derau per kondisi |
| Kecepatan | Audio 60 detik ±1 detik (0,017× waktu nyata); gerak 60 detik ±19 detik (0,32×) | Satu mesin 2 inti, bergantung beban |

## 3. Hasil rinci

### 3.1 Deteksi jeda

**Cara.** Keheningan digital dengan panjang diketahui (0,3; 0,5; 0,8; 1,2; 2,0 detik) disisipkan di dalam ujaran (≥ 0,5 detik dari tepi segmen, antar sisipan ≥ 3 detik). Lalu derau putih atau merah muda ditambahkan pada SNR 20, 10, dan 5 dB terhadap RMS ujaran bersih. Sebuah jeda terdeteksi dianggap mengenai sisipan bila tumpang-tindihnya ≥ 50% panjang sisipan. **Jeda ekstra** = jeda terdeteksi yang tidak cocok dengan sisipan mana pun dan tidak tumpang-tindih dengan jeda alami yang dideteksi mesin yang sama pada klip bersih. Jeda alami *tidak* diberi label manusia; "ekstra" berarti "tambahan akibat derau menurut mesin itu sendiri", bukan laju alarm palsu terhadap kebenaran dasar. Jumlahnya kecil (kira-kira 1–12 kejadian per kondisi; tiap kondisi uji ±6,9 menit audio termasuk keheningan sisipan), jadi selisih 0,5/menit setara ±3 kejadian.

**Penalaan.** 576 kombinasi (ambang, margin negatif, jeda minimum, bantalan, ujaran minimum) dinilai pada **himpunan latih** (`jfk.wav`, `LJ001-0001.wav`; 4 undian; 15 sisipan per kondisi). Fungsi tujuan: recall rata-rata − 0,1 × jeda ekstra per menit rata-rata. Tujuan terbaik 0,943. Sebanyak 24 kandidat setara (selisih ≤ 0,01); dipilih yang terdekat dengan setelan resmi Silero. **Satu syarat ditambahkan setelah melihat data**: ambang 0,8 pernah kehilangan ujaran pada suara yang diubah warnanya (resampling ×0,85 dan ×1,2), maka kandidat harus mempertahankan recall bingkai ujaran ≥ 0,95 pada suara diubah di himpunan latih (hasil: 0,977 latih; 0,968 uji; minimum uji 0,94). Syarat ini tidak mengubah tujuan terbaik (0,943 dengan maupun tanpa syarat).

Setelan terpilih: ambang 0,8; margin negatif 0,15; jeda minimum 100 md; bantalan 15 md; ujaran minimum 250 md. Setelan resmi Silero: 0,5; 0,15; 100 md; 30 md; 250 md.

**Hasil pada himpunan uji** (`sample.wav`, `silero_test.wav`; 58 sisipan per kondisi; dua mesin Silero memakai peluang VAD yang sama, jadi selisihnya murni dari ambang dan pascapemrosesan; mesin "energi" adalah cara lama proyek ini sendiri, bukan metode pihak lain):

| Kondisi | Tuning: recall | ekstra/mnt | Resmi: recall | ekstra/mnt | Energi lama: recall | ekstra/mnt |
|---|---|---|---|---|---|---|
| tanpa derau | 1,000 | 0,15 | 0,845 | 0,00 | 0,828 | 0,00 |
| merah muda 20 dB | 0,862 | 0,44 | 0,776 | 1,46 | 0,121 | 2,92 |
| merah muda 10 dB | 0,862 | 0,58 | 0,776 | 1,75 | 0,000 | 0,00 |
| merah muda 5 dB | 0,879 | 1,17 | 0,759 | 1,75 | 0,000 | 0,00 |
| putih 20 dB | 0,879 | 0,44 | 0,776 | 1,75 | 0,155 | 2,04 |
| putih 10 dB | 0,845 | 0,88 | 0,724 | 1,75 | 0,000 | 0,00 |
| putih 5 dB | 0,793 | 1,02 | 0,707 | 1,75 | 0,000 | 0,00 |
| **rata-rata 7 kondisi** | **0,874** | **0,67** | 0,766 | 1,46 | 0,158 | 0,71 |

Catatan pembacaan:
- Rata-rata 7 kondisi memasukkan kondisi tanpa derau (recall 1,0). Hanya pada 6 kondisi berderau: tuning 0,853; resmi 0,753; energi lama 0,046. Cara lama praktis tidak bekerja pada rekaman berderau.
- Menurut panjang sisipan (tuning): **≥ 0,5 detik: 0,94–1,00 di semua kondisi** (satu-satunya nilai di bawah 1,0 adalah derau putih 5 dB pada 0,5 detik: 0,94). **0,3 detik: 1,00 tanpa derau, tetapi 0,27–0,53 bila berderau.** Produk memperlakukan jeda ≥ 0,25 detik sebagai jeda; pada rekaman berderau, jeda 0,25–0,5 detik tidak dapat diandalkan. Karena itu ukuran jeda ditandai rapuh terhadap derau (bagian 3.7) dan tidak dibandingkan bila SNR perkiraan < 10 dB.
- Jeda panjang (≥ 0,8 detik, ambang yang dipakai `long_pauses_per_min`): terdeteksi **100%** pada semua kondisi uji.
- Galat panjang jeda: rata-rata 0,09 detik (bersih) dan 0,13–0,15 detik (berderau).
- Perbedaan antar empat kandidat per-ambang pada uji kecil (recall 0,850–0,862, ekstra 0,46–0,69/menit; `kompromi_per_ambang` di hasil): **pilihan tepat di antara kandidat setara tidak dapat dibedakan secara statistik**. Yang kuat adalah selisih terhadap setelan resmi dan terhadap cara lama.
- Pada himpunan latih, setelan terpilih: recall 0,87–1,00 dan jeda ekstra 0 per kondisi (15 sisipan per kondisi). Bagian latih memang lebih baik; yang dilaporkan di atas adalah uji.

**Kepekaan pada ujaran pelan.** Tingkat ujaran keempat klip berkisar −15,5 sampai −32,1 dBFS. Dengan ambang 0,8 dan **tanpa** normalisasi tingkat, recall bingkai ujaran merosot menjadi 0,85 pada −30 dB dan **0,35 pada −40 dB**; **dengan** normalisasi tingkat (yang dipakai produk) tetap 0,98–0,99 sampai −40 dB. Normalisasi tingkat karenanya bagian penting dari ambang tinggi 0,8. Yang diuji hanya penurunan gain, bukan SNR rendah.

### 3.2 Perkiraan SNR

Klip + derau pada SNR nominal 0, 5, 10, 20, 30 dB terhadap RMS ujaran klip bersih; empat klip, dua jenis derau (44 baris). Kebenaran dasar tidak persis: klip aslinya sudah berderau, jadi SNR sebenarnya sedikit di bawah nominal pada SNR tinggi.

| SNR nominal | n | galat median (dB) | rentang galat (dB) |
|---|---|---|---|
| 30 | 6 | −3,5 | −9,5 … −2,6 |
| 20 | 6 | −0,4 | −2,4 … +0,3 |
| 10 | 6 | +0,1 | −0,4 … +0,9 |
| 5 | 6 | +0,3 | −0,9 … +1,1 |
| 0 | 6 | +0,1 | −0,3 … +1,4 |

Median keseluruhan −0,2 dB; persentil-90 galat mutlak 3,4 dB (didorong baris 30 dB). Yang menentukan produk adalah ambang SNR < 10 dB untuk peringatan `derau_tinggi`; pada SNR nominal 10 dB (6 baris) galatnya −0,4 … +0,9 dB. **Pembatas:** 11 dari 44 baris tidak menghasilkan perkiraan (seluruhnya klip `LJ001-0001.wav`; penaksir menolak menjawab, bukan menjawab salah), dan tanpa perkiraan tidak ada peringatan derau.

### 3.3 Nada

Rentang nada (p90−p10, semiton) pada `LJ001-0001.wav` setelah pergeseran −4 dan +4 semiton: 10,4 dan 9,6 terhadap 10,2 asli. Ini uji kewajaran bahwa ukuran tidak ikut bergeser bersama nada keseluruhan, **bukan** pengukuran akurasi nada.

### 3.4 Penyejajaran waktu (DTW) dan rasio tempo

**Cara.** "Isi-sama" = klip yang sama diregangkan waktunya dengan ffmpeg `atempo` (×0,8; 0,9; 1,1; 1,25; 1,5), lalu (a) bersih, (b) ditambah derau putih 10 dB, atau (c) warna suara diubah (resampling ×0,85 dan ×1,2) — pendekatan kasar untuk "penutur lain"; **bukan penutur berbeda sungguhan**. "Isi-beda" = pasangan irisan berbeda. Klip dengan ujaran < 4 detik ditolak penyejajar (7 dari 60 kasus latih, semuanya dari `sample.wav[0–12 s]`; tidak dihitung).

- **Latih:** `jfk.wav`, `LJ001-0001.wav`, `sample.wav` detik 0–12 → 53 kasus isi-sama, 6 isi-beda.
- **Uji:** tiga irisan 12 detik dari `silero_test.wav` (detik 0, 24, 48) → 60 kasus isi-sama, 6 isi-beda (permutasi dari 3 irisan **satu rekaman**, jadi hanya 3 pasang berbeda).

**Ambang keandalan (biaya rata-rata penyejajaran).** Dipilih pada himpunan latih: 0,58 (akurasi seimbang latih 0,953; 5 dari 53 isi-sama latih dinilai tak andal, semuanya suara diubah ×1,2 dengan biaya 0,596–0,62; kelas isi-beda latih 0,587–0,743 sehingga **kelas-kelas bertumpang tindih pada latih**). Pada uji: isi-sama 60/60 andal (biaya maks 0,561) dan isi-beda 6/6 tak andal (biaya min 0,620). **Margin tipis**: 0,561 vs 0,620, hanya tiga pasang isi-beda. Pada rekaman nyata dengan penutur dan kondisi berbeda, penyejajaran isi-sama yang sah bisa melewati ambang; hasilnya: aplikasi **tidak menampilkan** tempo (gagal ke arah aman), bukan menampilkan angka salah.

**Masalah yang ditemukan dan diperbaiki.** Versi pertama menghitung rasio tempo dari rasio durasi ujaran awal–akhir (`span_ratio`), yang bergantung pada tepi ujaran dari VAD. Pada kasus andal himpunan latih galatnya sampai **17,1%** (median 0,5%; persentil-90 16,8%), terutama pada `sample.wav[0–12 s]` yang dua penutur dan terpotong di tengah ujaran: satu segmen liar atau hilang di tepi menggeser rasio walau biaya penyejajaran rendah ("andal"). Dengan toleransi "dekat" ±10% pada antarmuka, galat sebesar itu bisa membalik pesan. Perbaikan: rasio tempo kini adalah **kemiringan jalur penyejajaran di bagian dalam klip** (regresi linear, tepi dibuang 15% atau minimal 0,5 detik); rasio durasi tetap dicatat sebagai `span_ratio` sebagai pembanding.

Lebar tepi dipilih **hanya** dari himpunan latih (aturan: galat maksimum terkecil pada kasus andal; seri: persentil-90). Penyapuan (galat rasio tempo, kasus andal):

| Tepi dibuang | Latih: median / p90 / maks (%) | Uji: median / p90 / maks (%) |
|---|---|---|
| 0% | 0,17 / 3,61 / 4,68 | 0,06 / 0,33 / 1,68 |
| 5% | 0,17 / 3,61 / 4,68 | 0,06 / 0,31 / 1,50 |
| 10% | 0,24 / 3,02 / 4,11 | 0,10 / 0,33 / 1,99 |
| **15% (dipilih)** | **0,24 / 0,73 / 1,40** | **0,08 / 0,65 / 3,10** |
| 20% | 0,24 / 1,14 / 2,22 | 0,12 / 1,05 / 6,33 |
| 25% | 0,24 / 1,18 / 2,82 | 0,11 / 0,85 / 9,27 |

Hasil akhir pada kasus andal (tepi 15%): **latih (n = 48): median 0,2%, p90 0,73%, maks 1,4%** (sebelumnya 0,5 / 16,8 / 17,1); **uji (n = 60): median 0,1%, p90 0,62%, maks 3,1%** (sebelumnya 0,6 / 3,9 / 4,9). Pada uji, tepi 0–10% sebenarnya sedikit lebih baik (maks 1,5–2,0%) dan tepi ≥ 20% jauh lebih buruk: lebar 15% adalah pilihan latih, bukan optimum uji. Galat maksimum uji juga bergantung pada undian derau: pada satu percobaan tambahan dengan undian derau lain (skrip sementara, tidak disimpan di repositori) maksimum uji pada tepi 15% adalah 0,93%, bukan 3,1%.

Pada kasus **tak andal** galat bisa sangat besar (maks 67,9% pada latih), tetapi tempo tidak ditampilkan bila `reliable = false`. Galat jalur penyejajaran (sisi dalam, terhadap peta waktu sebenarnya): median 0,02 detik; p90 0,04 detik; maks 1,51 detik (latih), 0,07 detik (uji).

**Tes regresi** (`analyzer/tests/test_align.py`): sinyal sintetis dengan letupan liar 0,35 detik di awal dan akhir; rasio durasi meleset > 8% sementara rasio tempo baru dalam 3% (tes diuji dengan mutasi: bila penaksir dikembalikan ke rasio durasi, tes gagal: 1,532 vs 1,25).

**Yang tidak ditunjukkan:** peregangan seragam pada isi yang sama tidak mewakili pelajar nyata (tempo tidak seragam, frasa berbeda, jeda sendiri, dialek lain). Hasil ini hanya menunjukkan bahwa penaksir tidak bias pada kasus yang kebenarannya diketahui.

### 3.5 Visi: orang dan pose

- `bus.jpg`: YOLOX-S menemukan **4 dari 4** orang (acuan: pembacaan manual penulis); skor 0,91; 0,89; 0,89; 0,45 (orang keempat terpotong di tepi gambar). Pemeriksaan "kewajaran pose" (hidung di atas bahu di atas pinggul, visibilitas titik > 0,5) lolos pada keempatnya; **ini pemeriksaan bentuk, bukan akurasi titik kunci**.
- **Lantai getaran.** Tiga kotak orang terbesar dipotong, lalu dijadikan video 12 detik dengan goyangan kamera acak ±2 piksel dan derau piksel (σ = 3). Seharusnya tidak ada gerak. Terukur: kecepatan tangan rata-rata 0,122; 0,359; 0,395 (panjang badan/detik) dan variasi kemiringan badan 0,31; 0,93; 0,50 derajat; dua dari tiga memunculkan peringatan "banyak orang terdeteksi" (potongan memuat orang lain). Kalibrasi memakai **median kecepatan tangan (0,36)** dan **maksimum variasi kemiringan (0,93°)**. Ini sumber kecil (satu foto, tiga potongan, gerak buatan), dan tidak mencakup pencahayaan panggung, kostum, atau pose yang tersembunyi.
- `vtest.avi` (60 detik pejalan kaki): median 6 orang per bingkai, 53 jejak orang; jejak yang dipakai adalah nomor 19, dipilih otomatis karena luas kotaknya terbesar (bukan pilihan manusia); titik kunci tubuh terdeteksi pada 55,8% bingkai yang dicoba untuk jejak itu (tingkat deteksi pose 0,558); peringatan `banyak_orang_terdeteksi` dan `pose_sulit_dideteksi` muncul. Ini menunjukkan **perilaku gagal-aman pada kerumunan**; **bukan** uji akurasi.
- Batas penting untuk Ludruk: pose dalam kerumunan panggung, pemain tumpang-tindih, dan kostum menyulitkan; aplikasi meminta maestro memilih "penampil utama" bila ≥ 2 orang terdeteksi.
- `gesture_speech_lag_s` lantai 0,2 detik adalah batas prinsip (resolusi waktu pose 5 bingkai/detik), **bukan hasil ukur**.

### 3.6 Stabilitas ukuran suara dan lantai kebisingan

Setiap ukuran dihitung pada klip asli dan pada varian yang **bukan** perbedaan penampilan: gain ×0,5 dan ×2; derau putih dan merah muda 20 dB; derau putih dan merah muda 10 dB (empat klip → 8 selisih per kelompok). Dilaporkan persentil-90 dan maksimum selisih mutlak. **Lantai** = maks(p90 gain, p90 derau 20 dB), dibulatkan ke atas; **rapuh** bila p90 derau 10 dB > 2 × lantai.

| Ukuran | Lantai | p90 derau 10 dB | Rapuh pada derau 10 dB |
|---|---|---|---|
| `pause_mean_s` (detik) | 0,025 | 0,130 | ya |
| `long_pauses_per_min` | 0,024 | 0,169 | ya |
| `onset_rate_per_s` | 1,1 | 0,598 | tidak |
| `speech_ratio` | 0,03 | 0,041 | tidak |
| `dynamic_range_db` | 3,9 | 10,73 | ya |
| `pitch_range_st` | 0,2 | 1,03 | ya |
| `wrist_speed_mean` | 0,36 | — | — |
| `torso_lean_std_deg` | 0,93 | — | — |
| `gesture_speech_lag_s` | 0,2 | — | — |

Aplikasi memakai lantai itu sebagai pita "dekat dengan acuan" minimum: perbedaan lebih kecil dari lantai tidak pernah disebut "lebih tinggi/lebih rendah". Pitanya adalah maks(|acuan| × toleransi maestro, lantai). Untuk ukuran yang rapuh, aplikasi **tidak membandingkan** bila SNR perkiraan < 10 dB (`derau_tinggi`). Lantai ini mengukur **kebisingan pengukuran**, bukan seberapa besar selisih yang penting secara artistik; itu keputusan maestro (toleransi per dimensi rubrik).

### 3.7 Kecepatan

Pada mesin 2 inti: analisis audio 60 detik ±1,0 detik (0,017× waktu nyata); analisis gerak pada video 60 detik ±19 detik (0,32× waktu nyata; run sebelumnya 0,30–0,38×). Untuk klip maksimum 150 detik, gerak diperkirakan ±50 detik (hitungan 0,32 × 150, bukan pengukuran; video uji berisi banyak orang sehingga lebih lambat daripada satu penampil). Analisis berjalan antre satu per satu (`src/analysis.js`).

## 4. Mengulang dan memperluas

```bash
cd analyzer
python3 -I evaluation/fetch_data.py       # unduh data publik + periksa sha256 (butuh akses raw.githubusercontent.com)
python3 -I evaluate.py all                # ±5 menit; menulis evaluation/results.json dan calibration.json
python3 -I evaluate.py dtw --out /tmp/x/r.json   # satu bagian saja ke berkas lain (tidak menimpa hasil resmi)
python3 -I -m unittest discover -s tests -t .    # kode harus sama dengan bukti (test_calibration, test_models)
```

Untuk menilai **rekaman Ludruk berizin** (bila sudah ada):
1. Tambahkan kelas data baru di `evaluate.py` dengan **pembagian latih/uji menurut penutur dan sesi**, bukan acak per klip.
2. Beri label jeda dan gerak **manusia** (dua pencatat; ukur kesepakatan), bukan jeda sisipan.
3. Ukur pose terhadap titik kunci berlabel pada sampel (akurasi belum pernah diukur).
4. Jalankan ulang, baca selisih `calibration.json` (lantai dan ambang akan berubah), dan perbarui bagian ini; jangan menyalin angka dari dokumen ke kode (`write_calibration` membuatnya langsung dari hasil).

## 5. Yang boleh dan tidak boleh diklaim dari evaluasi ini

**Boleh:** "Komponen analisis diuji pada data publik non-Ludruk dengan data latih/uji terpisah dan hasil yang dapat diulang; ambang dan lantai kebisingan berasal dari pengukuran itu; kelemahan yang ditemukan (jeda pendek di derau, rasio tempo bergantung tepi) tercatat dan, bila bisa, diperbaiki dengan tes regresi."

**Tidak boleh:** angka akurasi pada pertunjukan Ludruk; "akurasi pose X%"; "AI menilai penampilan"; menyebut jumlah jeda sisipan sebagai jumlah sampel bebas; menyiratkan bahwa suara yang diubah warnanya sama dengan penutur berbeda.
