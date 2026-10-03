(function () {
  var t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  document.documentElement.dataset.theme = t
  document.documentElement.style.colorScheme = t
  var m = document.querySelector('meta[name="theme-color"]')
  if (m) m.setAttribute('content', t === 'dark' ? '#0b0e12' : '#f6f4f0')
  // Restore the base-sport skin (see SportThemeProvider) before first paint.
  try {
    var s = localStorage.getItem('ftg.sport')
    if (s && /^[a-z-]{2,32}$/.test(s)) document.documentElement.dataset.sport = s
  } catch (e) {}
})()
