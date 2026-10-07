import 'package:find_the_game/core/api.dart';
import 'package:find_the_game/core/guide.dart';
import 'package:find_the_game/core/l10n.dart';
import 'package:find_the_game/ui/screen_guide.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

final now = DateTime.utc(2026, 10, 7, 12);

Api apiFor(String id, {Duration age = const Duration(days: 2), bool onboarded = true}) => Api()
  ..session = Session('a', 'r', DateTime.utc(2030), {
    'id': id,
    'username': id,
    'onboarded': onboarded,
    'created_at': now.subtract(age).toIso8601String(),
  });

/// A screen with a button near the top that the first tip points at.
class GuideHost extends StatefulWidget {
  final String screen;
  const GuideHost({super.key, required this.screen});
  @override
  State<GuideHost> createState() => _GuideHostState();
}

class _GuideHostState extends State<GuideHost> {
  final target = GlobalKey();

  @override
  void initState() {
    super.initState();
    ScreenGuide.maybeShow(context, screen: widget.screen, tips: [
      GuideTip(target: target, icon: const Icon(Icons.swap_horiz), title: 'Switch sport here', body: 'Pick a sport.'),
      const GuideTip(icon: Icon(Icons.groups), title: 'Play together', body: 'Join a game.'),
    ]);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          child: Align(
            alignment: Alignment.topLeft,
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: ElevatedButton(key: target, onPressed: () {}, child: const Text('Sport')),
            ),
          ),
        ),
      );
}

Widget host(Api api, String screen) => ChangeNotifierProvider<Api>.value(
      value: api,
      child: MaterialApp(home: GuideHost(key: ValueKey(screen), screen: screen)),
    );

SpotlightPainter? spotlight(WidgetTester tester) {
  for (final w in tester.widgetList<CustomPaint>(find.byType(CustomPaint))) {
    if (w.painter is SpotlightPainter) return w.painter as SpotlightPainter;
  }
  return null;
}

Future<void> settleGuide(WidgetTester tester) async {
  await tester.pump(const Duration(milliseconds: 800)); // 700 ms delay
  await tester.pump(const Duration(milliseconds: 400)); // fade + measure
  await tester.pump(const Duration(milliseconds: 400));
}

void main() {
  group('guide rules', () {
    test('only accounts younger than 30 days are new players', () {
      expect(isNewPlayer(now.subtract(const Duration(days: 2)).toIso8601String(), now), isTrue);
      expect(isNewPlayer(now.subtract(const Duration(days: 29, hours: 23)).toIso8601String(), now), isTrue);
      expect(isNewPlayer(now.subtract(const Duration(days: 30)).toIso8601String(), now), isFalse);
      expect(isNewPlayer(null, now), isFalse);
      expect(isNewPlayer('', now), isFalse);
      expect(isNewPlayer('not a date', now), isFalse);
    });

    test('needs a signed-in, onboarded new player', () {
      final created = now.subtract(const Duration(days: 1)).toIso8601String();
      expect(guideEligible({'id': 'u1', 'onboarded': true, 'created_at': created}, now), isTrue);
      expect(guideEligible({'id': 'u1', 'onboarded': false, 'created_at': created}, now), isFalse);
      expect(guideEligible({'id': 'u1', 'onboarded': true}, now), isFalse);
      expect(guideEligible(null, now), isFalse);
    });

    test('seen once per screen per user; skip turns every screen off', () async {
      SharedPreferences.setMockInitialValues({});
      expect(await guideSeen('u1', GuideScreen.map), isFalse);
      await markGuideSeen('u1', GuideScreen.map);
      expect(await guideSeen('u1', GuideScreen.map), isTrue);
      expect(await guideSeen('u1', GuideScreen.play), isFalse);
      expect(await guideSeen('u2', GuideScreen.map), isFalse);
      await turnOffGuide('u1');
      expect(await guideSeen('u1', GuideScreen.play), isTrue);
      expect(await guideSeen('u2', GuideScreen.play), isFalse);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getBool('ftg_guide_v1_u1_map'), isTrue);
      expect(prefs.getBool('ftg_guide_v1_u1_off'), isTrue);
    });
  });

  group('ScreenGuide', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
      debugLanguageOverride = 'en';
      ScreenGuide.clock = () => now;
    });
    tearDown(() {
      debugLanguageOverride = null;
      ScreenGuide.clock = DateTime.now;
    });

    testWidgets('spotlights the target, Next advances, shown only once', (tester) async {
      final api = apiFor('u1');
      await tester.pumpWidget(host(api, GuideScreen.map));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('TIP 1 OF 2'), findsNothing); // waits ~700 ms

      await settleGuide(tester);
      expect(find.text('TIP 1 OF 2'), findsOneWidget);
      expect(find.text('SWITCH SPORT HERE'), findsOneWidget);
      expect(find.text('Skip tips'), findsOneWidget);

      // The cut-out sits on the button; the card goes to the other half.
      final hole = spotlight(tester)?.hole;
      final button = tester.getRect(find.widgetWithText(ElevatedButton, 'Sport'));
      expect(hole, isNotNull);
      expect((hole!.center - button.center).distance, lessThan(1));
      expect(tester.getTopLeft(find.text('SWITCH SPORT HERE')).dy, greaterThan(button.bottom));

      await tester.tap(find.text('NEXT'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('TIP 2 OF 2'), findsOneWidget);
      expect(find.text('PLAY TOGETHER'), findsOneWidget);
      expect(spotlight(tester)?.hole, isNull); // no target → dimmed, centred card

      await tester.tap(find.text('GOT IT'));
      await tester.pumpAndSettle();
      expect(find.text('PLAY TOGETHER'), findsNothing);
      expect(await guideSeen('u1', GuideScreen.map), isTrue);

      // Same screen again: no tips.
      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(host(api, GuideScreen.map));
      await settleGuide(tester);
      expect(find.text('SWITCH SPORT HERE'), findsNothing);
    });

    testWidgets('Skip tips turns off the other screens', (tester) async {
      final api = apiFor('u2');
      await tester.pumpWidget(host(api, GuideScreen.play));
      await settleGuide(tester);
      expect(find.text('SWITCH SPORT HERE'), findsOneWidget);

      await tester.tap(find.text('Skip tips'));
      await tester.pumpAndSettle();
      expect(find.text('SWITCH SPORT HERE'), findsNothing);
      expect(await guideSeen('u2', GuideScreen.play), isTrue);
      expect(await guideSeen('u2', GuideScreen.profile), isTrue);

      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(host(api, GuideScreen.profile));
      await settleGuide(tester);
      expect(find.text('SWITCH SPORT HERE'), findsNothing);
    });

    testWidgets('back closes the tips for this screen only', (tester) async {
      final api = apiFor('u3');
      await tester.pumpWidget(host(api, GuideScreen.challenges));
      await settleGuide(tester);
      expect(find.text('SWITCH SPORT HERE'), findsOneWidget);

      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text('SWITCH SPORT HERE'), findsNothing);
      expect(await guideSeen('u3', GuideScreen.challenges), isTrue);
      expect(await guideSeen('u3', GuideScreen.game), isFalse);
    });

    testWidgets('players older than 30 days get no tips', (tester) async {
      await tester.pumpWidget(host(apiFor('u4', age: const Duration(days: 45)), GuideScreen.game));
      await settleGuide(tester);
      expect(find.text('SWITCH SPORT HERE'), findsNothing);
    });
  });
}
