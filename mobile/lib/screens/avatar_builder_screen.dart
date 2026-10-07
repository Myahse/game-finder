import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/avatar_presets.dart';
import '../core/guide.dart';
import '../ui/avatar_preset.dart';
import '../ui/screen_guide.dart';
import '../ui/theme.dart';
import '../core/l10n.dart';

class AvatarBuilderScreen extends StatefulWidget {
  const AvatarBuilderScreen({super.key, this.initialUrl, this.initialConfig, this.seed, this.welcome = false});
  final String? initialUrl;

  /// Opened right after sign-up: shows a Skip action that goes on to the map.
  final bool welcome;
  final Map<String, dynamic>? initialConfig;
  final String? seed;

  @override
  State<AvatarBuilderScreen> createState() => _AvatarBuilderScreenState();
}

class _AvatarBuilderScreenState extends State<AvatarBuilderScreen> {
  int _step = 0;
  late AvatarConfigV2 _config = AvatarConfigV2.fromJson(widget.initialConfig) ?? defaultConfig(widget.seed);
  bool _busy = false;
  String? _error;

  static const _stepCount = 7;

  @override
  void initState() {
    super.initState();
    ScreenGuide.maybeShow(context, screen: GuideScreen.avatar, tips: [
      GuideTip(
        icon: const Icon(Icons.person),
        title: tr('This is you on court', 'C’est vous sur le terrain'),
        body: tr(
            'Your player shows up on games, challenges, the court ranking and your stickers. Make it look like you — you can change it anytime.',
            'Votre joueur apparaît sur les matchs, les défis, le classement du terrain et vos stickers. Faites-le à votre image — vous pourrez le changer quand vous voulez.'),
      ),
    ]);
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<AuthState>().updateMe({'avatar_config': _config.toJson()});
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(tr('BUILD PLAYER', 'CRÉER VOTRE JOUEUR')),
        leading: BackButton(onPressed: _step > 0 ? () => setState(() => _step--) : null),
        actions: [
          if (widget.welcome)
            TextButton(
              onPressed: _busy ? null : () => Navigator.pop(context, false),
              child: Text(tr('Skip', 'Passer')),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          LinearProgressIndicator(value: (_step + 1) / _stepCount, color: Palette.brand, backgroundColor: Colors.grey.shade300),
          const SizedBox(height: 16),
          Center(child: AvatarPresetWidget(config: _config, size: 140, headOnly: _step < 6)),
          const SizedBox(height: 20),
          ..._stepBody(),
          if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy
                ? null
                : () {
                    if (_step < _stepCount - 1) {
                      setState(() => _step++);
                    } else {
                      _save();
                    }
                  },
            child: _busy
                ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
                : Text(_step < _stepCount - 1 ? tr('NEXT', 'SUIVANT') : tr('SAVE PLAYER', 'ENREGISTRER')),
          ),
        ],
      ),
    );
  }

  List<Widget> _stepBody() {
    switch (_step) {
      case 0:
        return [_label(tr('BODY TYPE', 'MORPHOLOGIE')), _chips(avatarBodyLabels.keys.toList(), _config.body, (v) => setState(() => _config = AvatarConfigV2(skin: _config.skin, body: v, size: _config.size, hair: _config.hair, accessory: _config.accessory, outfit: _config.outfit, color: _config.color, useAsProfile: _config.useAsProfile)), labels: avatarBodyLabels)];
      case 1:
        return [_label(tr('SIZE', 'TAILLE')), _chips(avatarSizeLabels.keys.toList(), _config.size, (v) => setState(() => _config = AvatarConfigV2(skin: _config.skin, body: _config.body, size: v, hair: _config.hair, accessory: _config.accessory, outfit: _config.outfit, color: _config.color, useAsProfile: _config.useAsProfile)), labels: avatarSizeLabels)];
      case 2:
        return [_label(tr('SKIN', 'TEINT')), _skinRow()];
      case 3:
        return [_label(tr('HAIR', 'COIFFURE')), _chips(avatarHairLabels.keys.toList(), _config.hair, (v) => setState(() => _config = AvatarConfigV2(skin: _config.skin, body: _config.body, size: _config.size, hair: v, accessory: _config.accessory, outfit: _config.outfit, color: _config.color, useAsProfile: _config.useAsProfile)), labels: avatarHairLabels)];
      case 4:
        return [_label(tr('ACCESSORY', 'ACCESSOIRES')), _chips(_accessoryLabels.keys.toList(), _config.accessory, (v) => setState(() => _config = AvatarConfigV2(skin: _config.skin, body: _config.body, size: _config.size, hair: _config.hair, accessory: v, outfit: _config.outfit, color: _config.color, useAsProfile: _config.useAsProfile)), labels: _accessoryLabels)];
      case 5:
        return [
          _label(tr('CLOTHES', 'TENUE')),
          _chips(_outfitLabels.keys.toList(), _config.outfit, (v) => setState(() => _config = AvatarConfigV2(skin: _config.skin, body: _config.body, size: _config.size, hair: _config.hair, accessory: _config.accessory, outfit: v, color: _config.color, useAsProfile: _config.useAsProfile)), labels: _outfitLabels),
          _label(tr('COLOR', 'COULEUR')),
          _colorRow(),
        ];
      default:
        return [
          SwitchListTile(
            title: Text(tr('Use as my profile picture', 'Utiliser comme photo de profil')),
            subtitle: Text(tr('Shows on your profile and in games', 'Visible sur votre profil et dans les matchs')),
            value: _config.useAsProfile,
            onChanged: (v) => setState(() => _config = AvatarConfigV2(skin: _config.skin, body: _config.body, size: _config.size, hair: _config.hair, accessory: _config.accessory, outfit: _config.outfit, color: _config.color, useAsProfile: v)),
          ),
        ];
    }
  }

  Widget _label(String t) => Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(t, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800)));

  Widget _skinRow() => Wrap(
        spacing: 8,
        children: skinFaceColors.entries.map((e) {
          final on = _config.skin == e.key;
          return GestureDetector(
            onTap: () => setState(() => _config = AvatarConfigV2(skin: e.key, body: _config.body, size: _config.size, hair: _config.hair, accessory: _config.accessory, outfit: _config.outfit, color: _config.color, useAsProfile: _config.useAsProfile)),
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: Color(e.value), shape: BoxShape.circle, border: Border.all(color: on ? Palette.brand : Colors.grey, width: on ? 3 : 1)),
            ),
          );
        }).toList(),
      );

  Widget _colorRow() => Wrap(
        spacing: 8,
        children: jerseyFillColors.entries.map((e) {
          final on = _config.color == e.key;
          return GestureDetector(
            onTap: () => setState(() => _config = AvatarConfigV2(skin: _config.skin, body: _config.body, size: _config.size, hair: _config.hair, accessory: _config.accessory, outfit: _config.outfit, color: e.key, useAsProfile: _config.useAsProfile)),
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: Color(e.value), shape: BoxShape.circle, border: Border.all(color: on ? Palette.brand : Colors.grey, width: on ? 3 : 1)),
            ),
          );
        }).toList(),
      );

  Widget _chips(List<String> ids, String selected, ValueChanged<String> onSelect, {Map<String, String>? labels}) => Wrap(
        spacing: 8,
        runSpacing: 8,
        children: ids.map((id) {
          final on = selected == id;
          return ChoiceChip(
            label: Text(labels?[id] ?? id),
            selected: on,
            onSelected: (_) {
              onSelect(id);
              setState(() {});
            },
          );
        }).toList(),
      );
}

// Chip labels (same names as the web's avatarPresets.ts). Body type and size
// only change how close the DiceBear portrait is framed.
Map<String, String> get avatarBodyLabels => {
      'b0': tr('Lean', 'Fin'),
      'b1': tr('Athletic', 'Athlétique'),
      'b2': tr('Solid', 'Costaud'),
    };
Map<String, String> get avatarSizeLabels => const {'z0': 'S', 'z1': 'M', 'z2': 'L', 'z3': 'XL'};
Map<String, String> get avatarHairLabels => {
      'h0': tr('Shaved', 'Rasé'),
      'h1': tr('Crop', 'Court'),
      'h2': tr('Curls', 'Boucles'),
      'h3': tr('Waves', 'Ondulés'),
      'h4': tr('Afro', 'Afro'),
      'h5': tr('Afro + band', 'Afro + bandeau'),
    };

Map<String, String> get _accessoryLabels => {
      'a0': tr('None', 'Aucun'),
      'a1': tr('Cap', 'Casquette'),
      'a2': tr('Headband', 'Bandeau'),
      'a3': tr('Shades', 'Lunettes'),
      'a4': tr('Wristbands', 'Poignets'),
    };
Map<String, String> get _outfitLabels => {
      'o0': tr('Jersey', 'Maillot'),
      'o1': tr('Tank', 'Débardeur'),
      'o2': tr('Hoodie', 'Sweat'),
      'o3': tr('Polo', 'Polo'),
    };
