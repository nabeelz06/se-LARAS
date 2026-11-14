# Panduan desain "Panggung se-LARAS"

Panduan ini merangkum keputusan desain yang **ada di kode** (`public/css/tokens.css`, `public/js/art/`, `public/js/comp/`), supaya orang lain bisa memperluasnya tanpa merusak maknanya. Yang diukur dan yang belum diukur dipisahkan di bagian 8.

## 1. Gagasan

Antarmuka meminjam panggung dan kain Ludruk: **merah tirai, hitam panggung, emas prada, biru wedel, dan kertas lontar**. Tiga hal yang harus tetap benar pada perubahan apa pun:

1. **Maestro di tengah.** Isi yang tampil ke pelajar hanya yang disahkan maestro; yang masih draf atau usulan mesin diberi label dan disembunyikan dari pelajar.
2. **Deskripsi, bukan nilai.** Perbandingan latihan dengan acuan tidak punya skor, peringkat, atau warna baik/buruk (bagian 4).
3. **Terus terang soal batas.** Teks Suroboyoan adalah draf; klip contoh diberi label "contoh uji"; kegagalan analisis dinyatakan, bukan diganti angka.

## 2. Token (`tokens.css`)

**Warna tetap (panggung):** `--stage-0 #120a09`, `--stage-1 #2a0e12`, `--stage-2 #5b1019`, `--stage-3 #8c1c26`; teks di atas panggung `--on-stage #fbf1de`; emas `--gold #d9a32f` (`-hi #f1c866`, `-lo #9a6d14`); kain: teal `#1b6b66`, indigo `#243f6e`, oker `#a15e12`.

**Tema.** `terang` (bawaan; kertas lontar `--bg #f6efdf`, teks `--text #211914`, utama `--primary #8c1c26`) dan `gelap` (`--bg #130e0c`, `--text #f6ecd9`, utama `#b32636`). Tema awal mengikuti pengaturan sistem (`prefers-color-scheme`); pilihan dari tombol di bilah atas disimpan di penyimpanan lokal peramban (`laras_tema`). Kode di `theme-boot.js`, dimuat sebelum render agar tidak ada kilatan terang-gelap.

**Huruf** (dihosting sendiri, SIL OFL 1.1): *Fraunces* untuk judul (`--font-display`), *Plus Jakarta Sans* untuk antarmuka (`--font-ui`), *Noto Sans Javanese* untuk aksara Jawa (`--font-jawa`). Skala `--fs-xs` 0,78 rem sampai `--fs-hero` (fluid, `clamp`).

**Bentuk dan tata letak:** radius `--r-sm 8px`, `--r 14px`, `--r-lg 22px`, `--r-xl 32px`; lebar isi maksimum `--maxw 1200px`; tinggi bilah atas 64 px, bilah tab ponsel 68 px; kurva gerak `--ease cubic-bezier(.2,.7,.2,1)`. Titik putus utama pada 560, 640, 760, 860, 960, 1000 px.

**Aturan:** komponen baru memakai variabel, **bukan** nilai heksa langsung, supaya tema gelap ikut. Warna status memakai pasangan `--near/--near-bg`, `--high/--high-bg`, `--low/--low-bg`, `--na/--na-bg`, `--danger/--danger-bg`, `--info/--info-bg`.

## 3. Navigasi dan bahasa

- **Desktop:** bilah atas dengan merek, tautan utama, pemilih bahasa, tombol tema, akun. Bila tautan tak muat, algoritma `fit()` (`main.js`) bertahap: menyembunyikan aksara di samping merek, lalu memindahkan tautan berprioritas terendah ke menu "Liyane".
- **Ponsel:** bilah tab bawah (Ngarep, Latihan, Goleki, Kamus, dan Kemajuan/Maestro/Mlebu menurut peran).
- **Aturan tata letak ponsel** (semuanya ada di CSS dan diperiksa dengan tangkapan layar, bukan tes otomatis, kecuali butir pertama):
  - `.wrap` selalu punya jarak kiri-kanan; kelas `.pad` hanya mengatur atas-bawah (`padding-block`). Dulu `.pad` menimpa jarak itu sehingga isi menempel ke tepi layar ponsel; sekarang dijaga `EDGE_CHECK` di `e2e/flow_pages.py`.
  - Beranda (≤ 860 px): judul, teks, dan tombol dulu; ilustrasi penari menyusul di bawahnya. Teks pengantar diperkecil di ≤ 600 px agar tombol utama mulai terlihat di layar pertama.
  - Halaman unit (≤ 1000 px): pemutar dulu, transkrip/momen/ukuran tepat di bawahnya, lalu jalur belajar, catatan, maestro, izin.
  - Jejak halaman (≤ 600 px): hanya induk langsung sebagai tautan kembali (judul unit yang panjang membuatnya 3-4 baris).
  - Tombol pemutar dirapatkan pada wadah sempit supaya satu baris.
- **Tautan lompat** "Langsung ke isi" di awal halaman; fokus terlihat 3 px (`:focus-visible`).
- **Tiga mode bahasa** (`core/i18n.js`): `sby` (Suroboyoan), `dua` (Suroboyoan dengan padanan Indonesia di bawahnya), `id`. Pembantu: `L(sby, id)` untuk teks pendek, `LB` untuk blok, `PB`/`pick` untuk data dari server (`*_sby`/`*_id`). Atribut `lang` (`jv`/`id`) dipasang pada setiap teks.
- **Teks persetujuan (`LC`) selalu memuat versi Indonesia**, karena teks Suroboyoan masih draf dan persetujuan harus jelas.
- Semua teks Suroboyoan antarmuka **belum disahkan penutur asli** (`docs/DAFTAR_VERIFIKASI.md`); jangan menyebutnya "baku".

## 4. Komponen khas

| Komponen | Berkas | Makna dan aturan |
|---|---|---|
| **Laras** (penunjuk selisih) | `comp/tuner.js` | Titik emas = acuan maestro; pita = toleransi yang ditetapkan maestro; lingkaran = latihan pemain. **Tidak ada warna baik/buruk**: dekat acuan teal, lebih tinggi oker, lebih rendah indigo, tidak dibandingkan abu-abu. Tidak ada skor gabungan |
| **Untai irama** | `comp/rhythm.js` | Batang = bagian bicara, celah = jeda; dua baris (maestro, latihan). Garis penyejajaran DTW antar-baris **hanya digambar bila penyejajaran andal**; bila tidak, hanya dua baris |
| **Pemutar** | `comp/player.js` | Takarir dua bahasa dari segmen yang disahkan, penanda momen (hanya yang disahkan), kecepatan, ulang bagian, kerangka gerak, papan tombol, layar penuh |
| **Kerangka gerak** | `comp/skeleton.js` | Titik kunci 0..1 digambar di atas video; emas = maestro, teal = pelajar. Menghitung kotak isi video agar tepat pada pita hitam |
| **Perekam** | `comp/recorder.js` | Pratinjau kamera, meter suara, hitung mundur "telu-loro-siji", batas durasi, putar ulang; rekaman tetap di perangkat sampai pemain menyetujui dan menekan kirim |
| **Pemilih penampil** | `comp/personpick.js` | Muncul bila lebih dari satu orang terdeteksi; maestro (untuk klip acuan) atau pemilik latihan memilih orang yang diukur. Memilih memicu analisis ulang |
| **Sampul unit** | `art/cover.js` | Warna dan motif ditentukan id unit; lajur bawah menggambar irama ucap klip itu sendiri |
| **Jalur belajar** | `pages/progress.js` | Nyebeng (mengamati) → Tedean (mencoba) → Ngelmu (memahami). Hanya tanggal dan hitungan yang disimpan; tidak ada skor atau peringkat. "Ngelmu" baru bisa ditandai setelah mencoba |

**Bahasa pesan perbandingan:** kalimatnya mendeskripsikan selisih terhadap acuan dan selalu memuat peringatan bahwa ini **bukan nilai**. Hindari kata "bagus", "salah", "benar", "gagal" untuk penampilan seseorang.

## 5. Ilustrasi dan motif (digambar sendiri)

Semua ilustrasi dibuat untuk se-LARAS sebagai SVG dengan kode; warnanya variabel CSS sehingga mengikuti tema.

- `art/curtain.js`: tirai merah berlipit dengan kelambu bersulam emas dan sorot lampu (dekoratif, `aria-hidden`).
- `art/dancer.js`: penari kerangka 14 titik sendi (emas = maestro, teal = bayangan latihan). **Ilustrasi, bukan hasil pengukuran.**
- `art/gamelan.js`: siluet gong, kenong, saron, kendang.
- `art/motif.js`: motif kain tradisional (kawung, ceplok, parang, truntum) **digambar ulang** sebagai pola geometris sederhana; bukan salinan karya atau corak tertentu.
- `art/ornament.js`: tanda merek, pembatas gongseng, bentuk kendang, aksara Jawa.
- **Aksara Jawa:** `ꦱꦼꦭꦫꦱ꧀` (selaras), `ꦭꦫꦱ꧀` (laras), `ꦭꦸꦢꦿꦸꦏ꧀` (ludruk) ditulis tim. **Ejaannya belum diperiksa ahli aksara** (`docs/DAFTAR_VERIFIKASI.md`); hiasan aksara bersifat dekoratif dan teks yang sama selalu ada dalam huruf Latin.
- **Foto:** tidak ada foto dari internet yang dibundel. Foto penampil nyata hanya boleh dipasang dengan izin tertulis dan hak cipta fotografer yang jelas, dengan kredit di halaman Tentang. Foto orang yang dikenal publik tidak dipakai.
- Merek: "se-" kecil miring berwarna emas lalu **LARAS**; teks tetap terbaca "se-LARAS" bagi pembaca layar. LARAS = *Living Arts Repository, Analysis, and Skills-transfer*.

## 6. Gerak

Gerak dipakai untuk membantu (tirai membuka, sorot) dan **dimatikan** pada `prefers-reduced-motion: reduce` (animasi dan transisi dipaksa hampir nol, elemen `.reveal` langsung tampil). Cetak (`@media print`) menyembunyikan bilah atas, bilah tab, dan kaki halaman, dengan latar putih.

## 7. Aturan menulis dan memperluas

1. Tambah halaman: modul di `public/js/pages/`, rute di `core/router.js`, teks lewat `L/LB`, judul `h1` lewat `pageHead`.
2. DOM dibangun dengan `h()`/`s()` (`core/dom.js`); **tidak ada `innerHTML`, `eval`, atribut `style` atau `on*` inline** (`npm run check:ui` menggagalkannya; CSP ketat).
3. Gambar dekoratif `aria-hidden`; gambar bermakna diberi teks alternatif; tombol ikon punya nama aksesibel.
4. Jangan menambah skor, peringkat, lencana, atau garis hijau/merah pada hasil latihan.
5. Jangan menampilkan isi draf (usulan AI, draf maestro) kepada pelajar.
6. Warna lewat token; uji terang dan gelap, desktop dan ponsel (`npm run e2e`, alur `halaman`).
7. Lihat hasilnya: `python3 e2e/capture_media.py --shots` menulis tangkapan layar ke `docs/img/` (data contoh sintetis). Beberapa masalah tata letak hanya terlihat dengan mata (urutan konten, ilustrasi yang memakan layar pertama), bukan oleh axe-core.

## 8. Apa yang sudah dan belum diukur

| Pemeriksaan | Hasil | Batas |
|---|---|---|
| axe-core 4.14.0 (tag `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `best-practice`) pada 18 rute × 4 tampilan (desktop 1360 px, ponsel 390 px; terang, gelap) | **Nol pelanggaran** pada 72 pemeriksaan, 14 Nov 2026 | Alat otomatis hanya menangkap sebagian masalah; teks di atas gambar atau gradien sering tidak dapat dinilai kontrasnya oleh alat ini (hasil "tidak lengkap" tidak dihitung sebagai pelanggaran) |
| Luber horizontal, galat konsol, dan jarak kiri-kanan ponsel (`.wrap` ≥ 12 px, teks polos ≥ 8 px dari tepi) | Nol pada 72 pemeriksaan | Hanya Chromium. Pemeriksaan jarak dibuktikan bisa gagal dengan menyuntikkan aturan CSS lama (`docs/PENGUJIAN.md` bagian 4) |
| Kerapian visual dan urutan konten | Diperiksa **oleh pengembang yang sama** lewat tangkapan layar (`docs/img/`, 14 Nov 2026) | Bukan peninjauan independen; tidak ada tes otomatis untuk urutan konten |
| Navigasi papan tombol, pembaca layar (NVDA, VoiceOver, TalkBack), pengguna dengan disabilitas | **Belum diuji** | Fokus terlihat dan tautan lompat ada, tetapi urutan fokus yang bermakna dan pengumuman status belum dinilai manusia |
| Uji kegunaan dengan maestro, pemain muda, atau guru | **Belum** | Semua keputusan desain adalah dugaan tim |
| Rendering aksara Jawa di berbagai perangkat | **Belum** | Bergantung pada *Noto Sans Javanese* yang dihosting; perangkat tanpa dukungan bisa menampilkan kotak kosong |
| Kinerja pada ponsel murah dan jaringan lambat | **Belum** | Berkas huruf total ±230 KB; tidak ada pengukuran waktu muat |
