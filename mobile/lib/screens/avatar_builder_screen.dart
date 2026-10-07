// Player avatar studio — port of the web's AvatarStudioPage + AvatarStudio
// (web/src/routes/AvatarStudioPage.tsx, web/src/avatar/studio/AvatarStudio.tsx).
// Loads GET /api/me/avatar (else the default player for the main sport) and
// saves with PUT /api/me/avatar, then reloads /api/me.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/guide.dart';
import '../core/l10n.dart';
import '../core/models.dart';
import '../core/my_sport.dart';
import '../core/player_avatar.dart';
import '../core/player_avatar_config.dart';
import '../ui/player_portrait.dart';
import '../ui/screen_guide.dart';
import '../ui/theme.dart';

class AvatarBuilderScreen extends StatefulWidget {
  const AvatarBuilderScreen({
    super.key,
    this.initialUrl,
    this.initialConfig,
    this.seed,
    this.welcome = false,
    this.initialPlayerConfig,
  });

  /// Legacy (preset avatar) parameters, kept for existing callers; the studio
  /// edits the player avatar from GET /api/me/avatar instead.
  final String? initialUrl;
  final Map<String, dynamic>? initialConfig;
  final String? seed;

  /// Opened right after sign-up: shows a Skip action that goes on to the map.
  final bool welcome;

  /// Start from this config instead of loading the saved one (tests, previews).
  final PlayerAvatarConfig? initialPlayerConfig;

  @override
  State<AvatarBuilderScreen> createState() => _AvatarBuilderScreenState();
}

enum _Kind { options, skin, hairColor, kitColors }

class _Part {
  final String id;
  final String Function() label;
  final _Kind kind;
  final String field;
  final List<AvatarOption> options;
  final bool nullable;
  const _Part(this.id, this.label, this.kind, {this.field = '', this.options = const [], this.nullable = false});
}

class _Group {
  final String id;
  final String Function() label;
  final IconData icon;
  final List<_Part> parts;
  const _Group(this.id, this.label, this.icon, this.parts);
}

/// Same groups and parts as the web studio.
final _groups = [
  _Group('face', () => tr('Face', 'Visage'), Icons.sentiment_satisfied_alt, [
    _Part('skin', () => tr('Skin', 'Teint'), _Kind.skin),
    _Part('eyes', () => tr('Eyes', 'Yeux'), _Kind.options, field: 'eyes', options: avatarEyesOptions),
    _Part('brows', () => tr('Brows', 'Sourcils'), _Kind.options, field: 'eyebrows', options: avatarBrowOptions),
    _Part('mouth', () => tr('Mouth', 'Bouche'), _Kind.options, field: 'mouth', options: avatarMouthOptions),
    _Part('beard', () => tr('Beard', 'Barbe'), _Kind.options, field: 'facialHair', options: avatarBeardOptions),
  ]),
  _Group('hair', () => tr('Hair', 'Cheveux'), Icons.content_cut, [
    _Part('style', () => tr('Style', 'Coupe'), _Kind.options, field: 'hair', options: avatarHairOptions),
    _Part('color', () => tr('Colour', 'Couleur'), _Kind.hairColor),
  ]),
  _Group('kit', () => tr('Kit', 'Tenue'), Icons.checkroom, [
    _Part('sport', () => tr('Sport', 'Sport'), _Kind.options, field: 'sport', options: avatarPortraitSportOptions),
    _Part('colours', () => tr('Colours', 'Couleurs'), _Kind.kitColors),
    _Part('top', () => tr('Top', 'Haut'), _Kind.options, field: 'top', options: avatarPortraitTopOptions),
  ]),
  _Group('extras', () => tr('Extras', 'Extras'), Icons.visibility_outlined, [
    _Part('headwear', () => tr('Headwear', 'Couvre-chef'), _Kind.options, field: 'headwear', options: avatarHeadwearOptions, nullable: true),
    _Part('eyewear', () => tr('Eyewear', 'Lunettes'), _Kind.options, field: 'eyewear', options: avatarEyewearOptions, nullable: true),
  ]),
];

class _AvatarBuilderScreenState extends State<AvatarBuilderScreen> {
  PlayerAvatarConfig? _initial;
  PlayerAvatarConfig? _config;
  String _groupId = _groups.first.id;
  final _partByGroup = <String, String>{};
  bool _saving = false;
  String? _error;
  final _number = TextEditingController();

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
    _load();
  }

  @override
  void dispose() {
    _number.dispose();
    super.dispose();
  }

  /// The saved avatar, else the default player dressed for the main sport (web AvatarStudioPage).
  Future<void> _load() async {
    var start = widget.initialPlayerConfig;
    if (start == null) {
      final api = context.read<Api>();
      final me = context.read<AuthState>().user;
      try {
        final j = await api.get('/api/me/avatar');
        start = PlayerAvatarConfig.fromJson(j is Map ? j['config'] : null);
      } catch (_) {
        // Offline: never start from the default over a saved look we know about.
        start = PlayerAvatarConfig.fromJson(api.session?.user['player_avatar']);
      }
      start ??= defaultPlayerConfig(await _mySport(api, me));
    }
    if (!mounted) return;
    setState(() {
      _initial = start;
      _set(start!);
    });
  }

  Future<String?> _mySport(Api api, Me? me) async {
    if (me?.preferredSportId == null) return null;
    if (knownSports.value.isEmpty) {
      try {
        final j = await api.get('/api/sports');
        rememberSports([for (final x in j as List) Sport.fromJson(Map<String, dynamic>.from(x as Map))]);
      } catch (_) {}
    }
    return sportSlugForUser(me, knownSports.value);
  }

  /// Applies [c]; keeps the number field in step unless the change came from it.
  void _set(PlayerAvatarConfig c, {bool fromNumberField = false}) {
    _config = c;
    if (!fromNumberField) {
      final text = c.number?.toString() ?? '';
      if (_number.text != text) _number.text = text;
    }
  }

  void _update(PlayerAvatarConfig c) => setState(() => _set(c));

  Future<void> _save() async {
    final config = _config;
    if (config == null || _saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    final api = context.read<Api>();
    final auth = context.read<AuthState>();
    try {
      await api.put('/api/me/avatar', config.toJson());
      // Profile, stickers and recap read the avatar from /api/me.
      await auth.refreshMe();
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _error = e is ApiException ? errorText(e) : tr('Could not save your avatar.', 'Impossible d\'enregistrer votre avatar.'));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final config = _config;
    return Scaffold(
      appBar: AppBar(
        title: Text(tr('Your player', 'Votre joueur')),
        actions: [
          if (widget.welcome)
            TextButton(
              onPressed: _saving ? null : () => Navigator.pop(context, false),
              child: Text(tr('Skip', 'Passer')),
            ),
          if (config != null)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: FilledButton(
                key: const Key('avatar-save'),
                onPressed: _saving ? null : _save,
                style: FilledButton.styleFrom(minimumSize: const Size(0, 40), padding: const EdgeInsets.symmetric(horizontal: 16)),
                child: _saving
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : Text(tr('Save', 'Enregistrer')),
              ),
            ),
        ],
      ),
      body: config == null
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              top: false,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                children: [
                  _preview(config),
                  const SizedBox(height: 16),
                  _caption(tr('Start from', 'Partir de')),
                  _presets(config),
                  const SizedBox(height: 20),
                  _tabs(),
                  ..._partBody(config),
                  const SizedBox(height: 24),
                  _useAsProfile(config),
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                    ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _saving ? null : _save,
                    child: _saving
                        ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
                        : Text(tr('Save player', 'Enregistrer')),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _caption(String t) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(t.toUpperCase(),
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 0.4, color: Theme.of(context).colorScheme.onSurfaceVariant)),
      );

  // --- Preview -------------------------------------------------------------

  Widget _preview(PlayerAvatarConfig config) {
    final scheme = Theme.of(context).colorScheme;
    final accent = colorFromHex(kitOf(config.toPlayerAvatar()).accent);
    final maxH = MediaQuery.sizeOf(context).height * 0.42;
    return LayoutBuilder(builder: (context, c) {
      final side = c.maxWidth < maxH ? c.maxWidth : maxH;
      return Center(
        child: Container(
          width: c.maxWidth,
          height: side,
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: scheme.outlineVariant),
            gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [scheme.surfaceContainerHighest, scheme.surface]),
          ),
          child: Stack(children: [
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: const Alignment(0, 1),
                    radius: 1.1,
                    colors: [accent.withValues(alpha: 0.22), accent.withValues(alpha: 0)],
                  ),
                ),
              ),
            ),
            Positioned(
              left: side * 0.08,
              right: side * 0.08,
              top: side * 0.06,
              bottom: 0,
              child: PlayerAvatarPortrait(key: const Key('avatar-preview'), avatar: config.toPlayerAvatar()),
            ),
            Positioned(
              top: 12,
              right: 12,
              child: Row(children: [
                _roundButton(Icons.casino_outlined, tr('Randomize', 'Aléatoire'), () => _update(randomPlayerConfig(base: _config))),
                const SizedBox(width: 8),
                _roundButton(Icons.undo, tr('Undo changes', 'Annuler les changements'), () => _update(_initial!)),
              ]),
            ),
          ]),
        ),
      );
    });
  }

  Widget _roundButton(IconData icon, String label, VoidCallback onTap) {
    final scheme = Theme.of(context).colorScheme;
    return Tooltip(
      message: label,
      child: Material(
        color: scheme.surface.withValues(alpha: 0.9),
        shape: const CircleBorder(),
        elevation: 1,
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: Semantics(
            button: true,
            label: label,
            child: SizedBox(width: 44, height: 44, child: Icon(icon, size: 22)),
          ),
        ),
      ),
    );
  }

  Widget _presets(PlayerAvatarConfig config) {
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: avatarPresetInfos.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final p = avatarPresetInfos[i];
          final preset = playerPresetConfig(p.id).copyWith(useAsProfile: config.useAsProfile);
          return Material(
            color: scheme.surface,
            shape: StadiumBorder(side: BorderSide(color: scheme.outlineVariant)),
            child: InkWell(
              customBorder: const StadiumBorder(),
              onTap: () => _update(preset),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(4, 4, 12, 4),
                child: Row(children: [
                  ClipOval(
                    child: SizedBox(
                      width: 34,
                      height: 34,
                      child: ColoredBox(color: scheme.surfaceContainerHighest, child: PlayerAvatarPortrait(avatar: preset.toPlayerAvatar(), pixels: 96, spinner: false)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(p.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                ]),
              ),
            ),
          );
        },
      ),
    );
  }

  // --- Editor --------------------------------------------------------------

  _Group get _group => _groups.firstWhere((g) => g.id == _groupId, orElse: () => _groups.first);
  _Part get _part => _group.parts.firstWhere((p) => p.id == _partByGroup[_group.id], orElse: () => _group.parts.first);

  Widget _tabs() {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: scheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(16)),
      child: Row(children: [
        for (final g in _groups)
          Expanded(
            child: Semantics(
              selected: g.id == _groupId,
              button: true,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => setState(() => _groupId = g.id),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: g.id == _groupId ? scheme.surface : Colors.transparent,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: g.id == _groupId ? [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 4, offset: const Offset(0, 1))] : null,
                  ),
                  child: Column(children: [
                    Icon(g.icon, size: 20, color: g.id == _groupId ? Palette.brand : scheme.onSurfaceVariant),
                    const SizedBox(height: 2),
                    Text(
                      g.label(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: g.id == _groupId ? Palette.brand : scheme.onSurfaceVariant),
                    ),
                  ]),
                ),
              ),
            ),
          ),
      ]),
    );
  }

  List<Widget> _partBody(PlayerAvatarConfig config) {
    final group = _group;
    final part = _part;
    return [
      if (group.parts.length > 1) ...[
        const SizedBox(height: 12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(children: [
            for (final p in group.parts)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(p.label()),
                  selected: p.id == part.id,
                  showCheckmark: false,
                  onSelected: (_) => setState(() => _partByGroup[group.id] = p.id),
                ),
              ),
          ]),
        ),
      ],
      const SizedBox(height: 16),
      switch (part.kind) {
        _Kind.skin => _swatches(avatarSkinOptions, config.skinTone, (id) => _update(_config!.copyWith(skinTone: id))),
        _Kind.hairColor => _swatches(avatarHairColorOptions, config.hairColor, (id) => _update(_config!.copyWith(hairColor: id))),
        _Kind.kitColors => _kitColors(config),
        _Kind.options => _optionGrid(part, config),
      },
    ];
  }

  Widget _optionGrid(_Part part, PlayerAvatarConfig config) {
    final scheme = Theme.of(context).colorScheme;
    final items = <(String?, String)>[
      if (part.nullable) (null, tr('None', 'Aucun')),
      for (final o in part.options) (o.id, o.name),
    ];
    final current = config.valueOf(part.field);
    return GridView.count(
      crossAxisCount: 4,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 0.7,
      children: [
        for (final (id, name) in items)
          Builder(builder: (context) {
            final selected = current == id;
            final preview = config.withValue(part.field, id);
            return Semantics(
              selected: selected,
              button: true,
              label: name,
              excludeSemantics: true,
              child: InkWell(
                borderRadius: BorderRadius.circular(16),
                onTap: () => _update(_config!.withValue(part.field, id)),
                child: Container(
                  padding: const EdgeInsets.fromLTRB(6, 6, 6, 8),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    color: selected ? Palette.brand.withValues(alpha: 0.1) : scheme.surfaceContainerHighest,
                    border: Border.all(color: selected ? Palette.brand : Colors.transparent, width: 2),
                  ),
                  child: Stack(children: [
                    Column(children: [
                      AspectRatio(
                        aspectRatio: 1,
                        child: ClipOval(
                          child: ColoredBox(color: scheme.surface, child: PlayerAvatarPortrait(avatar: preview.toPlayerAvatar(), pixels: 128, spinner: false)),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Expanded(
                        child: Text(
                          name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 11, height: 1.15, fontWeight: FontWeight.w600, color: selected ? scheme.onSurface : scheme.onSurfaceVariant),
                        ),
                      ),
                    ]),
                    if (selected) const Positioned(top: 0, right: 0, child: _CheckBadge()),
                  ]),
                ),
              ),
            );
          }),
      ],
    );
  }

  Widget _swatches(List<AvatarOption> options, String? selectedId, ValueChanged<String> onPick, {bool small = false, String? effectiveHex}) {
    final scheme = Theme.of(context).colorScheme;
    final d = small ? 36.0 : 48.0;
    return Wrap(
      spacing: small ? 10 : 12,
      runSpacing: small ? 10 : 12,
      children: [
        for (final o in options)
          Builder(builder: (context) {
            final selected = selectedId != null ? selectedId == o.id : o.hex!.toLowerCase() == effectiveHex?.toLowerCase();
            return Tooltip(
              message: o.name,
              child: Semantics(
                button: true,
                selected: selected,
                label: o.name,
                child: GestureDetector(
                  onTap: () => onPick(o.id),
                  child: AnimatedScale(
                    scale: selected ? 1.1 : 1,
                    duration: const Duration(milliseconds: 120),
                    child: SizedBox(
                      width: d + 4,
                      height: d + 4,
                      child: Stack(clipBehavior: Clip.none, children: [
                        Container(
                          width: d,
                          height: d,
                          margin: const EdgeInsets.all(2),
                          decoration: BoxDecoration(
                            color: colorFromHex(o.hex!),
                            shape: BoxShape.circle,
                            border: Border.all(color: selected ? Palette.brand : scheme.outlineVariant, width: 2),
                          ),
                        ),
                        if (selected) const Positioned(top: -2, right: -2, child: _CheckBadge()),
                      ]),
                    ),
                  ),
                ),
              ),
            );
          }),
      ],
    );
  }

  Widget _kitColors(PlayerAvatarConfig config) {
    final scheme = Theme.of(context).colorScheme;
    final kit = kitOf(config.toPlayerAvatar());
    final custom = config.kitMain != null || config.kitTrim != null;
    Widget row(String label, String? value, String effective, void Function(String) onPick) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [_caption(label), _swatches(avatarKitColorOptions, value, onPick, small: true, effectiveHex: effective)],
        );
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: scheme.outlineVariant), color: scheme.surface),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        row(tr('Main colour', 'Couleur principale'), config.kitMain, kit.main, (id) => _update(_config!.copyWith(kitMain: id))),
        const SizedBox(height: 16),
        row(tr('Trim', 'Liseré'), config.kitTrim, kit.trim, (id) => _update(_config!.copyWith(kitTrim: id))),
        const SizedBox(height: 16),
        _caption(tr('Number', 'Numéro')),
        Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 8, runSpacing: 8, children: [
          SizedBox(
            width: 84,
            child: TextField(
              key: const Key('avatar-number'),
              controller: _number,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(2)],
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
              decoration: InputDecoration(hintText: kit.number.isEmpty ? '–' : kit.number, isDense: true),
              onChanged: (raw) {
                final n = int.tryParse(raw);
                setState(() => _set(_config!.copyWith(number: n?.clamp(0, 99)), fromNumberField: true));
              },
            ),
          ),
          if (config.number != null) TextButton(onPressed: () => _update(_config!.copyWith(number: null)), child: Text(tr('Auto', 'Auto'))),
          if (custom)
            OutlinedButton(
              onPressed: () => _update(_config!.copyWith(kitMain: null, kitTrim: null)),
              child: Text(tr('Use sport colours', 'Couleurs du sport')),
            ),
        ]),
      ]),
    );
  }

  Widget _useAsProfile(PlayerAvatarConfig config) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: scheme.outlineVariant)),
      clipBehavior: Clip.antiAlias,
      child: CheckboxListTile(
        controlAffinity: ListTileControlAffinity.leading,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        activeColor: Palette.brand,
        value: config.useAsProfile,
        onChanged: (v) => _update(_config!.copyWith(useAsProfile: v ?? false)),
        title: Text(tr('Use as my profile picture', 'Utiliser comme photo de profil'), style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(tr(
          'Shows on your profile and next to your name in games. You can turn this off and keep your photo instead.',
          'Visible sur votre profil et dans les matchs. Vous pouvez le désactiver et garder votre photo.',
        )),
      ),
    );
  }
}

class _CheckBadge extends StatelessWidget {
  const _CheckBadge();

  @override
  Widget build(BuildContext context) => Container(
        width: 20,
        height: 20,
        decoration: const BoxDecoration(color: Palette.brand, shape: BoxShape.circle),
        child: const Icon(Icons.check, size: 13, color: Colors.white),
      );
}
