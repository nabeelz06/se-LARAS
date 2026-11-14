// Peringatan analisis -> kalimat yang bisa dipahami. Kode berasal dari analyzer; kode tak dikenal ditampilkan apa adanya.
import { L } from './i18n.js';
const W = {
  derau_tinggi: ['Rekamane rodok rame/berisik; ukuran swara sing gampang keganggu ora dibandingno.', 'Rekaman agak berisik; ukuran suara yang mudah terganggu tidak dibandingkan.'],
  tanpa_audio: ['Klip iki ora enek swarane.', 'Klip ini tidak ada suaranya.'],
  audio_senyap: ['Swarane senyap kabeh.', 'Suaranya senyap seluruhnya.'],
  audio_terlalu_pendek: ['Swarane kependekan kanggo dianalisis.', 'Suaranya terlalu pendek untuk dianalisis.'],
  tidak_ada_ujaran_terdeteksi: ['Ora enek ujaran sing kedeteksi.', 'Tidak ada ujaran yang terdeteksi.'],
  vad_cadangan_energi: ['Deteksi ujaran nganggo cara cadangan (energi swara), kurang tepat.', 'Deteksi ujaran memakai cara cadangan (energi suara), kurang tepat.'],
  nada_tak_cukup: ['Nada kurang cukup kanggo ngukur rentang nada.', 'Nada kurang cukup untuk mengukur rentang nada.'],
  klip_pendek: ['Klip cendhak; angka isok kurang mantep.', 'Klip pendek; angka bisa kurang mantap.'],
  ujaran_sedikit: ['Ujarane sithik; angka isok kurang mantep.', 'Ujarannya sedikit; angka bisa kurang mantap.'],
  tanpa_video: ['Klip iki mung swara, ora enek gambare.', 'Klip ini hanya suara, tanpa gambar.'],
  pose_sulit_dideteksi: ['Badan angel kedeteksi nang video (kurang padhang/kajauhan/katutup).', 'Tubuh sulit terdeteksi di video (kurang terang/terlalu jauh/tertutup).'],
  pose_tak_cukup: ['Bingkai sing kedeteksi kurang kanggo ngukur obahan.', 'Bingkai yang terdeteksi kurang untuk mengukur gerak.'],
  banyak_orang_terdeteksi: ['Akeh wong kedeteksi; pilih sing dimaksud.', 'Banyak orang terdeteksi; pilih yang dimaksud.'],
  orang_tak_terdeteksi_pakai_cadangan: ['Wong ora kedeteksi; dipakai cara cadangan.', 'Orang tidak terdeteksi; dipakai cara cadangan.'],
  jejak_pilihan_tak_ada: ['Wong sing dipilih ora ketemu nang klip iki.', 'Orang yang dipilih tidak ditemukan di klip ini.'],
  acuan_tanpa_suara_untuk_sejajar: ['Acuan maestro ora enek ujarane, irama ora disejajarno.', 'Acuan maestro tanpa ujaran, irama tidak disejajarkan.'],
  klip_terlalu_pendek_untuk_sejajar: ['Klip kependekan kanggo nyejajarno irama.', 'Klip terlalu pendek untuk menyejajarkan irama.'],
  tanpa_ujaran_untuk_sejajar: ['Ora enek ujaran kanggo nyejajarno irama.', 'Tidak ada ujaran untuk menyejajarkan irama.'],
  penyejajaran_tak_andal: ['Penyejajaran irama ora andal (isine beda), tempo ora dibandingno.', 'Penyejajaran irama tidak andal (isinya berbeda), tempo tidak dibandingkan.'],
  penyejajaran_gagal: ['Penyejajaran irama gagal.', 'Penyejajaran irama gagal.'],
  tidak_ada_ukuran_andal: ['Ora enek ukuran sing andal nang klip iki.', 'Tidak ada ukuran yang andal pada klip ini.'],
  video_tak_terbuka: ['Video ora isok dibukak.', 'Video tidak dapat dibuka.'],
};
export const warnText = (code) => (W[code] ? L(W[code][0], W[code][1]) : code);
