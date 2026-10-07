// The web avatar studio's full player config (PlayerAvatarConfig, saved with
// PUT /api/me/avatar) — a port of web/src/avatar/schema.ts, registry.ts,
// presets.ts and randomize.ts, with the backend's allowed values
// (backend/internal/avatar/catalog.go) so a save never fails validation.

import 'dart:math';

import 'l10n.dart';
import 'player_avatar.dart';

const playerAvatarVersion = 1;

/// Sports that have an avatar kit (web AVATAR_SPORTS).
const avatarSports = ['basketball', 'football', 'tennis', 'badminton', 'volleyball', 'running', 'gym'];

const _unset = Object();

class PlayerAvatarConfig {
  final String bodyType;

  /// Metres, 1.45–2.25.
  final double height;
  final String skinTone, face, eyes, eyebrows, nose, mouth, hair, hairColor, facialHair, top, bottom, shoes;
  final String? headwear, eyewear, accessory;
  final String sport;
  final String? sportsEquipment;
  final String pose;
  final bool useAsProfile;

  // Optional (older saves omit them → default look).
  final String? figure, eyeColor, lashes, lipColor;
  final List<String>? details;

  /// Team colour ids (see [kitColorIds]); null = the sport's colours.
  final String? kitMain, kitTrim;

  /// Jersey number 0–99; null = the sport's default.
  final int? number;

  const PlayerAvatarConfig({
    required this.bodyType,
    required this.height,
    required this.skinTone,
    required this.face,
    required this.eyes,
    required this.eyebrows,
    required this.nose,
    required this.mouth,
    required this.hair,
    required this.hairColor,
    required this.facialHair,
    required this.top,
    required this.bottom,
    required this.shoes,
    this.headwear,
    this.eyewear,
    this.accessory,
    required this.sport,
    this.sportsEquipment,
    required this.pose,
    this.useAsProfile = true,
    this.figure,
    this.eyeColor,
    this.lashes,
    this.lipColor,
    this.details,
    this.kitMain,
    this.kitTrim,
    this.number,
  });

  /// Nullable fields take [_unset] by default so `copyWith(headwear: null)` clears them.
  PlayerAvatarConfig copyWith({
    String? bodyType,
    double? height,
    String? skinTone,
    String? face,
    String? eyes,
    String? eyebrows,
    String? nose,
    String? mouth,
    String? hair,
    String? hairColor,
    String? facialHair,
    String? top,
    String? bottom,
    String? shoes,
    Object? headwear = _unset,
    Object? eyewear = _unset,
    Object? accessory = _unset,
    String? sport,
    Object? sportsEquipment = _unset,
    String? pose,
    bool? useAsProfile,
    Object? figure = _unset,
    Object? eyeColor = _unset,
    Object? lashes = _unset,
    Object? lipColor = _unset,
    Object? details = _unset,
    Object? kitMain = _unset,
    Object? kitTrim = _unset,
    Object? number = _unset,
  }) {
    T? pick<T>(Object? v, T? old) => identical(v, _unset) ? old : v as T?;
    return PlayerAvatarConfig(
      bodyType: bodyType ?? this.bodyType,
      height: height ?? this.height,
      skinTone: skinTone ?? this.skinTone,
      face: face ?? this.face,
      eyes: eyes ?? this.eyes,
      eyebrows: eyebrows ?? this.eyebrows,
      nose: nose ?? this.nose,
      mouth: mouth ?? this.mouth,
      hair: hair ?? this.hair,
      hairColor: hairColor ?? this.hairColor,
      facialHair: facialHair ?? this.facialHair,
      top: top ?? this.top,
      bottom: bottom ?? this.bottom,
      shoes: shoes ?? this.shoes,
      headwear: pick<String>(headwear, this.headwear),
      eyewear: pick<String>(eyewear, this.eyewear),
      accessory: pick<String>(accessory, this.accessory),
      sport: sport ?? this.sport,
      sportsEquipment: pick<String>(sportsEquipment, this.sportsEquipment),
      pose: pose ?? this.pose,
      useAsProfile: useAsProfile ?? this.useAsProfile,
      figure: pick<String>(figure, this.figure),
      eyeColor: pick<String>(eyeColor, this.eyeColor),
      lashes: pick<String>(lashes, this.lashes),
      lipColor: pick<String>(lipColor, this.lipColor),
      details: pick<List<String>>(details, this.details),
      kitMain: pick<String>(kitMain, this.kitMain),
      kitTrim: pick<String>(kitTrim, this.kitTrim),
      number: pick<int>(number, this.number),
    );
  }

  /// The web's PUT /api/me/avatar body (JSON.stringify drops undefined optionals).
  Map<String, dynamic> toJson() => {
        'version': playerAvatarVersion,
        'bodyType': bodyType,
        'height': height,
        'skinTone': skinTone,
        'face': face,
        'eyes': eyes,
        'eyebrows': eyebrows,
        'nose': nose,
        'mouth': mouth,
        'hair': hair,
        'hairColor': hairColor,
        'facialHair': facialHair,
        'top': top,
        'bottom': bottom,
        'shoes': shoes,
        'headwear': headwear,
        'eyewear': eyewear,
        'accessory': accessory,
        'sport': sport,
        'sportsEquipment': sportsEquipment,
        'pose': pose,
        'useAsProfile': useAsProfile,
        'figure': ?figure,
        'eyeColor': ?eyeColor,
        'lashes': ?lashes,
        'lipColor': ?lipColor,
        if (details != null && details!.isNotEmpty) 'details': details,
        'kitMain': ?kitMain,
        'kitTrim': ?kitTrim,
        'number': ?number,
      };

  /// Same rule as the web's parsePlayerAvatar (version 1 with a body type and
  /// skin tone). Missing or unknown values fall back to the reference player,
  /// so the result always passes [playerAvatarErrors].
  static PlayerAvatarConfig? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    if (raw['version'] != playerAvatarVersion) return null;
    if (raw['bodyType'] is! String || raw['skinTone'] is! String) return null;
    final sport = avatarSports.contains(raw['sport']) ? raw['sport'] as String : 'basketball';
    final base = defaultPlayerConfig(sport);
    String req(String k, Set<String> allowed, String fallback) {
      final v = raw[k];
      return v is String && allowed.contains(v) ? v : fallback;
    }

    String? opt(String k, Set<String> allowed, [String? fallback]) {
      final v = raw[k];
      if (v == null || v == '') return null;
      return v is String && allowed.contains(v) ? v : fallback;
    }

    final h = raw['height'];
    final n = raw['number'];
    final d = raw['details'];
    return PlayerAvatarConfig(
      bodyType: req('bodyType', allowedBodyTypes, base.bodyType),
      height: h is num ? h.toDouble().clamp(1.45, 2.25).toDouble() : base.height,
      skinTone: req('skinTone', allowedSkinTones, base.skinTone),
      face: req('face', allowedFaces, base.face),
      eyes: req('eyes', allowedEyes, base.eyes),
      eyebrows: req('eyebrows', allowedEyebrows, base.eyebrows),
      nose: req('nose', allowedNoses, base.nose),
      mouth: req('mouth', allowedMouths, base.mouth),
      hair: req('hair', allowedHairs, base.hair),
      hairColor: req('hairColor', allowedHairColors, base.hairColor),
      facialHair: req('facialHair', allowedFacialHairs, base.facialHair),
      top: req('top', allowedTops, base.top),
      bottom: req('bottom', allowedBottoms, base.bottom),
      shoes: req('shoes', allowedShoes, base.shoes),
      headwear: opt('headwear', allowedHeadwear),
      eyewear: opt('eyewear', allowedEyewear),
      accessory: opt('accessory', allowedAccessories),
      sport: sport,
      sportsEquipment: opt('sportsEquipment', allowedEquipment),
      pose: req('pose', allowedPoses, base.pose),
      useAsProfile: raw['useAsProfile'] == true,
      figure: opt('figure', allowedFigures),
      eyeColor: opt('eyeColor', allowedEyeColors),
      lashes: opt('lashes', allowedLashes),
      lipColor: opt('lipColor', allowedLipColors),
      details: d is List ? {for (final x in d) if (x is String && allowedDetails.contains(x)) x}.toList() : null,
      kitMain: opt('kitMain', allowedKitColors),
      kitTrim: opt('kitTrim', allowedKitColors),
      number: n is num ? n.round().clamp(0, 99) : null,
    );
  }

  /// The render-side view (DiceBear Avataaars PNG, see player_avatar.dart).
  PlayerAvatar toPlayerAvatar() => PlayerAvatar(
        sport: sport,
        skinTone: skinTone,
        eyes: eyes,
        eyebrows: eyebrows,
        mouth: mouth,
        hair: hair,
        hairColor: hairColor,
        facialHair: facialHair,
        top: top,
        headwear: headwear,
        eyewear: eyewear,
        kitMain: kitMain,
        kitTrim: kitTrim,
        number: number,
      );

  /// Value of a studio field by its web key (for option grids).
  Object? valueOf(String field) => toJson()[field];

  /// Apply one choice; picking a sport also dresses the player in that sport's kit (web withValue).
  PlayerAvatarConfig withValue(String field, String? value) {
    switch (field) {
      case 'sport':
        final s = value ?? 'basketball';
        final k = sportKit(s);
        return copyWith(sport: s, top: k.top, bottom: k.bottom, shoes: k.shoes, sportsEquipment: k.equipment);
      case 'skinTone':
        return copyWith(skinTone: value);
      case 'eyes':
        return copyWith(eyes: value);
      case 'eyebrows':
        return copyWith(eyebrows: value);
      case 'mouth':
        return copyWith(mouth: value);
      case 'facialHair':
        return copyWith(facialHair: value);
      case 'hair':
        return copyWith(hair: value);
      case 'hairColor':
        return copyWith(hairColor: value);
      case 'top':
        return copyWith(top: value);
      case 'headwear':
        return copyWith(headwear: value);
      case 'eyewear':
        return copyWith(eyewear: value);
      case 'kitMain':
        return copyWith(kitMain: value);
      case 'kitTrim':
        return copyWith(kitTrim: value);
    }
    throw ArgumentError.value(field, 'field');
  }

  @override
  bool operator ==(Object other) => other is PlayerAvatarConfig && _jsonEq(other.toJson(), toJson());

  @override
  int get hashCode => toJson().toString().hashCode;
}

bool _jsonEq(Map<String, dynamic> a, Map<String, dynamic> b) => a.toString() == b.toString();

// ---------------------------------------------------------------------------
// Backend allowed values (backend/internal/avatar/catalog.go).

const allowedBodyTypes = {'slim', 'average', 'athletic', 'muscular', 'larger'};
const allowedSkinTones = {
  'skin_01', 'skin_02', 'skin_03', 'skin_04', 'skin_05', 'skin_06', //
  'skin_07', 'skin_08', 'skin_09', 'skin_10', 'skin_11', 'skin_12',
};
const allowedFaces = {'face_oval', 'face_round', 'face_square', 'face_heart', 'face_long', 'face_angular'};
const allowedEyes = {'eyes_01', 'eyes_02', 'eyes_03', 'eyes_04', 'eyes_05', 'eyes_wink'};
const allowedEyebrows = {'brow_straight', 'brow_curved', 'brow_thick', 'brow_thin', 'brow_athletic', 'brow_expressive'};
const allowedNoses = {'nose_small', 'nose_medium', 'nose_large', 'nose_straight', 'nose_rounded', 'nose_wide', 'nose_narrow'};
const allowedMouths = {'mouth_neutral', 'mouth_smile', 'mouth_big_smile', 'mouth_serious', 'mouth_confident', 'mouth_relaxed'};
const allowedHairs = {
  'hair_buzz', 'hair_fade_low', 'hair_fade_mid', 'hair_fade_high', 'hair_crop', 'hair_curls_short', //
  'hair_wavy_med', 'hair_afro', 'hair_twists', 'hair_locs', 'hair_braids', 'hair_ponytail',
  'hair_box_braids', 'hair_cornrows', 'hair_hightop', 'hair_mohawk', 'hair_bun', 'hair_bantu_knots',
  'hair_headwrap', 'hair_long_straight', 'hair_pixie', 'hair_puff',
  'hair_short_flat', 'hair_short_round', 'hair_side_part', 'hair_waves', 'hair_quiff', 'hair_locs_long',
  'hair_curly', 'hair_long_curly', 'hair_big', 'hair_braid_crown', 'hair_bob', 'hair_bob_bangs',
  'hair_shaggy', 'hair_mullet', 'hair_shaved_side', 'hair_long_wavy', 'hair_long_sleek', 'hair_long_strand',
  'hair_balding', 'hair_hijab',
};
const allowedHairColors = {'black', 'dark_brown', 'brown', 'light_brown', 'blonde', 'platinum', 'red', 'grey'};
const allowedFacialHairs = {
  'beard_none', 'beard_stubble', 'beard_mustache', 'beard_short', 'beard_full', 'beard_goatee', 'beard_full_mustache', //
};
const allowedTops = {
  'top_basketball_jersey', 'top_football_jersey', 'top_tennis_shirt', 'top_badminton_shirt', 'top_running_shirt', //
  'top_compression', 'top_hoodie', 'top_tank', 'top_tee', 'top_sports_bra',
};
const allowedBottoms = {
  'bottom_basketball_shorts', 'bottom_football_shorts', 'bottom_tennis_shorts', 'bottom_running_shorts', //
  'bottom_sweatpants', 'bottom_athletic_pants', 'bottom_leggings', 'bottom_tennis_skirt',
};
const allowedShoes = {'shoes_basketball', 'shoes_football', 'shoes_tennis', 'shoes_running', 'shoes_badminton', 'shoes_sneakers'};
const allowedHeadwear = {'head_cap', 'head_headband', 'head_bandana', 'head_beanie', 'head_bobble', 'head_earflap'};
const allowedEyewear = {'eye_glasses', 'eye_sunglasses', 'eye_sport', 'eye_round'};
const allowedAccessories = {'acc_wristbands', 'acc_watch', 'acc_necklace', 'acc_earrings'};
const allowedSports = {'basketball', 'football', 'tennis', 'badminton', 'volleyball', 'running', 'gym'};
const allowedEquipment = {
  'eq_basketball', 'eq_football', 'eq_tennis_racket', 'eq_badminton_racket', 'eq_volleyball', 'eq_water_bottle', 'eq_dumbbells', //
};
const allowedPoses = {'standing', 'action'};
const allowedFigures = {'straight', 'curvy'};
const allowedEyeColors = {'brown', 'dark', 'hazel', 'green', 'blue', 'grey'};
const allowedLashes = {'none', 'natural', 'bold'};
const allowedLipColors = {'natural', 'nude', 'rose', 'berry', 'red'};
const allowedDetails = {'freckles', 'beauty_mark', 'dimples', 'face_paint', 'tattoo_arm', 'tattoo_sleeve'};
const allowedKitColors = {
  'red', 'orange', 'gold', 'green', 'teal', 'sky', 'blue', 'navy', 'purple', 'pink', 'maroon', 'black', 'white', 'grey', //
};

/// Port of the backend's avatar.Validate on a PUT body: the failing fields, empty when it saves.
List<String> playerAvatarErrors(Map<String, dynamic> j) {
  final errs = <String>[];
  if (j['version'] != playerAvatarVersion) errs.add('version');
  final h = j['height'];
  if (h is! num || h < 1.45 || h > 2.25) errs.add('height');
  void req(String k, Set<String> allowed) {
    if (!allowed.contains(j[k])) errs.add(k);
  }

  void opt(String k, Set<String> allowed) {
    final v = j[k];
    if (v == null || v == '') return;
    if (!allowed.contains(v)) errs.add(k);
  }

  req('bodyType', allowedBodyTypes);
  req('skinTone', allowedSkinTones);
  req('face', allowedFaces);
  req('eyes', allowedEyes);
  req('eyebrows', allowedEyebrows);
  req('nose', allowedNoses);
  req('mouth', allowedMouths);
  req('hair', allowedHairs);
  req('hairColor', allowedHairColors);
  req('facialHair', allowedFacialHairs);
  req('top', allowedTops);
  req('bottom', allowedBottoms);
  req('shoes', allowedShoes);
  req('sport', allowedSports);
  req('pose', allowedPoses);
  opt('headwear', allowedHeadwear);
  opt('eyewear', allowedEyewear);
  opt('accessory', allowedAccessories);
  opt('sportsEquipment', allowedEquipment);
  opt('figure', allowedFigures);
  opt('eyeColor', allowedEyeColors);
  opt('lashes', allowedLashes);
  opt('lipColor', allowedLipColors);
  opt('kitMain', allowedKitColors);
  opt('kitTrim', allowedKitColors);
  if (j['useAsProfile'] is! bool) errs.add('useAsProfile');
  final d = j['details'];
  if (d != null) {
    if (d is! List || d.length > allowedDetails.length || d.toSet().length != d.length || d.any((x) => !allowedDetails.contains(x))) {
      errs.add('details');
    }
  }
  final n = j['number'];
  if (n != null && (n is! int || n < 0 || n > 99)) errs.add('number');
  return errs;
}

// ---------------------------------------------------------------------------
// Defaults and presets (web/src/avatar/presets.ts).

/// Visual quality bar — athletic 6'2" basketball player.
const referencePlayerAvatar = PlayerAvatarConfig(
  bodyType: 'athletic',
  height: 1.88,
  skinTone: 'skin_05',
  face: 'face_oval',
  eyes: 'eyes_01',
  eyebrows: 'brow_curved',
  nose: 'nose_medium',
  mouth: 'mouth_smile',
  hair: 'hair_crop',
  hairColor: 'black',
  facialHair: 'beard_none',
  top: 'top_basketball_jersey',
  bottom: 'bottom_basketball_shorts',
  shoes: 'shoes_basketball',
  accessory: 'acc_wristbands',
  sport: 'basketball',
  sportsEquipment: 'eq_basketball',
  pose: 'standing',
  useAsProfile: true,
);

typedef SportKit = ({String top, String bottom, String shoes, String? equipment});

/// Default outfit + equipment for each sport (picking a sport dresses the player in it).
SportKit sportKit(String sport) => switch (sport) {
      'football' => (top: 'top_football_jersey', bottom: 'bottom_football_shorts', shoes: 'shoes_football', equipment: 'eq_football'),
      'volleyball' => (top: 'top_tank', bottom: 'bottom_running_shorts', shoes: 'shoes_badminton', equipment: 'eq_volleyball'),
      'tennis' => (top: 'top_tennis_shirt', bottom: 'bottom_tennis_shorts', shoes: 'shoes_tennis', equipment: 'eq_tennis_racket'),
      'badminton' => (top: 'top_badminton_shirt', bottom: 'bottom_athletic_pants', shoes: 'shoes_badminton', equipment: 'eq_badminton_racket'),
      'running' => (top: 'top_running_shirt', bottom: 'bottom_running_shorts', shoes: 'shoes_running', equipment: 'eq_water_bottle'),
      'gym' => (top: 'top_compression', bottom: 'bottom_sweatpants', shoes: 'shoes_sneakers', equipment: 'eq_dumbbells'),
      _ => (top: 'top_basketball_jersey', bottom: 'bottom_basketball_shorts', shoes: 'shoes_basketball', equipment: 'eq_basketball'),
    };

/// The web's defaultConfig(sport): the reference player dressed for [sport].
PlayerAvatarConfig defaultPlayerConfig([String? sport]) {
  final s = avatarSports.contains(sport) ? sport! : 'basketball';
  return referencePlayerAvatar.withValue('sport', s);
}

class AvatarPresetInfo {
  final String id, sport, _en, _fr;
  const AvatarPresetInfo(this.id, this._en, this._fr, this.sport);
  String get name => tr(_en, _fr);
}

const avatarPresetInfos = [
  AvatarPresetInfo('hooper', 'The Hooper', 'Le Basketteur', 'basketball'),
  AvatarPresetInfo('footballer', 'The Footballer', 'Le Footballeur', 'football'),
  AvatarPresetInfo('volleyball', 'The Spiker', 'La Smasheuse', 'volleyball'),
  AvatarPresetInfo('tennis', 'The Tennis Player', 'La Joueuse de tennis', 'tennis'),
  AvatarPresetInfo('badminton', 'The Shuttler', 'La Badiste', 'badminton'),
  AvatarPresetInfo('runner', 'The Runner', 'Le Coureur', 'running'),
  AvatarPresetInfo('gym', 'The Gym Athlete', 'L’Athlète de muscu', 'gym'),
  AvatarPresetInfo('casual', 'The Casual', 'Le Décontracté', 'basketball'),
];

/// The web's presetConfig(id).
PlayerAvatarConfig playerPresetConfig(String presetId) {
  final meta = avatarPresetInfos.firstWhere((p) => p.id == presetId, orElse: () => avatarPresetInfos.first);
  final base = defaultPlayerConfig(meta.sport);
  switch (presetId) {
    case 'footballer':
      return base.copyWith(
          skinTone: 'skin_08', hair: 'hair_short_flat', facialHair: 'beard_short', bodyType: 'muscular', accessory: null, height: 1.8, details: ['face_paint']);
    case 'volleyball':
      return base.copyWith(
        figure: 'curvy',
        top: 'top_sports_bra',
        bottom: 'bottom_leggings',
        skinTone: 'skin_07',
        hair: 'hair_puff',
        lashes: 'bold',
        lipColor: 'berry',
        eyeColor: 'dark',
        bodyType: 'athletic',
        pose: 'action',
        accessory: 'acc_earrings',
        height: 1.84,
      );
    case 'tennis':
      return base.copyWith(
        figure: 'curvy',
        bottom: 'bottom_tennis_skirt',
        skinTone: 'skin_03',
        hair: 'hair_long_wavy',
        hairColor: 'dark_brown',
        face: 'face_heart',
        eyes: 'eyes_05',
        eyeColor: 'hazel',
        lashes: 'natural',
        lipColor: 'rose',
        accessory: 'acc_watch',
        bodyType: 'slim',
        pose: 'action',
        height: 1.72,
      );
    case 'badminton':
      return base.copyWith(
        figure: 'curvy',
        bottom: 'bottom_leggings',
        skinTone: 'skin_10',
        hair: 'hair_bun',
        hairColor: 'black',
        eyewear: 'eye_glasses',
        lashes: 'natural',
        lipColor: 'nude',
        details: ['dimples'],
        bodyType: 'average',
        kitMain: 'pink',
        kitTrim: 'white',
        number: 21,
        height: 1.66,
      );
    case 'runner':
      return base.copyWith(
        skinTone: 'skin_01',
        hair: 'hair_curls_short',
        hairColor: 'red',
        eyeColor: 'green',
        headwear: null,
        bodyType: 'slim',
        accessory: 'acc_watch',
        details: ['freckles'],
        height: 1.76,
      );
    case 'gym':
      return base.copyWith(
          skinTone: 'skin_06', hair: 'hair_buzz', facialHair: 'beard_full_mustache', bodyType: 'muscular', accessory: null, details: ['tattoo_sleeve'], height: 1.82);
    case 'casual':
      return base.copyWith(
        top: 'top_hoodie',
        bottom: 'bottom_sweatpants',
        shoes: 'shoes_sneakers',
        sportsEquipment: null,
        skinTone: 'skin_11',
        hair: 'hair_locs_long',
        facialHair: 'beard_goatee',
        accessory: null,
      );
    default:
      return base.copyWith(hair: 'hair_short_round');
  }
}

/// The web's randomizeAvatar: one sport's kit, random look; keeps the profile-picture choice.
PlayerAvatarConfig randomPlayerConfig({PlayerAvatarConfig? base, Random? random}) {
  final r = random ?? Random();
  T pick<T>(List<T> l) => l[r.nextInt(l.length)];
  List<String> ids(List<AvatarOption> l) => [for (final o in l) o.id];
  final sport = pick(ids(avatarSportOptions));
  return defaultPlayerConfig(sport).copyWith(
    bodyType: pick(const ['slim', 'average', 'athletic', 'muscular', 'larger']),
    height: ((1.6 + r.nextDouble() * 0.4) * 100).round() / 100,
    skinTone: pick(ids(avatarSkinOptions)),
    face: pick(allowedFaces.toList()),
    eyes: pick(ids(avatarEyesOptions)),
    eyebrows: pick(ids(avatarBrowOptions)),
    nose: pick(allowedNoses.toList()),
    mouth: pick([for (final m in ids(avatarMouthOptions)) if (m != 'mouth_confident') m]),
    hair: pick(ids(avatarHairOptions)),
    hairColor: r.nextDouble() > 0.35 ? pick(const ['black', 'dark_brown']) : pick(ids(avatarHairColorOptions)),
    facialHair: r.nextDouble() > 0.5 ? 'beard_none' : pick(ids(avatarBeardOptions)),
    headwear: r.nextDouble() > 0.88 ? pick(ids(avatarHeadwearOptions)) : null,
    eyewear: r.nextDouble() > 0.85 ? pick(ids(avatarEyewearOptions)) : null,
    accessory: r.nextDouble() > 0.55 ? pick(allowedAccessories.toList()) : null,
    pose: r.nextDouble() > 0.5 ? 'action' : 'standing',
    figure: r.nextDouble() > 0.5 ? 'curvy' : 'straight',
    eyeColor: r.nextDouble() > 0.6 ? pick(allowedEyeColors.toList()) : 'brown',
    lashes: r.nextDouble() > 0.55 ? pick(const ['natural', 'bold']) : 'none',
    lipColor: r.nextDouble() > 0.65 ? pick(allowedLipColors.toList()) : 'natural',
    details: [for (final d in allowedDetails) if (r.nextDouble() > 0.85) d],
    useAsProfile: base?.useAsProfile ?? true,
  );
}

// ---------------------------------------------------------------------------
// Studio options in the web registry's order, with its EN/FR names
// (web/src/avatar/registry.ts + web/src/i18n/screens/avatarLabels.ts).

class AvatarOption {
  final String id, _en, _fr;

  /// Swatch colour (#rrggbb) for colour pickers.
  final String? hex;
  const AvatarOption(this.id, this._en, this._fr, [this.hex]);
  String get name => tr(_en, _fr);
}

const avatarSkinOptions = [
  AvatarOption('skin_01', 'Tone 1', 'Teinte 1', '#F4D8C6'),
  AvatarOption('skin_02', 'Tone 2', 'Teinte 2', '#EDD0B8'),
  AvatarOption('skin_03', 'Tone 3', 'Teinte 3', '#E2BC96'),
  AvatarOption('skin_04', 'Tone 4', 'Teinte 4', '#C99563'),
  AvatarOption('skin_05', 'Tone 5', 'Teinte 5', '#A67A4E'),
  AvatarOption('skin_06', 'Tone 6', 'Teinte 6', '#8B5E3C'),
  AvatarOption('skin_07', 'Tone 7', 'Teinte 7', '#6E4528'),
  AvatarOption('skin_08', 'Tone 8', 'Teinte 8', '#4F321C'),
  AvatarOption('skin_09', 'Tone 9', 'Teinte 9', '#D9A574'),
  AvatarOption('skin_10', 'Tone 10', 'Teinte 10', '#B8895A'),
  AvatarOption('skin_11', 'Tone 11', 'Teinte 11', '#9A6B47'),
  AvatarOption('skin_12', 'Tone 12', 'Teinte 12', '#7A5235'),
];

const avatarEyesOptions = [
  AvatarOption('eyes_01', 'Default', 'Par défaut'),
  AvatarOption('eyes_03', 'Happy', 'Joyeux'),
  AvatarOption('eyes_02', 'Focused', 'Concentré'),
  AvatarOption('eyes_04', 'Side glance', 'Regard de côté'),
  AvatarOption('eyes_05', 'Wide', 'Grands ouverts'),
  AvatarOption('eyes_wink', 'Wink', 'Clin d’œil'),
];

const avatarBrowOptions = [
  AvatarOption('brow_curved', 'Natural', 'Naturels'),
  AvatarOption('brow_straight', 'Flat', 'Droits'),
  AvatarOption('brow_thick', 'Bold', 'Épais'),
  AvatarOption('brow_thin', 'Raised', 'Levés'),
  AvatarOption('brow_athletic', 'Determined', 'Déterminés'),
  AvatarOption('brow_expressive', 'Expressive', 'Expressifs'),
];

const avatarMouthOptions = [
  AvatarOption('mouth_neutral', 'Grin', 'Sourire large'),
  AvatarOption('mouth_smile', 'Smile', 'Sourire'),
  AvatarOption('mouth_big_smile', 'Big smile', 'Grand sourire'),
  AvatarOption('mouth_serious', 'Serious', 'Sérieux'),
  AvatarOption('mouth_confident', 'Cheeky', 'Espiègle'),
];

const avatarBeardOptions = [
  AvatarOption('beard_none', 'None', 'Aucune'),
  AvatarOption('beard_stubble', 'Light beard', 'Barbe légère'),
  AvatarOption('beard_short', 'Beard', 'Barbe'),
  AvatarOption('beard_full', 'Full beard', 'Barbe fournie'),
  AvatarOption('beard_mustache', 'Moustache', 'Moustache'),
  AvatarOption('beard_goatee', 'Big moustache', 'Grosse moustache'),
];

const avatarHairOptions = [
  AvatarOption('hair_buzz', 'Buzz cut', 'Coupe rase'),
  AvatarOption('hair_short_flat', 'Short', 'Courts'),
  AvatarOption('hair_short_round', 'Short round', 'Courts arrondis'),
  AvatarOption('hair_side_part', 'Side part', 'Raie sur le côté'),
  AvatarOption('hair_waves', 'Waves', 'Waves'),
  AvatarOption('hair_curls_short', 'Short curls', 'Boucles courtes'),
  AvatarOption('hair_quiff', 'Quiff', 'Banane'),
  AvatarOption('hair_twists', 'Twists', 'Twists'),
  AvatarOption('hair_locs', 'Locs', 'Locks'),
  AvatarOption('hair_locs_long', 'Long locs', 'Locks longues'),
  AvatarOption('hair_afro', 'Afro', 'Afro'),
  AvatarOption('hair_puff', 'Afro + band', 'Afro + bandeau'),
  AvatarOption('hair_curly', 'Curly', 'Bouclés'),
  AvatarOption('hair_long_curly', 'Long curly', 'Longs bouclés'),
  AvatarOption('hair_big', 'Big hair', 'Volumineux'),
  AvatarOption('hair_bun', 'Bun', 'Chignon'),
  AvatarOption('hair_braid_crown', 'Braid crown', 'Couronne tressée'),
  AvatarOption('hair_bob', 'Bob', 'Carré'),
  AvatarOption('hair_bob_bangs', 'Bob + bangs', 'Carré + frange'),
  AvatarOption('hair_shaggy', 'Shaggy', 'Effilés'),
  AvatarOption('hair_mullet', 'Mullet', 'Mulet'),
  AvatarOption('hair_shaved_side', 'Shaved side', 'Côté rasé'),
  AvatarOption('hair_long_wavy', 'Long wavy', 'Longs ondulés'),
  AvatarOption('hair_long_straight', 'Long straight', 'Longs raides'),
  AvatarOption('hair_long_sleek', 'Long sleek', 'Longs lissés'),
  AvatarOption('hair_long_strand', 'Long + strand', 'Longs + mèche'),
  AvatarOption('hair_balding', 'Balding', 'Dégarni'),
  AvatarOption('hair_headwrap', 'Turban', 'Turban'),
  AvatarOption('hair_hijab', 'Hijab', 'Hijab'),
];

/// Swatches use the portrait palette (web render/palette.ts HAIR_COLORS).
const avatarHairColorOptions = [
  AvatarOption('black', 'Black', 'Noir', '#1b1714'),
  AvatarOption('dark_brown', 'Dark brown', 'Brun foncé', '#3b2618'),
  AvatarOption('brown', 'Brown', 'Brun', '#5c3a1e'),
  AvatarOption('light_brown', 'Light brown', 'Châtain clair', '#8a5d34'),
  AvatarOption('blonde', 'Blonde', 'Blond', '#d6ad5f'),
  AvatarOption('platinum', 'Platinum', 'Platine', '#e4dfd3'),
  AvatarOption('red', 'Red', 'Roux', '#a2452a'),
  AvatarOption('grey', 'Grey', 'Gris', '#8d8d8f'),
];

const avatarSportOptions = [
  AvatarOption('basketball', 'Basketball', 'Basket'),
  AvatarOption('football', 'Football', 'Football'),
  AvatarOption('tennis', 'Tennis', 'Tennis'),
  AvatarOption('badminton', 'Badminton', 'Badminton'),
  AvatarOption('volleyball', 'Volleyball', 'Volley'),
  AvatarOption('running', 'Running', 'Course à pied'),
  AvatarOption('gym', 'Gym', 'Musculation'),
];

/// Sports with a club in the app; picking one sets the kit colours and shirt (web PORTRAIT_SPORTS).
final avatarPortraitSportOptions = [
  for (final s in avatarSportOptions)
    if (const {'basketball', 'football', 'volleyball', 'tennis', 'badminton'}.contains(s.id)) s,
];

const avatarTopOptions = [
  AvatarOption('top_basketball_jersey', 'Basketball jersey', 'Maillot de basket'),
  AvatarOption('top_football_jersey', 'Football jersey', 'Maillot de foot'),
  AvatarOption('top_tennis_shirt', 'Tennis shirt', 'Polo de tennis'),
  AvatarOption('top_badminton_shirt', 'Badminton shirt', 'Tee-shirt de badminton'),
  AvatarOption('top_running_shirt', 'Running shirt', 'Tee-shirt de running'),
  AvatarOption('top_compression', 'Compression top', 'Haut de compression'),
  AvatarOption('top_hoodie', 'Hoodie', 'Sweat à capuche'),
  AvatarOption('top_tank', 'Tank top', 'Débardeur'),
  AvatarOption('top_tee', 'Casual tee', 'Tee-shirt'),
  AvatarOption('top_sports_bra', 'Sports bra', 'Brassière de sport'),
];

/// Tops that look different as a portrait (the rest share a neckline) — web PORTRAIT_TOPS.
final avatarPortraitTopOptions = [
  for (final t in avatarTopOptions)
    if (const {'top_basketball_jersey', 'top_football_jersey', 'top_tennis_shirt', 'top_tee', 'top_hoodie'}.contains(t.id)) t,
];

const avatarHeadwearOptions = [
  AvatarOption('head_cap', 'Hat', 'Casquette'),
  AvatarOption('head_beanie', 'Beanie', 'Bonnet'),
  AvatarOption('head_bobble', 'Bobble hat', 'Bonnet à pompon'),
  AvatarOption('head_earflap', 'Earflap hat', 'Chapka'),
];

const avatarEyewearOptions = [
  AvatarOption('eye_glasses', 'Glasses', 'Lunettes'),
  AvatarOption('eye_round', 'Round', 'Rondes'),
  AvatarOption('eye_sport', 'Wayfarers', 'Wayfarer'),
  AvatarOption('eye_sunglasses', 'Sunglasses', 'Lunettes de soleil'),
];

const avatarKitColorOptions = [
  AvatarOption('red', 'Red', 'Rouge', '#dc2626'),
  AvatarOption('orange', 'Orange', 'Orange', '#f2552c'),
  AvatarOption('gold', 'Gold', 'Or', '#f5b301'),
  AvatarOption('green', 'Green', 'Vert', '#109c4e'),
  AvatarOption('teal', 'Teal', 'Bleu canard', '#0d9488'),
  AvatarOption('sky', 'Sky', 'Ciel', '#0ea5e9'),
  AvatarOption('blue', 'Blue', 'Bleu', '#2563eb'),
  AvatarOption('navy', 'Navy', 'Marine', '#1e3a8a'),
  AvatarOption('purple', 'Purple', 'Violet', '#7c3aed'),
  AvatarOption('pink', 'Pink', 'Rose', '#ec4899'),
  AvatarOption('maroon', 'Maroon', 'Bordeaux', '#7f1d1d'),
  AvatarOption('black', 'Black', 'Noir', '#1d1f2b'),
  AvatarOption('white', 'White', 'Blanc', '#f6f5f0'),
  AvatarOption('grey', 'Grey', 'Gris', '#8d929b'),
];
