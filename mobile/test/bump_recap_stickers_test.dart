import 'package:find_the_game/core/api.dart';
import 'package:find_the_game/core/api_errors.dart';
import 'package:find_the_game/core/auth.dart';
import 'package:find_the_game/core/avatar_presets.dart';
import 'package:find_the_game/core/bump.dart';
import 'package:find_the_game/core/dicebear_avatar.dart';
import 'package:find_the_game/core/format.dart';
import 'package:find_the_game/core/l10n.dart';
import 'package:find_the_game/core/location.dart';
import 'package:find_the_game/core/models.dart';
import 'package:find_the_game/core/player_avatar.dart';
import 'package:find_the_game/core/recap.dart';
import 'package:find_the_game/core/stickers.dart';
import 'package:find_the_game/screens/bump_connect.dart';
import 'package:find_the_game/screens/recap_sheet.dart';
import 'package:find_the_game/screens/sticker_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

Map<String, dynamic> user(String id, String username) =>
    {'id': id, 'username': username, 'first_name': username, 'last_name': '', 'created_at': '2026-01-01T00:00:00Z'};

Map<String, dynamic> recapJson({String month = '2026-10', int games = 12}) => {
      'month': month,
      'games': games,
      'hours': 14.5,
      'courts': 3,
      'check_ins': 5,
      'showed_up': 10,
      'show_up_pct': games == 0 ? null : 83,
      'games_created': 2,
      'top_court': games == 0 ? null : {'id': 'k1', 'name': 'Terrain IUGB', 'visits': 7},
      'top_teammate': games == 0 ? null : {'user': user('u2', 'ama'), 'games': 6},
    };

const webAvatar = {
  'version': 1,
  'bodyType': 'athletic',
  'height': 1.8,
  'skinTone': 'skin_06',
  'eyes': 'eyes_03',
  'eyebrows': 'brow_thin',
  'mouth': 'mouth_smile',
  'hair': 'hair_afro',
  'hairColor': 'dark_brown',
  'facialHair': 'beard_short',
  'top': 'top_basketball_jersey',
  'headwear': null,
  'eyewear': 'eye_sunglasses',
  'sport': 'basketball',
};

/// Records requests; recap GETs answer per month, bump POSTs follow [bumpReplies].
class FakeApi extends Api {
  final requests = <String>[];
  final List<Map<String, dynamic>> bumpReplies;
  FakeApi({this.bumpReplies = const []});
  var _bump = 0;

  @override
  Future<dynamic> get(String path) async {
    requests.add('GET $path');
    final month = Uri.parse(path).queryParameters['month']!;
    return recapJson(month: month, games: month == '2026-10' ? 12 : 0);
  }

  @override
  Future<dynamic> post(String path, [Object? body]) async {
    requests.add('POST $path');
    final r = bumpReplies[_bump.clamp(0, bumpReplies.length - 1)];
    _bump++;
    return r;
  }

  @override
  Future<dynamic> delete(String path, [Object? body]) async {
    requests.add('DELETE $path');
    return null;
  }
}

class FakeLocation extends LocationState {
  final LatLng? fix;
  FakeLocation(this.fix);
  @override
  Future<LatLng?> freshFix({Duration timeout = const Duration(seconds: 10)}) async => fix;
}

Widget bumpApp(FakeApi api, LocationState loc) => MultiProvider(
      providers: [
        ChangeNotifierProvider<Api>.value(value: api),
        ChangeNotifierProvider<LocationState>.value(value: loc),
        ChangeNotifierProvider(create: (_) => AuthState(api)),
      ],
      child: const MaterialApp(home: BumpConnectScreen()),
    );

void main() {
  group('bump', () {
    test('parses waiting and matched replies', () {
      expect(BumpResult.fromJson({'status': 'waiting'}).matched, isFalse);
      final m = BumpResult.fromJson({'status': 'matched', 'already_friends': true, 'friend': user('u2', 'ama')});
      expect(m.matched, isTrue);
      expect(m.alreadyFriends, isTrue);
      expect(m.friend!.username, 'ama');
      // A "matched" without a friend can't be shown — treat it as still waiting.
      expect(BumpResult.fromJson({'status': 'matched'}).matched, isFalse);
    });

    test('countdown rounds up and stops at zero', () {
      final now = DateTime(2026, 10, 7, 12);
      expect(bumpSecondsLeft(now.add(const Duration(milliseconds: 14100)), now), 15);
      expect(bumpSecondsLeft(now.add(const Duration(milliseconds: 1)), now), 1);
      expect(bumpSecondsLeft(now.subtract(const Duration(seconds: 1)), now), 0);
    });

    testWidgets('polls until matched, then shows the friend', (tester) async {
      final api = FakeApi(bumpReplies: [
        {'status': 'waiting'},
        {'status': 'matched', 'friend': user('u2', 'ama')},
      ]);
      await tester.pumpWidget(bumpApp(api, FakeLocation(const LatLng(5.2, -3.7))));
      await tester.pump();
      expect(find.textContaining('Looking for 1 player'), findsOneWidget);
      await tester.pump(bumpPollEvery);
      await tester.pump();
      expect(find.text('CONNECTED!'), findsOneWidget);
      expect(find.text('You and @ama are now friends.'), findsOneWidget);
      expect(api.requests, ['POST /api/me/bump', 'POST /api/me/bump']);
      // Matched: closing doesn't cancel on the server.
      await tester.pumpWidget(const SizedBox());
      expect(api.requests.where((r) => r.startsWith('DELETE')), isEmpty);
    });

    testWidgets('gives up after the window and cancels', (tester) async {
      final api = FakeApi(bumpReplies: [
        {'status': 'waiting'},
      ]);
      await tester.pumpWidget(bumpApp(api, FakeLocation(const LatLng(5.2, -3.7))));
      for (var i = 0; i < 16; i++) {
        await tester.pump(bumpPollEvery);
      }
      expect(find.text('NO ONE FOUND'), findsOneWidget);
      expect(find.text('TRY AGAIN'), findsOneWidget);
      expect(api.requests.last, 'DELETE /api/me/bump');
    });

    testWidgets('asks for location when there is no fix', (tester) async {
      final api = FakeApi();
      await tester.pumpWidget(bumpApp(api, FakeLocation(null)));
      await tester.pump();
      expect(find.text("COULDN'T CONNECT"), findsOneWidget);
      expect(find.textContaining('Turn on location'), findsOneWidget);
      expect(api.requests, isEmpty);
    });
  });

  group('recap', () {
    test('parses a month', () {
      final r = MonthlyRecap.fromJson(recapJson());
      expect(r.games, 12);
      expect(r.hoursLabel, '14.5');
      expect(r.showUpLabel, '83%');
      expect(r.topCourt!.name, 'Terrain IUGB');
      expect(r.topTeammate!.user.username, 'ama');
      expect(r.topTeammate!.games, 6);
      final empty = MonthlyRecap.fromJson({...recapJson(games: 0), 'hours': 0});
      expect(empty.isEmpty, isTrue);
      expect(empty.hoursLabel, '0');
      expect(empty.showUpLabel, '—');
      expect(empty.topCourt, isNull);
      expect(empty.topTeammate, isNull);
    });

    test('month keys and labels', () {
      expect(monthKey(DateTime.utc(2026, 3, 9)), '2026-03');
      expect(shiftMonth('2026-01', -1), '2025-12');
      expect(shiftMonth('2025-12', 1), '2026-01');
      expect(shiftMonth('2026-10', -13), '2025-09');
      expect(monthLabel('2026-10', french: false), 'October 2026');
      expect(monthLabel('2026-08', french: true), 'août 2026');
    });

    testWidgets('sheet shows the story, navigates months and the empty state', (tester) async {
      tester.view.physicalSize = const Size(400 * 3, 1000 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final api = FakeApi();
      final me = Me.fromJson({...user('u1', 'kofi'), 'email': 'k@x.com', 'role': 'user', 'onboarded': true});
      await tester.pumpWidget(ChangeNotifierProvider<Api>.value(
        value: api,
        child: MaterialApp(home: Scaffold(body: RecapSheet(me: me, sport: 'football'))),
      ));
      await tester.pumpAndSettle();
      final current = monthKey(DateTime.now());
      expect(api.requests.first, 'GET /api/me/recap?month=$current');
      expect(find.byType(RecapStory), findsOneWidget);
      // Can't go past the current month.
      final next = tester.widget<IconButton>(find.widgetWithIcon(IconButton, Icons.chevron_right));
      expect(next.onPressed, isNull);

      await tester.tap(find.widgetWithIcon(IconButton, Icons.chevron_left));
      await tester.pumpAndSettle();
      expect(api.requests.last, 'GET /api/me/recap?month=${shiftMonth(current, -1)}');
    });

    testWidgets('story lays out without overflow', (tester) async {
      final me = PublicUser.fromJson(user('u1', 'a_very_long_username_here'));
      for (final r in [MonthlyRecap.fromJson(recapJson()), MonthlyRecap.fromJson(recapJson(games: 0))]) {
        await tester.pumpWidget(MaterialApp(
          home: Center(child: FittedBox(child: RecapStory(recap: r, me: me, monthLabel: 'September 2026', sport: 'tennis'))),
        ));
        expect(tester.takeException(), isNull);
      }
      expect(find.text('@a_very_long_username_here'), findsOneWidget);
      expect(find.text('MY MONTH ON FIND THE GAME'), findsNothing);
      expect(find.text('My month on Find the Game'), findsOneWidget);
    });
  });

  group('stickers and avatar art', () {
    test('sticker set has a sport cheer, in both languages', () {
      final en = stickerSet('football', french: false);
      expect(en, hasLength(8));
      expect(en.map((s) => s.id).toSet(), hasLength(8));
      expect(en.firstWhere((s) => s.id == 'cheer').caption, 'GOAL!');
      expect(stickerSet('football', french: true).firstWhere((s) => s.id == 'cheer').caption, 'BUT !');
      expect(stickerSet(null, french: false).firstWhere((s) => s.id == 'cheer').caption, "LET'S GO!");
      expect(stickerSet('tennis', french: true).firstWhere((s) => s.id == 'whos-in').caption, 'QUI JOUE ?');
    });

    testWidgets('sticker art lays out every caption', (tester) async {
      final art = AvatarArt(player: PlayerAvatar.fromJson(webAvatar));
      for (final spec in stickerSet('basketball', french: true)) {
        await tester.pumpWidget(MaterialApp(home: Center(child: StickerArt(art: art, spec: spec))));
        expect(find.text(spec.caption), findsNWidgets(3)); // white stroke, ink stroke, fill
        expect(find.text('23'), findsNWidgets(2)); // jersey number: stroke + fill
        expect(tester.getSize(find.byType(StickerArt)), const Size(256, 256));
      }
    });

    test('web studio avatar maps onto DiceBear parts', () {
      final a = PlayerAvatar.fromJson(webAvatar)!;
      final url = Uri.parse(playerAvatarPngUrl(a, expression: const AvatarExpression(mouth: 'screamOpen')));
      expect(url.path, '/9.x/avataaars/png');
      final q = url.queryParameters;
      expect(q['top'], 'fro');
      expect(q['eyes'], 'happy');
      expect(q['eyebrows'], 'raisedExcitedNatural');
      expect(q['mouth'], 'screamOpen');
      expect(q['facialHair'], 'beardMedium');
      expect(q['accessories'], 'sunglasses');
      expect(q['clothing'], 'shirtScoopNeck');
      expect(q['clothesColor'], 'f2552c');
      expect(q['skinColor'], '8b5e3c');
      expect(q.containsKey('backgroundColor'), isFalse);
      expect(jerseyNumber(a), '23');
    });

    test('kit colours: sport default, custom kit, light kit accent', () {
      expect(kitOf(const PlayerAvatar(sport: 'football')).main, '#109c4e');
      final custom = kitOf(const PlayerAvatar(kitMain: 'white', kitTrim: 'navy', number: 7));
      expect(custom.main, '#f6f5f0');
      expect(custom.accent, '#1e3a8a'); // white shirt → trim reads on light backgrounds
      expect(custom.number, '7');
      expect(jerseyNumber(const PlayerAvatar(sport: 'tennis', top: 'top_tennis_shirt')), isNull);
    });

    test('player avatar is picked like the web', () {
      expect(PlayerAvatar.fromJson({'version': 2, 'bodyType': 'x', 'skinTone': 'y'}), isNull);
      expect(PlayerAvatar.forUserJson({'player_avatar_public': webAvatar}), isNotNull);
      expect(PlayerAvatar.forUserJson({'player_avatar': webAvatar}), isNull);
      expect(PlayerAvatar.forUserJson({'player_avatar': webAvatar, 'avatar_url': 'avatar:player'}), isNotNull);
      final u = PublicUser.fromJson({...user('u1', 'kofi'), 'player_avatar_public': webAvatar});
      expect(avatarArtOf(u).isEmpty, isFalse);
      expect(avatarArtOf(PublicUser.fromJson(user('u2', 'ama'))).isEmpty, isTrue);
    });

    test('preset avatar URL: png and sticker faces', () {
      final c = defaultConfig('kofi');
      expect(dicebearAvatarUrl(c), contains('/svg?'));
      final png = dicebearAvatarUrl(c, size: 256, format: 'png', expression: const AvatarExpression(eyes: 'wink', eyebrows: 'angryNatural'), transparent: true);
      expect(png, contains('/png?'));
      expect(png, contains('eyes=wink'));
      expect(png, contains('eyebrows=angryNatural'));
      expect(png, isNot(contains('backgroundColor')));
      expect(AvatarArt(preset: c).accentHex, startsWith('#'));
    });
  });

  group('translations', () {
    // Tests run with an English host locale.
    test('labels evaluate at runtime', () {
      expect(skillLabels['all_levels'], 'All levels');
      expect(gameTypeLabels['pickup'], 'Pickup');
      expect(gameStatusLabel('scheduled'), 'UPCOMING');
      expect(maxPlayersSliderLabel(maxPlayersSliderUnlimited), 'Unlimited');
    });

    testWidgets('French device gets French copy and safe dates', (tester) async {
      debugLanguageOverride = 'fr';
      addTearDown(() => debugLanguageOverride = null);
      expect(skillLabels['beginner'], 'Débutant');
      expect(gameStatusLabel('active'), 'EN COURS');
      expect(timeAgo(DateTime(2026, 1, 1, 12), DateTime(2026, 1, 1, 12, 5)), 'il y a 5 minutes');
      expect(apiErrorCopy('game_full', ''), 'Ce match est complet.');
      // No French date symbols loaded in tests: must fall back, not throw.
      expect(localDateFormat('EEE d MMM').format(DateTime(2026, 10, 7)), isNotEmpty);
      expect(stickerSet('basketball').first.caption, 'JE PRENDS LA SUITE');
      final me = PublicUser.fromJson(user('u1', 'kofi'));
      await tester.pumpWidget(MaterialApp(
        home: Center(child: FittedBox(child: RecapStory(recap: MonthlyRecap.fromJson(recapJson()), me: me, monthLabel: monthLabel('2026-10')))),
      ));
      expect(find.text('TERRAIN FÉTICHE'), findsOneWidget);
      expect(find.text('6 matchs ensemble'), findsOneWidget);
      expect(find.text('OCTOBRE 2026'), findsOneWidget);
    });

    test('API errors are worded like the web', () {
      expect(apiErrorCopy('game_full', 'whatever'), 'This game is full.');
      expect(apiErrorCopy('location_required', 'Turn on location to connect.'), 'Turn on location to connect.');
      expect(apiErrorCopy('invalid:month', 'bad'), 'Invalid value.');
      expect(apiErrorCopy('brand_new_code', 'Server says hi.'), 'Server says hi.');
      expect(apiErrorToast('browse_location_mismatch')!.title, 'Map area unavailable');
      expect(errorText(ApiException(400, 'not_allowed', "You can't do that.")), "You can't do that.");
      expect(errorText(StateError('x')), 'Something went wrong.');
    });
  });
}
