import 'package:find_the_game/core/api.dart';
import 'package:find_the_game/core/auth.dart';
import 'package:find_the_game/core/l10n.dart';
import 'package:find_the_game/core/notification_links.dart';
import 'package:find_the_game/core/player_card.dart';
import 'package:find_the_game/screens/notification_routes.dart';
import 'package:find_the_game/screens/player_card_sheet.dart';
import 'package:find_the_game/screens/profile_screen.dart';
import 'package:find_the_game/ui/player_card_art.dart';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

Map<String, dynamic> sportJson(String slug, String name) => {'id': 's-$slug', 'name': name, 'slug': slug, 'icon': slug, 'active': true};

Map<String, dynamic> userJson({String id = 'u1', String username = 'ama.k', String first = 'Ama', String last = 'Kouamé'}) => {
  'id': id,
  'username': username,
  'first_name': first,
  'last_name': last,
  'created_at': '2026-01-01T00:00:00Z',
};

Map<String, dynamic> cardJson({Map<String, dynamic>? user, String sport = 'basketball', String tier = 'feu'}) => {
  'user': user ?? userJson(),
  'serial': 42,
  'sport': sport == 'football' ? sportJson('football', 'Foot') : sportJson('basketball', 'Basket'),
  'sports': [sportJson('basketball', 'Basket'), sportJson('football', 'Foot')],
  'elo': 1480,
  'elo_delta_30d': 64,
  'rated_games': 30,
  'rating': 87,
  'tier': tier,
  'level': 12,
  'games': 42,
  'wins': 29,
  'losses': 13,
  'win_pct': 69,
  'win_streak': 7,
  'challenges_won': 12,
  'challenges_lost': 3,
  'courts': 9,
  'badges': 3,
  'mvps': 4,
  'points_total': 552,
  'points_per_game': 18.4,
  'best_points': 34,
  'home_court': {'id': 'c1', 'name': 'Terrain IUGB, Grand-Bassam'},
  'king_of': {'id': 'c1', 'name': 'Terrain IUGB, Grand-Bassam'},
};

/// Long names everywhere, no avatar, nothing optional.
Map<String, dynamic> longCardJson() => {
  ...cardJson(
    user: userJson(username: 'a_very_long_username_for_a_card', first: 'Maximilienne-Éléonore', last: 'Kouassi-N’Guessan de la Fontaine'),
  ),
  'home_court': {'id': 'c9', 'name': 'Terrain municipal du Plateau, avenue Chardy, Abidjan, Côte d’Ivoire'},
  'king_of': null,
  'elo': 2150,
  'rating': 99,
  'games': 1234,
  'wins': 1000,
  'losses': 234,
  'serial': 123456,
};

class FakeApi extends Api {
  final Map<String, dynamic> Function(String path) card;
  final List<String> calls = [];
  FakeApi(this.card, {bool signedIn = true}) {
    if (signedIn) {
      session = Session('t', 'r', DateTime.now().add(const Duration(hours: 1)), {
        ...userJson(id: 'me', username: 'viewer'),
        'email': 'v@x.io',
        'onboarded': true,
      });
    }
  }

  @override
  Future<dynamic> request(String method, String path, {Object? body, bool retry = true}) async {
    calls.add('$method $path');
    if (method == 'GET' && RegExp(r'^/api/users/[^/]+/card').hasMatch(path)) return card(path);
    if (path == '/api/sports') return [sportJson('basketball', 'Basket')];
    if (path.startsWith('/api/users/')) return userJson(id: 'u2', username: 'other');
    return null;
  }
}

Widget host(FakeApi api, Widget child) => MultiProvider(
  providers: [
    ChangeNotifierProvider<Api>.value(value: api),
    ChangeNotifierProvider(create: (_) => AuthState(api)),
  ],
  child: MaterialApp(home: child),
);

void setPhone(WidgetTester tester, double width, {double height = 800}) {
  tester.view.physicalSize = Size(width * 3, height * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
}

void main() {
  setUpAll(() {
    debugLanguageOverride = 'en';
    dotenv.testLoad(fileInput: 'WEB_APP_URL=https://outforground.test/');
  });
  tearDownAll(() => debugLanguageOverride = null);

  group('parsing', () {
    test('reads the API card', () {
      final c = PlayerCard.fromJson(cardJson(), legalName: true);
      expect(c.user.username, 'ama.k');
      expect(c.displayName, 'Ama Kouamé');
      // Other players' cards show the @username, like the rest of the app.
      expect(PlayerCard.fromJson(cardJson()).displayName, 'ama.k');
      expect(c.serial, 42);
      expect(c.serialLabel, 'N° 0042');
      expect(c.sport!.slug, 'basketball');
      expect(c.sports.map((s) => s.slug), ['basketball', 'football']);
      expect(c.elo, 1480);
      expect(c.eloDelta30d, 64);
      expect(c.eloDeltaLabel, 'ELO +64');
      expect(c.rating, 87);
      expect(c.tier, CardTier.feu);
      expect((c.games, c.wins, c.losses, c.winPct, c.winStreak), (42, 29, 13, 69, 7));
      expect((c.challengesWon, c.challengesLost, c.courts, c.badges, c.mvps), (12, 3, 9, 3, 4));
      expect((c.pointsTotal, c.pointsPerGame, c.bestPoints), (552, 18.4, 34));
      expect(c.homeCourt!.name, 'Terrain IUGB, Grand-Bassam');
      expect(c.kingOf!.id, 'c1');
    });

    test('tolerates missing and null fields', () {
      final empty = PlayerCard.fromJson({});
      expect(empty.user.id, '');
      expect(empty.sport, isNull);
      expect(empty.sports, isEmpty);
      expect(empty.elo, 1000);
      expect(empty.rating, 48); // new player: the spec's 48
      expect(empty.tier, CardTier.bronze);
      expect(empty.serialLabel, 'N° —');
      expect(empty.homeCourt, isNull);
      expect(empty.eloDeltaLabel, 'ELO');

      final partial = PlayerCard.fromJson({
        'user': {'username': 'kofi', 'first_name': null},
        'sport': {'slug': 'tennis'},
        'sports': [
          null,
          'x',
          {'name': 'no slug'},
        ],
        'elo': 1650,
        'games': 10,
        'wins': 4,
        'rating': null,
        'tier': 'diamond',
        'serial': 12345,
        'home_court': {'id': 'c', 'name': '  '},
        'king_of': 'nope',
        'points_per_game': '7.5',
        'elo_delta_30d': -12,
      });
      expect(partial.displayName, 'kofi');
      expect(partial.sport!.name, 'tennis');
      expect(partial.sports.map((s) => s.slug), ['tennis']);
      expect(partial.tier, CardTier.feu); // unknown name → from the Elo
      expect(partial.losses, 6);
      expect(partial.winPct, 40);
      expect(partial.rating, cardRating(elo: 1650, games: 10, winRate: 0.4));
      expect(partial.serialLabel, 'N° 12345');
      expect(partial.homeCourt, isNull);
      expect(partial.kingOf, isNull);
      expect(partial.pointsPerGame, 7.5);
      expect(partial.eloDeltaLabel, 'ELO −12');
    });

    test('rating formula matches the spec', () {
      expect(cardRating(elo: 1000), 48);
      expect(cardRating(elo: 1480, games: 42, winRate: 0.69, winStreak: 7), 89);
      expect(cardRating(elo: 600), 40);
      expect(cardRating(elo: 2400, games: 99, winRate: 1, winStreak: 9), 99);
    });

    test('fetch hits /api/users/{id}/card with the sport', () async {
      final api = FakeApi((_) => cardJson(), signedIn: false);
      await fetchPlayerCard(api, 'me');
      await fetchPlayerCard(api, 'u 1', sport: 'football');
      expect(api.calls, ['GET /api/users/me/card', 'GET /api/users/u%201/card?sport=football']);
    });
  });

  group('tiers', () {
    test('from Elo', () {
      expect(cardTierForElo(1000), CardTier.bronze);
      expect(cardTierForElo(1199), CardTier.bronze);
      expect(cardTierForElo(1200), CardTier.argent);
      expect(cardTierForElo(1399), CardTier.argent);
      expect(cardTierForElo(1400), CardTier.or);
      expect(cardTierForElo(1599), CardTier.or);
      expect(cardTierForElo(1600), CardTier.feu);
      expect(cardTierFromName('or'), CardTier.or);
      expect(cardTierFromName(null), isNull);
    });

    test('colours', () {
      expect(CardTier.bronze.color, const Color(0xFFCD7F4B));
      expect(CardTier.argent.color, const Color(0xFFC9CED6));
      expect(CardTier.or.color, const Color(0xFFF2B632));
      expect(CardTier.feu.color, const Color(0xFFFF5A1F));
    });

    test('labels follow the viewer language', () {
      expect([for (final t in CardTier.values) t.label], ['BRONZE', 'SILVER', 'GOLD', 'FIRE']);
      debugLanguageOverride = 'fr';
      addTearDown(() => debugLanguageOverride = 'en');
      expect([for (final t in CardTier.values) t.label], ['BRONZE', 'ARGENT', 'OR', 'FEU']);
    });
  });

  group('card art', () {
    testWidgets('every style and tier lays out, long names included', (tester) async {
      for (final lang in ['en', 'fr']) {
        debugLanguageOverride = lang;
        for (final json in [cardJson(), longCardJson(), <String, dynamic>{}]) {
          for (final tier in CardTier.values) {
            final card = PlayerCard.fromJson({...json, 'tier': tier.name});
            for (final style in CardStyle.values) {
              await tester.pumpWidget(
                MaterialApp(
                  home: Center(
                    child: FittedBox(
                      child: PlayerCardArt(card: card, style: style, profileUrl: 'https://outforground.test/u/ama.k'),
                    ),
                  ),
                ),
              );
              expect(tester.takeException(), isNull, reason: '$lang $style $tier');
              expect(tester.getSize(find.byType(PlayerCardArt)), const Size(kCardArtWidth, kCardArtHeight));
            }
          }
        }
      }
      debugLanguageOverride = 'en';
    });

    testWidgets('shows the design copy and data', (tester) async {
      final card = PlayerCard.fromJson(cardJson(), legalName: true);
      Future<void> pump(CardStyle style) => tester.pumpWidget(
        MaterialApp(
          home: Center(
            child: FittedBox(
              child: PlayerCardArt(card: card, style: style, profileUrl: 'https://outforground.test/u/ama.k'),
            ),
          ),
        ),
      );
      await pump(CardStyle.card);
      expect(find.text('AMA KOUAMÉ'), findsOneWidget);
      expect(find.text('87'), findsOneWidget);
      expect(find.text('N° 0042'), findsOneWidget);
      expect(find.text('FIRE · SEASON 1'), findsOneWidget);

      await pump(CardStyle.scoreboard);
      expect(find.text('KING OF THE COURT'), findsOneWidget);
      expect(find.text('Who wants to beat me? outforground.com'), findsOneWidget);
      expect(find.text('ELO +64'), findsOneWidget);

      await pump(CardStyle.pass);
      expect(find.text('outforground.test/u/ama.k'), findsOneWidget);
      expect(find.text('PASS FIRE'), findsOneWidget);
    });
  });

  group('sheet', () {
    for (final width in [375.0, 430.0]) {
      testWidgets('renders each style without overflow at $width', (tester) async {
        setPhone(tester, width, height: width == 375 ? 667 : 932);
        final api = FakeApi((path) => path.contains('sport=football') ? cardJson(sport: 'football', tier: 'or') : longCardJson());
        await tester.pumpWidget(host(api, const Scaffold(body: PlayerCardSheet(userId: 'me', own: true))));
        await tester.pumpAndSettle();
        expect(api.calls.where((c) => c.contains('/card')), ['GET /api/users/me/card']);
        expect(find.text('MY CARD'), findsOneWidget);
        // Sport switcher: the card has two sports.
        expect(find.widgetWithText(ChoiceChip, 'Foot'), findsOneWidget);
        for (final style in CardStyle.values) {
          await tester.tap(find.widgetWithText(ChoiceChip, style.label));
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull, reason: '$style');
          expect(tester.widget<PlayerCardArt>(find.byType(PlayerCardArt)).style, style);
        }
        final share = tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'SHARE'));
        expect(share.onPressed, isNotNull);
        expect(find.widgetWithText(OutlinedButton, 'DOWNLOAD'), findsOneWidget);

        await tester.ensureVisible(find.widgetWithText(ChoiceChip, 'Foot'));
        await tester.tap(find.widgetWithText(ChoiceChip, 'Foot'));
        await tester.pumpAndSettle();
        expect(api.calls.last, 'GET /api/users/me/card?sport=football');
        expect(tester.widget<PlayerCardArt>(find.byType(PlayerCardArt)).card.tier, CardTier.or);
        expect(tester.takeException(), isNull);
      });
    }

    testWidgets('French copy, one sport → no sport switcher', (tester) async {
      setPhone(tester, 375, height: 667);
      debugLanguageOverride = 'fr';
      addTearDown(() => debugLanguageOverride = 'en');
      final api = FakeApi(
        (_) => {
          ...cardJson(),
          'sports': [sportJson('basketball', 'Basket')],
        },
      );
      await tester.pumpWidget(host(api, const Scaffold(body: PlayerCardSheet(userId: 'u2'))));
      await tester.pumpAndSettle();
      expect(find.text('@ama.k'), findsOneWidget);
      expect(find.widgetWithText(ChoiceChip, 'Affiche'), findsOneWidget);
      expect(find.widgetWithText(ChoiceChip, 'Basket'), findsNothing);
      expect(find.text('PARTAGER'), findsOneWidget);
      expect(find.text('TÉLÉCHARGER'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('load error offers a retry', (tester) async {
      var fail = true;
      final api = FakeApi((_) => fail ? throw ApiException(404, 'user_not_found', '') : cardJson());
      await tester.pumpWidget(host(api, const Scaffold(body: PlayerCardSheet(userId: 'gone'))));
      await tester.pumpAndSettle();
      expect(find.text('Could not load the card.'), findsOneWidget);
      fail = false;
      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();
      expect(find.byType(PlayerCardArt), findsOneWidget);
    });
  });

  group('entry points', () {
    test('card_tier notifications target the own card', () {
      expect(
        notificationTarget('achievement', {'kind': 'card_tier', 'tier': 'or', 'sport': 'basketball'}),
        const NotificationTarget(NotificationDest.card, 'basketball'),
      );
      expect(notificationTarget('system', {'kind': 'card_tier'}), const NotificationTarget(NotificationDest.card));
      expect(
        targetFromPayload(pushPayload({'type': 'achievement', 'kind': 'card_tier', 'sport': 'football'})),
        const NotificationTarget(NotificationDest.card, 'football'),
      );
    });

    testWidgets('tapping a card_tier notification opens the card sheet', (tester) async {
      setPhone(tester, 375, height: 667);
      final api = FakeApi((_) => cardJson(tier: 'or'));
      await tester.pumpWidget(
        host(
          api,
          Scaffold(
            body: Builder(
              builder: (context) => TextButton(
                onPressed: () => openNotificationTarget(
                  context,
                  notificationTarget('achievement', {'kind': 'card_tier', 'tier': 'or', 'sport': 'basketball'}),
                ),
                child: const Text('open'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(find.byType(PlayerCardSheet), findsOneWidget);
      expect(find.text('MY CARD'), findsOneWidget);
      expect(api.calls.last, 'GET /api/users/me/card?sport=basketball');
      expect(find.byType(PlayerCardArt), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('own profile: My card opens the own card', (tester) async {
      SharedPreferences.setMockInitialValues({});
      setPhone(tester, 375, height: 2400);
      final api = FakeApi((_) => cardJson());
      await tester.pumpWidget(host(api, const ProfileScreen()));
      await tester.pumpAndSettle();
      final button = find.widgetWithText(FilledButton, 'MY CARD');
      expect(button, findsOneWidget);
      await tester.tap(button);
      await tester.pumpAndSettle();
      expect(api.calls.where((c) => c.contains('/card')).last, 'GET /api/users/me/card');
      expect(find.byType(PlayerCardSheet), findsOneWidget);
    });

    testWidgets('own profile has My card; other players have View card', (tester) async {
      SharedPreferences.setMockInitialValues({});
      setPhone(tester, 375, height: 2400);
      final api = FakeApi((_) => cardJson());
      await tester.pumpWidget(host(api, const UserScreen(userId: 'u2')));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(OutlinedButton, 'VIEW CARD'), findsOneWidget);
      await tester.tap(find.widgetWithText(OutlinedButton, 'VIEW CARD'));
      await tester.pumpAndSettle();
      expect(api.calls.where((c) => c.contains('/card')).last, 'GET /api/users/u2/card');
      expect(find.byType(PlayerCardSheet), findsOneWidget);
    });
  });
}
