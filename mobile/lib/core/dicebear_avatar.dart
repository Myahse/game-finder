import 'avatar_presets.dart';

/// Matches web `avatarDicebearApiUrl` for the same player config.
String dicebearAvatarUrl(AvatarConfigV2 config, {int size = 256}) {
  final skin = _hex(skinFaceColors[config.skin] ?? skinFaceColors['s2']!);
  final clothes = _hex(jerseyFillColors[config.color] ?? jerseyFillColors['j1']!);
  final top = _top(config);
  final clothing = _clothing(config.outfit);
  final scale = 88 + (config.body == 'b0' ? 0 : config.body == 'b2' ? 8 : 4) + _sizeIndex(config.size) * 3;
  final seed = '${config.skin}${config.body}${config.size}${config.hair}${config.accessory}${config.outfit}${config.color}';
  final q = <String>[
    'seed=${Uri.encodeComponent(seed)}',
    'skinColor=$skin',
    'clothesColor=$clothes',
    'top=$top',
    'clothing=$clothing',
    'scale=$scale',
    'backgroundColor=e8eef4',
    'eyes=default',
    'mouth=smile',
  ];
  final acc = _accessory(config);
  if (acc != null) q.add('accessories=$acc');
  if (config.outfit == 'o0') q.add('clothingGraphic=diamond');
  return 'https://api.dicebear.com/9.x/avataaars/svg?${q.join('&')}';
}

int _sizeIndex(String size) => const ['z0', 'z1', 'z2', 'z3'].indexOf(size).clamp(0, 3);

String _hex(int color) => (color & 0xFFFFFF).toRadixString(16).padLeft(6, '0');

String _top(AvatarConfigV2 c) {
  if (c.accessory == 'a1') return 'hat';
  switch (c.hair) {
    case 'h0':
      return 'shavedSides';
    case 'h1':
      return 'shortFlat';
    case 'h2':
      return 'shortCurly';
    case 'h3':
      return 'shortWaved';
    case 'h4':
      return 'fro';
    case 'h5':
      return 'froBand';
    default:
      return 'shortFlat';
  }
}

String _clothing(String outfit) {
  switch (outfit) {
    case 'o1':
      return 'shirtScoopNeck';
    case 'o2':
      return 'hoodie';
    case 'o3':
      return 'collarAndSweater';
    default:
      return 'graphicShirt';
  }
}

String? _accessory(AvatarConfigV2 c) {
  switch (c.accessory) {
    case 'a3':
      return 'sunglasses';
    case 'a4':
      return 'kurt';
    default:
      return null;
  }
}
