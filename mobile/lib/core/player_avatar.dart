// The web avatar studio's player config (users.player_avatar) and how it maps
// onto DiceBear's Avataaars parts — a port of web/src/avatar/render/avataaars.ts,
// kit.ts and palette.ts. The app renders it as a PNG from the DiceBear HTTP API
// (the web bundles the same library and draws the SVG locally).

import 'avatar_presets.dart';
import 'dicebear_avatar.dart';
import 'models.dart';

/// Face override for stickers (eyes / brows / mouth in Avataaars' own names).
class AvatarExpression {
  final String? eyes, eyebrows, mouth;
  const AvatarExpression({this.eyes, this.eyebrows, this.mouth});
}

/// The fields of the web's PlayerAvatarConfig that the portrait uses.
class PlayerAvatar {
  final String sport, skinTone, eyes, eyebrows, mouth, hair, hairColor, facialHair, top;
  final String? headwear, eyewear, kitMain, kitTrim;
  final int? number;

  const PlayerAvatar({
    this.sport = 'basketball',
    this.skinTone = 'skin_04',
    this.eyes = 'eyes_01',
    this.eyebrows = 'brow_curved',
    this.mouth = 'mouth_big_smile',
    this.hair = 'hair_short_flat',
    this.hairColor = 'black',
    this.facialHair = 'none',
    this.top = 'top_tee',
    this.headwear,
    this.eyewear,
    this.kitMain,
    this.kitTrim,
    this.number,
  });

  /// Same rule as the web's parsePlayerAvatar: version 1 with a body type and skin tone.
  static PlayerAvatar? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    if (raw['version'] != 1) return null;
    if (raw['bodyType'] is! String || raw['skinTone'] is! String) return null;
    String s(String k, String fallback) => raw[k] is String ? raw[k] as String : fallback;
    String? o(String k) => raw[k] is String && (raw[k] as String).isNotEmpty ? raw[k] as String : null;
    return PlayerAvatar(
      sport: s('sport', 'basketball'),
      skinTone: raw['skinTone'] as String,
      eyes: s('eyes', 'eyes_01'),
      eyebrows: s('eyebrows', 'brow_curved'),
      mouth: s('mouth', 'mouth_big_smile'),
      hair: s('hair', 'hair_short_flat'),
      hairColor: s('hairColor', 'black'),
      facialHair: s('facialHair', 'none'),
      top: s('top', 'top_tee'),
      headwear: o('headwear'),
      eyewear: o('eyewear'),
      kitMain: o('kitMain'),
      kitTrim: o('kitTrim'),
      number: (raw['number'] as num?)?.toInt(),
    );
  }

  /// Like the web's playerAvatarForUser: the public config, else the own config
  /// when the profile picture is the player avatar.
  /// The web's hasPlayerAvatar: a saved studio avatar, or the profile picture
  /// set to the player avatar.
  static bool hasForUserJson(Map<String, dynamic> j) =>
      fromJson(j['player_avatar']) != null || fromJson(j['player_avatar_public']) != null || j['avatar_url'] == 'avatar:player';

  static PlayerAvatar? forUserJson(Map<String, dynamic> j) =>
      fromJson(j['player_avatar_public']) ?? (j['avatar_url'] == 'avatar:player' ? fromJson(j['player_avatar']) : null);
}

/// Resolved team kit: the player's chosen colours, else their sport's.
class AvatarKit {
  final String main, trim, ink, number, accent;
  const AvatarKit(this.main, this.trim, this.ink, this.number, this.accent);
}

class _SportKit {
  final String main, trim, ink, number;
  const _SportKit(this.main, this.trim, this.ink, this.number);
}

const _kits = {
  'basketball': _SportKit('#f2552c', '#1d1f2b', '#ffffff', '23'),
  'football': _SportKit('#109c4e', '#f4f4ef', '#ffffff', '10'),
  'volleyball': _SportKit('#2563eb', '#fbbf24', '#ffffff', '7'),
  'tennis': _SportKit('#f6f5f0', '#7c3aed', '#7c3aed', ''),
  'badminton': _SportKit('#0d9488', '#f472b6', '#ffffff', ''),
  'running': _SportKit('#e11d48', '#ffffff', '#ffffff', ''),
  'gym': _SportKit('#26282e', '#a3e635', '#a3e635', ''),
};

const _kitColors = {
  'red': '#dc2626',
  'orange': '#f2552c',
  'gold': '#f5b301',
  'green': '#109c4e',
  'teal': '#0d9488',
  'sky': '#0ea5e9',
  'blue': '#2563eb',
  'navy': '#1e3a8a',
  'purple': '#7c3aed',
  'pink': '#ec4899',
  'maroon': '#7f1d1d',
  'black': '#1d1f2b',
  'white': '#f6f5f0',
  'grey': '#8d929b',
};

/// Relative luminance 0–1 of a #rrggbb colour (sRGB, approximate).
double luminance(String hex) {
  final n = int.parse(hex.substring(1), radix: 16);
  final r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

AvatarKit kitOf(PlayerAvatar c) {
  final sport = _kits[c.sport] ?? _kits['basketball']!;
  final main = _kitColors[c.kitMain] ?? sport.main;
  final trim = _kitColors[c.kitTrim] ?? sport.trim;
  final custom = c.kitMain != null || c.kitTrim != null;
  final light = luminance(main) > 0.62;
  final ink = custom ? ((luminance(trim) - luminance(main)).abs() > 0.35 ? trim : (light ? '#1d1f2b' : '#ffffff')) : sport.ink;
  final number = c.number != null ? '${c.number}' : sport.number;
  return AvatarKit(main, trim, ink, number, light ? trim : main);
}

const _hair = {
  'hair_buzz': 'theCaesar',
  'hair_short_flat': 'shortFlat',
  'hair_short_round': 'shortRound',
  'hair_side_part': 'theCaesarAndSidePart',
  'hair_waves': 'shortWaved',
  'hair_curls_short': 'shortCurly',
  'hair_quiff': 'frizzle',
  'hair_twists': 'dreads02',
  'hair_locs': 'dreads01',
  'hair_locs_long': 'dreads',
  'hair_afro': 'fro',
  'hair_puff': 'froBand',
  'hair_curly': 'curly',
  'hair_long_curly': 'curvy',
  'hair_big': 'bigHair',
  'hair_bun': 'bun',
  'hair_braid_crown': 'frida',
  'hair_bob': 'bob',
  'hair_bob_bangs': 'miaWallace',
  'hair_shaggy': 'shaggy',
  'hair_mullet': 'shaggyMullet',
  'hair_shaved_side': 'shavedSides',
  'hair_long_wavy': 'longButNotTooLong',
  'hair_long_straight': 'straight01',
  'hair_long_sleek': 'straight02',
  'hair_long_strand': 'straightAndStrand',
  'hair_balding': 'sides',
  'hair_headwrap': 'turban',
  'hair_hijab': 'hijab',
  // legacy ids
  'hair_fade_low': 'shortFlat',
  'hair_fade_mid': 'shortRound',
  'hair_fade_high': 'shortFlat',
  'hair_crop': 'theCaesarAndSidePart',
  'hair_wavy_med': 'shortWaved',
  'hair_braids': 'dreads02',
  'hair_ponytail': 'straight02',
  'hair_box_braids': 'dreads',
  'hair_cornrows': 'dreads01',
  'hair_hightop': 'shortFlat',
  'hair_mohawk': 'frizzle',
  'hair_bantu_knots': 'frida',
  'hair_pixie': 'shaggy',
};

const _headwear = {
  'head_cap': 'hat',
  'head_beanie': 'winterHat02',
  'head_bobble': 'winterHat03',
  'head_earflap': 'winterHat1',
  'head_headband': 'winterHat02',
  'head_bandana': 'winterHat04',
};

const _eyes = {
  'eyes_01': 'default',
  'eyes_02': 'squint',
  'eyes_03': 'happy',
  'eyes_04': 'side',
  'eyes_05': 'surprised',
  'eyes_wink': 'wink',
};

const _brows = {
  'brow_curved': 'defaultNatural',
  'brow_straight': 'flatNatural',
  'brow_thick': 'default',
  'brow_thin': 'raisedExcitedNatural',
  'brow_athletic': 'angryNatural',
  'brow_expressive': 'upDownNatural',
};

const _mouths = {
  'mouth_neutral': 'default',
  'mouth_smile': 'twinkle',
  'mouth_big_smile': 'smile',
  'mouth_serious': 'serious',
  'mouth_confident': 'tongue',
  'mouth_relaxed': 'twinkle',
};

const _beards = {
  'beard_stubble': 'beardLight',
  'beard_short': 'beardMedium',
  'beard_full': 'beardMajestic',
  'beard_full_mustache': 'beardMajestic',
  'beard_mustache': 'moustacheFancy',
  'beard_goatee': 'moustacheMagnum',
};

const _eyewear = {
  'eye_glasses': 'prescription02',
  'eye_round': 'round',
  'eye_sport': 'wayfarers',
  'eye_sunglasses': 'sunglasses',
};

const _clothing = {
  'top_basketball_jersey': 'shirtScoopNeck',
  'top_tank': 'shirtScoopNeck',
  'top_running_shirt': 'shirtScoopNeck',
  'top_sports_bra': 'shirtScoopNeck',
  'top_football_jersey': 'shirtVNeck',
  'top_badminton_shirt': 'shirtVNeck',
  'top_tennis_shirt': 'collarAndSweater',
  'top_tee': 'shirtCrewNeck',
  'top_compression': 'shirtCrewNeck',
  'top_hoodie': 'hoodie',
};

const _skin = {
  'skin_01': '#F4D8C6',
  'skin_02': '#EDD0B8',
  'skin_03': '#E2BC96',
  'skin_04': '#C99563',
  'skin_05': '#A67A4E',
  'skin_06': '#8B5E3C',
  'skin_07': '#6E4528',
  'skin_08': '#4F321C',
  'skin_09': '#D9A574',
  'skin_10': '#B8895A',
  'skin_11': '#9A6B47',
  'skin_12': '#7A5235',
};

const _hairColors = {
  'black': '#1b1714',
  'dark_brown': '#3b2618',
  'brown': '#5c3a1e',
  'light_brown': '#8a5d34',
  'blonde': '#d6ad5f',
  'platinum': '#e4dfd3',
  'red': '#a2452a',
  'grey': '#8d8d8f',
};

/// Tops that carry a jersey number on the chest.
const _numbered = {'top_basketball_jersey', 'top_football_jersey', 'top_tank', 'top_badminton_shirt'};

String _hex(String h) => h.replaceFirst('#', '').toLowerCase();

/// The jersey number to print on the chest, or null when the top has none.
String? jerseyNumber(PlayerAvatar c) {
  final n = kitOf(c).number.replaceAll(RegExp(r'\D'), '');
  return _numbered.contains(c.top) && n.isNotEmpty ? n : null;
}

/// Head-and-shoulders portrait (transparent PNG, square) for [c], optionally with a sticker face.
/// DiceBear serves PNGs up to 256 px.
String playerAvatarPngUrl(PlayerAvatar c, {AvatarExpression expression = const AvatarExpression(), int size = 256}) {
  final kit = kitOf(c);
  final hat = c.headwear == null ? null : _headwear[c.headwear];
  final beard = _beards[c.facialHair];
  final glasses = c.eyewear == null ? null : _eyewear[c.eyewear];
  final q = <String, String>{
    'seed': 'player',
    'size': '${size.clamp(16, 256)}',
    'top': hat ?? _hair[c.hair] ?? 'shortFlat',
    'topProbability': '100',
    'hairColor': _hex(_hairColors[c.hairColor] ?? _hairColors['black']!),
    'hatColor': _hex(kit.accent),
    'skinColor': _hex(_skin[c.skinTone] ?? _skin['skin_04']!),
    'eyes': expression.eyes ?? _eyes[c.eyes] ?? 'default',
    'eyebrows': expression.eyebrows ?? _brows[c.eyebrows] ?? 'defaultNatural',
    'mouth': expression.mouth ?? _mouths[c.mouth] ?? 'smile',
    'facialHairProbability': beard == null ? '0' : '100',
    'facialHair': ?beard,
    'facialHairColor': _hex(_hairColors[c.hairColor] ?? _hairColors['black']!),
    'accessoriesProbability': glasses == null ? '0' : '100',
    'accessories': ?glasses,
    'accessoriesColor': '262e33',
    'clothing': _clothing[c.top] ?? 'shirtCrewNeck',
    'clothesColor': _hex(kit.main),
  };
  return Uri.https('api.dicebear.com', '/9.x/avataaars/png', q).toString();
}

/// Portrait art for a player: the web studio avatar when there is one, else the
/// app's preset avatar (v2), else null (initials only).
class AvatarArt {
  final PlayerAvatar? player;
  final AvatarConfigV2? preset;
  const AvatarArt({this.player, this.preset});

  bool get isEmpty => player == null && preset == null;

  /// Kit accent for captions: the player's kit, else the preset jersey colour.
  String get accentHex {
    if (player != null) return kitOf(player!).accent;
    final c = jerseyFillColors[preset?.color] ?? 0xFFF2552C;
    return '#${(c & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';
  }

  String? pngUrl({AvatarExpression expression = const AvatarExpression(), int size = 256}) {
    if (player != null) return playerAvatarPngUrl(player!, expression: expression, size: size);
    if (preset != null) return dicebearAvatarUrl(preset!, size: size.clamp(16, 256), format: 'png', expression: expression, transparent: true);
    return null;
  }

  String? get jersey => player == null ? null : jerseyNumber(player!);
}

/// The art to draw for [u]: their studio avatar, else their preset avatar.
AvatarArt avatarArtOf(PublicUser u) => AvatarArt(player: u.playerAvatar, preset: AvatarConfigV2.fromJson(u.avatarConfig));
