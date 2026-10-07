// The app shows no emoji (icons only). Server-sent notification text used to
// carry them; strip them defensively wherever such text is displayed.

final _emoji = RegExp(
  '[\u{1F000}-\u{1FAFF}' // pictographs, emoticons, transport, symbols & pictographs ext.
  '\u{2600}-\u{27BF}' // misc symbols, dingbats
  '\u{2B00}-\u{2BFF}' // arrows & stars (U+2B50 star, ...)
  '\u{2300}-\u{23FF}' // watch, stopwatch, alarm clock, ...
  '\u{FE00}-\u{FE0F}' // variation selectors
  '\u{200D}\u{20E3}' // zero-width joiner, keycap
  '\u{E0020}-\u{E007F}' // tag sequences (subdivision flags)
  ']',
  unicode: true,
);

/// [s] without emoji; spaces left behind are collapsed and the ends trimmed.
String stripEmoji(String s) {
  if (s.isEmpty) return s;
  final out = s.replaceAll(_emoji, '');
  if (out.length == s.length) return s;
  return out.replaceAll(RegExp(r'[ \t]{2,}'), ' ').replaceAllMapped(RegExp(r' +([.,!?:;])'), (m) => m[1]!).trim();
}
