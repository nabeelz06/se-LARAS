# Protokol pengumpulan dan pengolahan data (draf operasional)

**Status:** draf kerja tim. **Belum ditinjau** penasihat hukum, maestro, maupun penutur asli, dan **belum ada data nyata** yang dikumpulkan dengan protokol ini. Bagian yang bergantung pada hukum ditandai *perlu verifikasi*. Dokumen ini bukan nasihat hukum dan bukan lembar izin; ia menjelaskan apa yang harus terjadi sebelum, selama, dan sesudah sebuah klip masuk, dan bagian mana yang sudah ditegakkan perangkat lunak serta mana yang hanya prosedur manusia.

## 1. Prinsip

1. **Izin dahulu, unggah kemudian.** Tidak ada rekaman pertunjukan yang diambil dari platform atau televisi; klip hanya masuk dari maestro/sanggar yang punya izin tertulis semua orang yang tampil.
2. **Dua izin, dua keputusan.** Izin tampil di unit latihan ≠ izin klip dipakai riset/pelatihan model. Yang kedua terpisah, bisa dicabut, dan tidak pernah diasumsikan.
3. **Manusia mengesahkan.** Mesin (analisis, usulan teks) hanya menghasilkan draf. Hanya maestro yang mengesahkan pengetahuan yang tampil kepada pelajar.
4. **Minimum yang perlu.** Klip pelajar tidak masuk ekspor riset dan terhapus otomatis (30 hari).
5. **Jujur soal batas.** Korpus kosong dinyatakan kosong; transkrip yang belum diperiksa penutur kedua dinyatakan begitu pada kartu data.

## 2. Peran

| Peran | Siapa | Tugas |
|---|---|---|
| Maestro (pemilik unit) | praktisi Ludruk yang akunnya berperan *maestro* | Unggah klip, menetapkan batas segmen, transkrip Suroboyoan–Indonesia, momen, rubrik; **mengesahkan** |
| Pemberi izin | **semua** orang yang tampil di klip (bisa berbeda dari maestro; bagi anak di bawah 18: wali) | Menandatangani izin tertulis di luar sistem |
| Pencatat kedua | penutur asli Suroboyoan yang bukan pencatat pertama | Memeriksa sampel transkrip; kesepakatan diukur (bagian 6) |
| Admin se-LARAS | tim | Memberi peran maestro, menjalankan ekspor, memegang kartu data; **tidak** mengubah isi pengetahuan |
| Penerima ekspor | peneliti/mitra yang disetujui | Hanya menerima paket berizin riset dan terikat penarikan bila izin dicabut |

## 3. Izin: apa yang ditegakkan sistem, apa yang tidak

| Hal | Ditegakkan sistem? | Catatan |
|---|---|---|
| Kotak "izin tertulis dari semua orang yang tampil sudah diperoleh" wajib dicentang saat unggah unit | **Ya** (ditolak bila tidak) | Hanya pernyataan maestro; sistem **tidak memeriksa** dokumen izinnya |
| Nama pemberi izin, tanggal izin (tidak boleh di masa depan), lingkup izin dicatat | **Ya** | Dicatat di basis data dan di buku jejak. Tampilan buku jejak **publik** menyamarkan nama dan lingkup (hash klip tetap tampil); admin melihat lengkap. Penyamaran hanya pada tampilan, entri aslinya tetap berisi nama (lihat bagian 7) |
| `data_use` = `tidak` (bawaan) atau `riset`, bisa diubah pemilik, perubahan dicatat | **Ya** | Klip berstatus `riset` baru bisa diekspor bila juga **sah**, bukan contoh, berkas ada, dan hash cocok |
| Pencabutan: unit ditarik (`withdrawn`) atau `data_use` dikembalikan ke `tidak` | **Ya** | Penarikan menghapus **berkas klip dan salinan putarnya** dari server, juga hasil analisis dan indeks pencarian; unit tidak lagi tampil (410) dan tidak diekspor. **Tidak ikut terhapus:** teks segmen dan momen yang ditulis maestro (tetap di basis data sampai akun dihapus) dan entri buku jejak. Mengembalikan `data_use` ke `tidak` hanya mengeluarkan klip dari ekspor berikutnya. Salinan yang sudah keluar harus ditarik penerimanya (**prosedur**, tidak ditegakkan sistem) |
| Klip pelajar: persetujuan per klip, hanya terlihat pemiliknya kecuali ia membagikannya ke maestro unit itu, bisa dihapus kapan saja, terhapus otomatis setelah 30 hari, **tidak pernah** diekspor (gerbang ekspor hanya membaca tabel unit) | **Ya** | Diuji di `test/app.test.js`: "latihan pelajar: persetujuan wajib…", "pembersihan otomatis…", "hapus akun menghapus latihan dan berkasnya" |
| Pelajar atau pemain **di bawah 18 tahun** | **Tidak** | Aturan prosedur: izin wali tertulis; klip anak **tidak** diberi `riset`. Sistem tidak tahu usia |
| Setiap orang yang tampil memang sudah memberi izin; tidak ada orang lain di latar | **Tidak** | Prosedur; lihat daftar periksa bagian 9 |
| Surat izin asli disimpan | **Tidak** (di luar sistem) | Simpan salinan terpisah dan terkunci; sistem hanya mencatat tanggal dan lingkup |

### Isi minimum lembar izin (bahan untuk penasihat hukum; bukan teks hukum)

1. Siapa yang merekam dan siapa yang menyimpan (nama pengelola data se-LARAS).
2. **Apa** yang direkam: wajah, tubuh/gerak, suara.
3. **Untuk apa**: (a) dipakai pelajar berlatih di se-LARAS dan dianalisis mesin untuk perbandingan deskriptif; (b) **terpisah, opsional**: dipakai riset/pelatihan model ucapan.
4. **Siapa yang dapat melihat**: hanya pengguna masuk atau publik (`access`).
5. **Berapa lama**, dan hak **menarik** izin kapan saja (dan apa artinya: tidak ditampilkan dan tidak diekspor lagi; salinan yang sudah keluar ditarik penerima).
6. Bahwa mesin hanya menghasilkan ukuran deskriptif, **tidak menilai** penampilan.
7. Hubungan dengan komunitas/sanggar asal dan ekspresi budaya tradisional (bagian 8).
8. Kontak untuk menarik izin dan bertanya.
9. Untuk anak: tanda tangan wali.

## 4. Perekaman

- **Format** yang diterima aplikasi: video mp4/webm/mov atau audio mp3/m4a/wav/ogg/webm; satu berkas, ≤ 60 MB, ≤ 150 detik (pemeriksaan ffprobe saat unggah). Klip yang lebih panjang harus dipotong.
- **Satu unit = satu keterampilan** yang bisa dilatih (mis. satu frasa gerak atau satu kidungan), bukan satu pertunjukan penuh.
- **Satu penampil utama di depan kamera**, bagian tubuh terlihat dari kepala sampai pinggul atau lebih, kamera diam (tripod), cahaya cukup dari depan. Bila ≥ 2 orang terlihat (median per bingkai), maestro **harus memilih penampil utama** sebelum unit yang rubriknya memuat ukuran gerak boleh disahkan (gerbang `readiness`, diuji di `test/v2.test.js`: "pilih penampil…"). Analisis gerak pada kerumunan panggung **belum terbukti andal**: pada video uji publik 60 detik (median 6 orang per bingkai) titik kunci tubuh hanya terdeteksi pada 55,8% bingkai yang dicoba untuk orang yang dipilih otomatis (kotak terbesar), dan **akurasi pose tidak diukur** (`docs/EVALUASI.md` 3.5).
- **Suara:** mikrofon dekat, tanpa iringan bila ukuran jeda/tempo ingin dipakai; SNR perkiraan < 10 dB membuat ukuran jeda/nada/rentang dinamika tidak dibandingkan (`docs/EVALUASI.md` 3.2, 3.6). Rekam satu versi bersih dan, bila perlu, satu versi dengan iringan sebagai unit terpisah.
- Catat di lembar rekaman: tanggal, tempat, siapa yang tampil, perangkat, siapa memegang izin.
- **Tidak ada** rekaman di dalam rumah/ruang pribadi orang lain tanpa izin pemiliknya; tidak ada penonton yang dapat dikenali di latar tanpa izin.

## 5. Anotasi (oleh maestro dan pencatat)

1. **Batas segmen.** Maestro menetapkan awal **dan akhir** tiap segmen. Segmen tanpa batas akhir tidak ikut paket ASR (kecuali dengan `--derive-end`, kasar dan ditandai `turunan`).
2. **Transkrip Suroboyoan** (`text_sby`): ditulis **sama persis dengan yang diucapkan**, tanpa "dibenarkan". **Tetapkan satu pedoman ejaan tertulis dan konsisten sebelum menulis**; pedoman itu belum dipilih tim (*perlu keputusan dengan penutur asli*). Catat alih kode Jawa–Indonesia apa adanya.
3. **Terjemahan Indonesia** (`text_id`) wajib terisi agar segmen bisa disahkan. Bila ragu tandai awalan `[ragu] `; segmen berawalan `[ragu]` **tidak dapat disahkan** sampai diperbaiki.
4. **Usulan mesin** berstatus draf (`draft_ai`) dan harus diperiksa maestro sebelum disahkan. (a) Bila `ANTHROPIC_API_KEY` diisi, hanya **teks** transkrip yang dikirim ke `api.anthropic.com`, tidak pernah audio atau video. (b) Pengenal ujaran milik operator (`ASR_COMMAND_JSON`) menerima **jalur berkas klip unit** (video atau audio apa adanya, bukan hanya suara) sebagai argumen terakhir perintahnya; bila skrip operator mengirimnya ke layanan awan, itu tanggung jawab operator dan harus tercantum di lembar izin. se-LARAS **tidak membawa model ASR** dan tidak melatihnya.
5. **Momen "kenapa"** (penjelasan mengapa gerak/ucapan dilakukan demikian) ditulis maestro; ini pengetahuan yang menjadi inti nilai se-LARAS dan tidak diisi mesin.
6. **Pengesahan** unit hanya bisa bila syarat minimum terpenuhi (`readiness`, `src/app.js`): (a) analisis klip selesai; (b) maestro memilih **minimal satu ukuran** untuk rubrik dan setiap ukuran yang dipilih tersedia dan andal pada klip acuan; (c) bila rubrik memuat ukuran gerak dan median ≥ 2 orang terlihat, penampil utama sudah dipilih; (d) **minimal satu segmen transkrip sudah disahkan**. Segmen lain yang masih draf tidak menghalangi, tetapi **tidak tampil** ke pelajar. **Momen tidak disyaratkan:** momen yang masih draf (termasuk usulan otomatis dari analisis) tersembunyi dari pelajar sampai maestro menulis penjelasannya dan mengesahkannya. Mengubah segmen, momen, atau rubrik yang sudah tampil membuka kembali unit ke status draf.

## 6. Penjaminan mutu transkrip (sebelum dipakai melatih)

Aplikasi **tidak** memeriksa transkrip oleh penutur kedua dan **tidak** mengukur kesepakatan antar-pencatat. Prosedur yang disarankan, dengan ambang yang **ditetapkan tim sebelum melihat hasil** (belum ditetapkan):

1. Pencatat kedua menyalin ulang secara independen **sampel** segmen (mis. 10–20% per unit, dipilih acak).
2. Hitung CER dan WER antar pencatat dengan `python3 analyzer/asr_eval.py` (rujukan = pencatat pertama, hipotesis = pencatat kedua).
3. Tetapkan ambang penerimaan (tim yang memutuskan; tidak ada angka baku yang saya rujuk) dan catat ambang serta hasilnya di kartu data.
4. Segmen di luar ambang diperbaiki bersama sebelum masuk korpus.

## 7. Penyimpanan, keamanan, penarikan

- Data disimpan di server milik tim (SQLite + berkas), **tanpa layanan luar** kecuali yang disebut di bagian 5.4.
- `SESSION_SECRET` ≥ 16 karakter dan **tetap**: dipakai untuk sesi dan untuk tanda buku jejak. Menggantinya membuat tanda lama tak terverifikasi.
- Buku jejak berantai-hash mencatat unggah, pengesahan, perubahan izin. **Bukti kerusakan, bukan tanda tangan digital**: pemegang rahasia dapat menulis ulang rantai; tidak ada jangkar eksternal.
- Cadangan: tim memutuskan lokasi dan jadwal (**belum ada**); cadangan juga memuat data pribadi dan tunduk pada izin yang sama.
- Retensi: klip pelajar 30 hari (`ATTEMPT_TTL_DAYS`); klip maestro sampai ditarik atau akun dihapus. Hapus akun menghapus berkas asli, salinan putar, dan unit (diuji).
- Pencabutan izin diproses dalam waktu yang dijanjikan di lembar izin (tim menetapkan; **belum**).
- **Batas yang diketahui: buku jejak tidak bisa dihapus per entri.** Entri pembuatan unit memuat hash klip dan **nama pemberi izin**; entri ini tetap ada setelah unit ditarik atau akun dihapus (menghapus entri memutus rantai, diuji). Tampilan publik menyamarkan nama, tetapi datanya tetap tersimpan dan terlihat admin. Apakah ini sesuai hak penghapusan data pribadi menurut UU PDP **perlu ditanyakan ke penasihat hukum**; pilihan teknis bila perlu (mis. menyimpan hash nama, bukan nama) belum dikerjakan.
- Akses admin hanya untuk orang yang disebut tim; tidak ada akun bersama.

## 8. Hak budaya dan data pribadi (*perlu verifikasi hukum*)

Yang sudah saya baca dari sumber (bukan nasihat hukum, dan dari sumber sekunder bila tertulis):

- **PP No. 56/2022 tentang Kekayaan Intelektual Komunal** (ditetapkan 20 Desember 2022) menyatakan KIK terdiri atas ekspresi budaya tradisional, pengetahuan tradisional, sumber daya genetik, indikasi asal, dan potensi indikasi geografis; ia juga mengatur inventarisasi ([peraturan.bpk.go.id](https://peraturan.bpk.go.id/Details/233504)). Sebuah artikel jurnal mengutip UU Hak Cipta (UU 28/2014) Pasal 38 bahwa hak cipta atas ekspresi budaya tradisional dipegang negara dan penggunaannya harus memperhatikan nilai-nilai masyarakat pengembannya ([Palas Rev, unpatti](https://ojs3.unpatti.ac.id/index.php/palasrev/article/download/13767/8190)); **kutipan ini perlu dicek pada naskah undang-undang**.
- **UU No. 27/2022 tentang Pelindungan Data Pribadi** disahkan 17 Oktober 2022. Menurut sumber sekunder, data biometrik adalah data pribadi spesifik (Pasal 4 ayat (2) huruf b) yang pemrosesannya memerlukan persetujuan yang sah secara eksplisit (Pasal 20 ayat (2)), dan citra wajah termasuk biometrik ([Yustisi, 2026](https://ejournal.uika-bogor.ac.id/index.php/YUSTISI/article/download/24313/8693/116069); [SIP Law Firm](https://siplawfirm.id/resources/perlindungan-data-biometrik)). Naskah resmi tersedia di [JDIH Kemenkeu](https://jdih.kemenkeu.go.id/download/46c17b53-4a45-411c-9b76-c6799e5769fc/UU_Nomor_27_Tahun_2022%20Perlindungan%20Data%20Pribadi.pdf).

**Pertanyaan yang belum terjawab dan harus ditanyakan ke penasihat hukum sebelum data nyata masuk:** (1) apakah titik kunci pose, rekaman suara, dan video tubuh yang diproses di sini tergolong data biometrik/data pribadi spesifik menurut UU PDP, dan apakah bentuk persetujuan dalam bagian 3 memadai; (2) siapa pemegang hak atas dokumentasi pertunjukan (pemain, sanggar, pihak yang merekam, negara bila ekspresi budaya tradisional) dan apakah izin satu orang cukup untuk klip yang memuat beberapa orang; (3) apakah dokumentasi ini perlu dicatat ke pangkalan data KIK atau berkoordinasi dengan pemerintah daerah; (4) kewajiban pengendali data (pemberitahuan, penunjukan pejabat, pelaporan insiden) bagi tim; (5) pemakaian ekspor untuk melatih model dan lisensi model yang dihasilkan.

## 9. Daftar periksa sebelum klip pertama masuk

- [ ] Ada satu maestro nyata yang bersedia dan paham bahwa ia mengesahkan isi (belum ada pada 14 Nov 2026).
- [ ] Lembar izin ditinjau penasihat hukum dan maestro; semua orang di klip menandatangani; salinan disimpan terpisah.
- [ ] Untuk anak: izin wali; klip tidak diberi `riset`.
- [ ] Tidak ada orang lain yang dapat dikenali di latar tanpa izin.
- [ ] Pedoman ejaan Suroboyoan ditetapkan bersama penutur asli.
- [ ] Pencatat kedua tersedia; ambang kesepakatan ditetapkan sebelum melihat hasil.
- [ ] `SESSION_SECRET` tetap, `SECURE_COOKIES=1` di belakang HTTPS, cadangan terjadwal, daftar admin tertulis.
- [ ] Prosedur pencabutan izin dan batas waktunya tertulis; penerima ekspor menandatangani kewajiban penarikan.
- [ ] `data_use = riset` hanya untuk klip yang pemberi izinnya **secara terpisah** menyetujui riset.
- [ ] Klip contoh sintetis dan akun contoh **dihapus** dari instalasi produksi (`LARAS_DEMO` tidak dipakai).

## 10. Ekspor korpus riset

```bash
SESSION_SECRET=… DATA_DIR=… node scripts/export-dataset.js --out ekspor --media
python3 analyzer/manifest_to_asr.py ekspor/manifest.jsonl asr/ --speaker-map penutur.json
python3 analyzer/make_splits.py asr/asr_manifest.jsonl splits/        # menolak bila < 5 penutur
```

- Gerbang ekspor: sah + `data_use = riset` + bukan contoh + berkas ada + sha256 cocok. Paket memuat `manifest.jsonl`, `datacard.md`, `SHA256SUMS`, dan (dengan `--media`) berkas klip. Tidak memuat nama pemberi izin.
- **Penutur** pada manifest = akun pengunggah. Buat `penutur.json` dari lembar izin (siapa yang benar-benar tampil di tiap klip) sebelum membagi data; lihat `docs/DATASET_DAN_PELATIHAN.md`.
- Paket dibagikan hanya kepada penerima yang disetujui, dengan catatan bahwa pencabutan izin berarti mereka menarik salinannya.
- Jangan menyebut korpus ini "dataset Ludruk" sebelum ada data nyata, penutur ≥ 5, dan kartu data yang menyatakan apa adanya.
