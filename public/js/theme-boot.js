// Dimuat sebelum render agar tema tersimpan langsung terpasang (tidak ada kilatan terang-gelap).
(function () {
  try {
    var t = localStorage.getItem('laras_tema');
    if (!t) t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'gelap' : 'terang';
    document.documentElement.setAttribute('data-theme', t);
    var l = localStorage.getItem('laras_bahasa');
    document.documentElement.lang = l === 'id' ? 'id' : 'jv';
  } catch (e) { /* penyimpanan tidak tersedia */ }
})();
