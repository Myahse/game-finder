const avatarPresetV2Prefix = 'preset:v2.';

class AvatarConfigV2 {
  AvatarConfigV2({
    required this.skin,
    required this.body,
    required this.size,
    required this.hair,
    required this.accessory,
    required this.outfit,
    required this.color,
    this.useAsProfile = true,
  });

  final String skin, body, size, hair, accessory, outfit, color;
  final bool useAsProfile;

  Map<String, dynamic> toJson() => {
        'v': 2,
        'skin': skin,
        'body': body,
        'size': size,
        'hair': hair,
        'accessory': accessory,
        'outfit': outfit,
        'color': color,
        'use_as_profile': useAsProfile,
      };

  static AvatarConfigV2? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    if (raw['v'] != 2) return null;
    final c = AvatarConfigV2(
      skin: raw['skin'] as String,
      body: raw['body'] as String,
      size: raw['size'] as String,
      hair: raw['hair'] as String,
      accessory: raw['accessory'] as String,
      outfit: raw['outfit'] as String,
      color: raw['color'] as String,
      useAsProfile: raw['use_as_profile'] == true,
    );
    return validConfig(c) ? c : null;
  }
}

const _skins = ['s0', 's1', 's2', 's3', 's4', 's5'];
const _bodies = ['b0', 'b1', 'b2'];
const _sizes = ['z0', 'z1', 'z2', 'z3'];
const _hairs = ['h0', 'h1', 'h2', 'h3', 'h4', 'h5'];
const _accessories = ['a0', 'a1', 'a2', 'a3', 'a4'];
const _outfits = ['o0', 'o1', 'o2', 'o3'];
const _colors = ['j0', 'j1', 'j2', 'j3', 'j4', 'j5', 'j6', 'j7'];

bool validConfig(AvatarConfigV2 c) =>
    _skins.contains(c.skin) &&
    _bodies.contains(c.body) &&
    _sizes.contains(c.size) &&
    _hairs.contains(c.hair) &&
    _accessories.contains(c.accessory) &&
    _outfits.contains(c.outfit) &&
    _colors.contains(c.color);

bool isPresetAvatar(String? url) {
  final t = url?.trim() ?? '';
  return t.startsWith('preset:v1.') || t.startsWith(avatarPresetV2Prefix);
}

bool isUploadedAvatar(String? url) {
  final t = url?.trim();
  return t != null && t.isNotEmpty && !isPresetAvatar(t);
}

bool hasSavedAvatar({String? avatarUrl, Map<String, dynamic>? avatarConfig}) {
  if (AvatarConfigV2.fromJson(avatarConfig) != null) return true;
  return isUploadedAvatar(avatarUrl) || isPresetAvatar(avatarUrl);
}

AvatarConfigV2? profileAvatarConfig({String? avatarUrl, Map<String, dynamic>? avatarConfig}) {
  final cfg = AvatarConfigV2.fromJson(avatarConfig);
  if (cfg != null && cfg.useAsProfile) return cfg;
  if (isPresetAvatar(avatarUrl) && !isUploadedAvatar(avatarUrl)) {
    return defaultConfig();
  }
  return null;
}

AvatarConfigV2 defaultConfig([String? seed]) {
  final base = (seed ?? 'player').codeUnits.fold<int>(0, (n, c) => n + c);
  return AvatarConfigV2(
    skin: _skins[base % _skins.length],
    body: _bodies[(base >> 2) % _bodies.length],
    size: _sizes[(base >> 4) % _sizes.length],
    hair: _hairs[(base >> 3) % _hairs.length],
    accessory: 'a0',
    outfit: 'o0',
    color: _colors[(base >> 5) % _colors.length],
  );
}

const skinFaceColors = {
  's0': 0xFFFDEBD0,
  's1': 0xFFF5D0A9,
  's2': 0xFFE0AC69,
  's3': 0xFFC68642,
  's4': 0xFF8D5524,
  's5': 0xFF5C3317,
};

const jerseyFillColors = {
  'j0': 0xFF16A34A,
  'j1': 0xFF2563EB,
  'j2': 0xFFDC2626,
  'j3': 0xFFCA8A04,
  'j4': 0xFF9333EA,
  'j5': 0xFF0D9488,
  'j6': 0xFFEA580C,
  'j7': 0xFF171717,
};
