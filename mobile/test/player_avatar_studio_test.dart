import 'dart:convert';
import 'dart:math';

import 'package:find_the_game/core/api.dart';
import 'package:find_the_game/core/auth.dart';
import 'package:find_the_game/core/l10n.dart';
import 'package:find_the_game/core/player_avatar.dart';
import 'package:find_the_game/core/player_avatar_config.dart';
import 'package:find_the_game/screens/avatar_builder_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

/// Keys the web's AvatarStudio PUTs for a default player (no optional extras).
const webRequiredKeys = [
  'version', 'bodyType', 'height', 'skinTone', 'face', 'eyes', 'eyebrows', 'nose', 'mouth', 'hair', 'hairColor', //
  'facialHair', 'top', 'bottom', 'shoes', 'headwear', 'eyewear', 'accessory', 'sport', 'sportsEquipment', 'pose',
  'useAsProfile',
];

/// Round-trips through JSON text like the HTTP body, then validates like the backend.
List<String> backendErrors(PlayerAvatarConfig c) =>
    playerAvatarErrors(Map<String, dynamic>.from(jsonDecode(jsonEncode(c.toJson())) as Map));

class StudioApi extends Api {
  StudioApi({this.saved, this.failGet = false}) {
    session = Session('a', 'r', DateTime.utc(2030), {'id': 'u1', 'username': 'nia', 'first_name': 'Nia', 'last_name': '', 'created_at': '2020-01-01T00:00:00Z'});
  }
  final Map<String, dynamic>? saved;
  final bool failGet;
  final requests = <String>[];
  Object? putBody;

  @override
  Future<void> setSession(Session? s) async {
    session = s;
    notifyListeners();
  }

  @override
  Future<dynamic> get(String path) async {
    requests.add('GET $path');
    if (path == '/api/me/avatar') {
      if (failGet) throw ApiException(500, 'server_error', 'boom');
      return {'config': saved};
    }
    if (path == '/api/me') {
      return {...session!.user, 'avatar_url': 'avatar:player', 'player_avatar': putBody};
    }
    return {};
  }

  @override
  Future<dynamic> put(String path, Object body) async {
    requests.add('PUT $path');
    putBody = jsonDecode(jsonEncode(body));
    return {'config': putBody, 'useAsProfile': true};
  }
}

void main() {
  group('player avatar config', () {
    test('default per sport is the reference player dressed for it, and saves', () {
      for (final s in avatarSports) {
        final c = defaultPlayerConfig(s);
        expect(c.sport, s);
        expect(c.top, sportKit(s).top);
        expect(c.bottom, sportKit(s).bottom);
        expect(c.shoes, sportKit(s).shoes);
        expect(c.sportsEquipment, sportKit(s).equipment);
        expect(c.hair, 'hair_crop');
        expect(backendErrors(c), isEmpty, reason: s);
      }
      expect(defaultPlayerConfig('padel').sport, 'basketball');
      expect(defaultPlayerConfig(null).sport, 'basketball');
    });

    test('payload has exactly the web keys (optionals only when set)', () {
      final j = defaultPlayerConfig('football').toJson();
      expect(j.keys.toList(), webRequiredKeys);
      expect(j['version'], 1);
      expect(j['headwear'], isNull);
      expect(j.containsKey('headwear'), isTrue);
      final b = playerPresetConfig('badminton').toJson();
      expect(b['kitMain'], 'pink');
      expect(b['kitTrim'], 'white');
      expect(b['number'], 21);
      expect(b['details'], ['dimples']);
      expect(b['eyewear'], 'eye_glasses');
    });

    test('JSON round trip keeps every field', () {
      for (final p in avatarPresetInfos) {
        final c = playerPresetConfig(p.id);
        final back = PlayerAvatarConfig.fromJson(jsonDecode(jsonEncode(c.toJson())));
        expect(back, isNotNull);
        expect(back!.toJson(), c.toJson(), reason: p.id);
        expect(back, c);
      }
    });

    test('parse follows the web rule and repairs values the backend would reject', () {
      expect(PlayerAvatarConfig.fromJson(null), isNull);
      expect(PlayerAvatarConfig.fromJson({'version': 2, 'bodyType': 'slim', 'skinTone': 'skin_01'}), isNull);
      expect(PlayerAvatarConfig.fromJson({'version': 1, 'skinTone': 'skin_01'}), isNull);
      final c = PlayerAvatarConfig.fromJson({
        'version': 1,
        'bodyType': 'slim',
        'skinTone': 'skin_99',
        'hair': 'hair_box_braids', // legacy id, still valid
        'mouth': 'mouth_relaxed',
        'height': 3,
        'headwear': '',
        'eyewear': 'eye_monocle',
        'details': ['freckles', 'freckles', 'tattoo_face'],
        'kitMain': '#ff0000',
        'number': 120,
        'useAsProfile': true,
      })!;
      expect(c.bodyType, 'slim');
      expect(c.skinTone, 'skin_05');
      expect(c.hair, 'hair_box_braids');
      expect(c.mouth, 'mouth_relaxed');
      expect(c.height, 2.25);
      expect(c.headwear, isNull);
      expect(c.eyewear, isNull);
      expect(c.details, ['freckles']);
      expect(c.kitMain, isNull);
      expect(c.number, 99);
      expect(c.useAsProfile, isTrue);
      expect(backendErrors(c), isEmpty);
    });

    test('backend validator port rejects what the Go one rejects', () {
      final ok = defaultPlayerConfig().toJson();
      expect(playerAvatarErrors(ok), isEmpty);
      expect(playerAvatarErrors({...ok, 'facialHair': 'none'}), ['facialHair']);
      expect(playerAvatarErrors({...ok, 'height': 1.2}), ['height']);
      expect(playerAvatarErrors({...ok, 'kitMain': '#fff'}), ['kitMain']);
      expect(playerAvatarErrors({...ok, 'number': 100}), ['number']);
      expect(playerAvatarErrors({...ok, 'details': ['freckles', 'freckles']}), ['details']);
      expect(playerAvatarErrors({...ok, 'version': 2}), ['version']);
    });

    test('every studio option is an id the backend allows', () {
      bool all(List<AvatarOption> l, Set<String> allowed) => l.every((o) => allowed.contains(o.id));
      expect(all(avatarSkinOptions, allowedSkinTones), isTrue);
      expect(all(avatarEyesOptions, allowedEyes), isTrue);
      expect(all(avatarBrowOptions, allowedEyebrows), isTrue);
      expect(all(avatarMouthOptions, allowedMouths), isTrue);
      expect(all(avatarBeardOptions, allowedFacialHairs), isTrue);
      expect(all(avatarHairOptions, allowedHairs), isTrue);
      expect(all(avatarHairColorOptions, allowedHairColors), isTrue);
      expect(all(avatarSportOptions, allowedSports), isTrue);
      expect(all(avatarTopOptions, allowedTops), isTrue);
      expect(all(avatarHeadwearOptions, allowedHeadwear), isTrue);
      expect(all(avatarEyewearOptions, allowedEyewear), isTrue);
      expect(all(avatarKitColorOptions, allowedKitColors), isTrue);
      expect(avatarPortraitSportOptions.map((s) => s.id), ['basketball', 'football', 'tennis', 'badminton', 'volleyball']);
      expect(avatarPortraitTopOptions.length, 5);
    });

    test('every studio choice, preset and random player saves', () {
      final base = defaultPlayerConfig();
      for (final o in avatarHairOptions) {
        expect(backendErrors(base.withValue('hair', o.id)), isEmpty);
      }
      for (final o in avatarPortraitSportOptions) {
        final c = base.withValue('sport', o.id);
        expect(c.top, sportKit(o.id).top);
        expect(backendErrors(c), isEmpty);
      }
      expect(base.withValue('headwear', 'head_cap').withValue('headwear', null).headwear, isNull);
      for (final p in avatarPresetInfos) {
        expect(backendErrors(playerPresetConfig(p.id)), isEmpty, reason: p.id);
      }
      final r = Random(7);
      for (var i = 0; i < 300; i++) {
        final c = randomPlayerConfig(base: base.copyWith(useAsProfile: false), random: r);
        expect(backendErrors(c), isEmpty);
        expect(c.useAsProfile, isFalse);
      }
    });

    test('renders through the Avataaars mapping', () {
      final c = playerPresetConfig('badminton');
      final a = c.toPlayerAvatar();
      expect(kitOf(a).main, '#ec4899');
      expect(jerseyNumber(a), '21');
      final url = Uri.parse(playerAvatarPngUrl(a));
      expect(url.queryParameters['top'], 'bun');
      expect(url.queryParameters['accessories'], 'prescription02');
      expect(Uri.parse(playerAvatarPngUrl(defaultPlayerConfig().toPlayerAvatar())).queryParameters['facialHairProbability'], '0');
    });
  });

  group('avatar studio screen', () {
    Future<StudioApi> pump(WidgetTester t, {Map<String, dynamic>? saved, bool welcome = false, bool failGet = false}) async {
      final api = StudioApi(saved: saved, failGet: failGet);
      await t.binding.setSurfaceSize(const Size(420, 1400));
      addTearDown(() => t.binding.setSurfaceSize(null));
      await t.pumpWidget(MultiProvider(
        providers: [
          ChangeNotifierProvider<Api>.value(value: api),
          ChangeNotifierProvider(create: (_) => AuthState(api)),
        ],
        child: MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: Center(
                child: TextButton(
                  onPressed: () async {
                    final ok = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => AvatarBuilderScreen(welcome: welcome)));
                    if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('result $ok')));
                  },
                  child: const Text('open'),
                ),
              ),
            ),
          ),
        ),
      ));
      await t.tap(find.text('open'));
      await t.pumpAndSettle();
      return api;
    }

    testWidgets('loads the saved avatar, edits it and saves the web payload', (t) async {
      final saved = playerPresetConfig('footballer').toJson();
      final api = await pump(t, saved: saved);
      expect(api.requests.first, 'GET /api/me/avatar');
      expect(find.text('Your player'), findsOneWidget);
      expect(find.text('Skip'), findsNothing);
      expect(find.text('Start from'.toUpperCase()), findsOneWidget);

      await t.tap(find.text('Hair'));
      await t.pumpAndSettle();
      await t.ensureVisible(find.text('Bun'));
      await t.tap(find.text('Bun'));
      await t.pumpAndSettle();

      await t.tap(find.byKey(const Key('avatar-save')));
      await t.pumpAndSettle();
      expect(api.requests, containsAllInOrder(['PUT /api/me/avatar', 'GET /api/me']));
      final body = api.putBody as Map<String, dynamic>;
      expect(body, {...saved, 'hair': 'hair_bun'});
      expect(playerAvatarErrors(body), isEmpty);
      expect(find.text('result true'), findsOneWidget);
      // AuthState now carries the new avatar for profile / stickers / recap.
      final auth = t.element(find.text('open')).read<AuthState>();
      expect(auth.user?.playerAvatar?.hair, 'hair_bun');
    });

    testWidgets('new player starts from the default; kit number and sport colours', (t) async {
      final api = await pump(t, welcome: true);
      expect(find.text('Skip'), findsOneWidget);
      await t.tap(find.text('Kit'));
      await t.pumpAndSettle();
      await t.tap(find.text('Colours'));
      await t.pumpAndSettle();
      await t.enterText(find.byKey(const Key('avatar-number')), '8');
      await t.tap(find.byTooltip('Navy').first);
      await t.pumpAndSettle();
      expect(find.text('Use sport colours'), findsOneWidget);
      await t.ensureVisible(find.text('Save player'));
      await t.tap(find.text('Save player'));
      await t.pumpAndSettle();
      final body = api.putBody as Map<String, dynamic>;
      expect(body['number'], 8);
      expect(body['kitMain'], 'navy');
      expect(body['sport'], 'basketball');
      expect(body['hair'], 'hair_crop');
      expect(playerAvatarErrors(body), isEmpty);
    });

    testWidgets('skip in welcome mode returns false without saving', (t) async {
      final api = await pump(t, welcome: true);
      await t.tap(find.text('Skip'));
      await t.pumpAndSettle();
      expect(api.requests.where((r) => r.startsWith('PUT')), isEmpty);
      expect(find.text('result false'), findsOneWidget);
    });

    testWidgets('French labels', (t) async {
      debugLanguageOverride = 'fr';
      addTearDown(() => debugLanguageOverride = null);
      await pump(t);
      expect(find.text('Votre joueur'), findsOneWidget);
      expect(find.text('Visage'), findsOneWidget);
      expect(find.text('Utiliser comme photo de profil'), findsOneWidget);
      expect(find.text('Le Basketteur'), findsOneWidget);
    });
  });
}
