import 'package:find_the_game/core/api.dart';
import 'package:find_the_game/core/avatar_presets.dart';
import 'package:find_the_game/core/l10n.dart';
import 'package:find_the_game/core/models.dart';
import 'package:find_the_game/core/my_sport.dart';
import 'package:find_the_game/core/player_avatar.dart';
import 'package:find_the_game/core/realtime.dart';
import 'package:find_the_game/core/stickers.dart';
import 'package:find_the_game/core/player_avatar_config.dart';
import 'package:find_the_game/screens/sticker_sheet.dart';
import 'package:find_the_game/ui/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Sport sport(String id, String slug) => Sport.fromJson({'id': id, 'name': slug, 'slug': slug, 'icon': slug, 'active': true});

Me me({String? main, List<String> extra = const [], String role = 'user'}) => Me.fromJson({
      'id': 'u1',
      'username': 'nia',
      'first_name': 'Nia',
      'last_name': '',
      'created_at': '2026-01-01T00:00:00Z',
      'role': role,
      'preferred_sport_id': main,
      'extra_sport_ids': extra,
    });

/// ws-ticket always fails (offline / signed out on the server).
class TicketFailApi extends Api {
  int tickets = 0;
  @override
  Future<dynamic> post(String path, [Object? body]) async {
    tickets++;
    throw ApiException(401, 'unauthorized', 'nope');
  }
}

void main() {
  testWidgets('floatingNavListPadding = content padding + nav clearance + safe area', (tester) async {
    late EdgeInsets p;
    await tester.pumpWidget(MediaQuery(
      data: const MediaQueryData(viewPadding: EdgeInsets.only(bottom: 34), padding: EdgeInsets.only(bottom: 34)),
      child: Builder(builder: (context) {
        p = floatingNavListPadding(context);
        return const SizedBox();
      }),
    ));
    expect(p.left, 16);
    expect(p.top, 16);
    expect(p.bottom, 16 + kFloatingNavClearance + 34);

    // Body of a Scaffold(extendBody: true): padding already holds the bar's height.
    await tester.pumpWidget(MediaQuery(
      data: const MediaQueryData(viewPadding: EdgeInsets.only(bottom: 34), padding: EdgeInsets.only(bottom: 140)),
      child: Builder(builder: (context) {
        p = floatingNavListPadding(context);
        return const SizedBox();
      }),
    ));
    expect(p.bottom, 16 + 140);
  });

  group('avatar studio labels', () {
    test('no raw ids, bilingual', () {
      for (final l in [avatarEyesOptions, avatarBrowOptions, avatarMouthOptions, avatarBeardOptions, avatarHairOptions, avatarHeadwearOptions, avatarEyewearOptions]) {
        expect(l.where((o) => o.name == o.id), isEmpty);
      }
      expect(avatarHairOptions.firstWhere((o) => o.id == 'hair_puff').name, 'Afro + band');
      debugLanguageOverride = 'fr';
      addTearDown(() => debugLanguageOverride = null);
      expect(avatarHairOptions.firstWhere((o) => o.id == 'hair_puff').name, 'Afro + bandeau');
      expect(avatarPresetInfos.first.name, 'Le Basketteur');
    });
  });

  group('stickers', () {
    testWidgets('a failed sticker keeps the others and can be retried; fetches run in parallel', (tester) async {
      final art = AvatarArt(preset: defaultConfig('kofi'));
      final specs = stickerSet('basketball');
      final badUrl = art.pngUrl(expression: specs.first.expression)!;
      final expectedFailed = specs.where((s) => art.pngUrl(expression: s.expression) == badUrl).length;
      var fail = true;
      var inFlight = 0, maxInFlight = 0;
      debugStickerPrecache = (url) async {
        inFlight++;
        if (inFlight > maxInFlight) maxInFlight = inFlight;
        await Future<void>.delayed(const Duration(milliseconds: 50));
        inFlight--;
        return !(fail && url == badUrl);
      };
      addTearDown(() => debugStickerPrecache = null);

      await tester.pumpWidget(MaterialApp(
        home: Builder(builder: (context) => TextButton(onPressed: () => showStickerSheet(context, art: art, sport: 'basketball'), child: const Text('open'))),
      ));
      await tester.tap(find.text('open'));
      for (var i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 60));
      }

      expect(maxInFlight, greaterThan(1));
      expect(maxInFlight, lessThanOrEqualTo(3));
      expect(find.byType(StickerArt), findsNWidgets(specs.length - expectedFailed));
      expect(find.byIcon(Icons.refresh), findsNWidgets(expectedFailed));
      expect(find.text('Could not create the stickers.'), findsNothing);

      fail = false;
      await tester.tap(find.byIcon(Icons.refresh).first);
      for (var i = 0; i < 4; i++) {
        await tester.pump(const Duration(milliseconds: 60));
      }
      expect(find.byIcon(Icons.refresh), findsNWidgets(expectedFailed - 1));
      expect(find.byType(StickerArt), findsNWidgets(specs.length - expectedFailed + 1));
    });
  });

  group('my sports', () {
    test('main sport first, then extras (web useMySports)', () {
      final all = [sport('1', 'basketball'), sport('2', 'football'), sport('3', 'volleyball')];
      expect(sportsForUser(me(main: '3', extra: ['1']), all).map((s) => s.slug), ['volleyball', 'basketball']);
      expect(sportsForUser(me(main: '2'), all).map((s) => s.slug), ['football']);
      expect(sportsForUser(me(), all), isEmpty);
      expect(sportsForUser(null, all), isEmpty);
    });
  });

  group('realtime', () {
    testWidgets('does not connect without a user', (tester) async {
      final api = TicketFailApi();
      final rt = Realtime(api);
      await rt.start();
      expect(api.tickets, 0);
      rt.dispose();
    });

    testWidgets('ticket failure is caught and retried with backoff', (tester) async {
      final api = TicketFailApi()..session = Session('a', 'r', DateTime.utc(2030), {'id': 'u1'});
      final rt = Realtime(api);
      await rt.start(); // must not throw
      expect(api.tickets, 1);
      await tester.pump(const Duration(seconds: 1));
      expect(api.tickets, 2);
      await tester.pump(const Duration(seconds: 1)); // backoff doubled: not yet
      expect(api.tickets, 2);
      await tester.pump(const Duration(seconds: 1));
      expect(api.tickets, 3);
      rt.stop();
      await tester.pump(const Duration(seconds: 10));
      expect(api.tickets, 3);
      rt.dispose();
    });
  });
}
