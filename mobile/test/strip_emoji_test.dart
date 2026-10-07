import 'package:find_the_game/core/catalog.dart';
import 'package:find_the_game/core/strip_emoji.dart';
import 'package:find_the_game/ui/app_icons.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('stripEmoji', () {
    test('removes emoji, variation selectors and joiners', () {
      expect(stripEmoji('📍 Game moved to Parc Lafontaine'), 'Game moved to Parc Lafontaine');
      expect(stripEmoji('@bob moved the game because of rain 🌧️.'), '@bob moved the game because of rain.');
      expect(stripEmoji('You ready? 🔥 Let’s go 👨‍👩‍👧 ⚔️ ⭐'), 'You ready? Let’s go');
      expect(stripEmoji('👑'), '');
    });

    test('leaves plain text untouched', () {
      const s = 'Rappel : match à 18 h — 2 places, l’équipe « A »';
      expect(stripEmoji(s), same(s));
      expect(stripEmoji(''), '');
    });
  });

  test('court moves get a place icon, not the game_activity flame', () {
    expect(notificationIconData('game_activity', data: {'kind': 'court_change'}), Icons.place);
    expect(notificationIconData('game_activity'), Icons.local_fire_department);
  });

  test('every badge and challenge format has an icon', () {
    expect(badgeInfo('king').icon, AppGlyph.crown);
    expect(badgeInfo('duelist').icon, AppGlyph.swords);
    expect(badgeInfo('rain_player').icon, AppGlyph.cloudRain);
    expect(badgeInfo('unknown').icon.material, Icons.military_tech);
    for (final f in challengeFormats) {
      expect(f.icon.material != null || f.icon.custom != null, isTrue, reason: f.id);
      if (f.teamSize > 1) expect(f.icon.material, Icons.groups, reason: f.id);
    }
  });

  testWidgets('custom glyphs paint like icons and follow IconTheme', (tester) async {
    await tester.pumpWidget(const Directionality(
      textDirection: TextDirection.ltr,
      child: IconTheme(
        data: IconThemeData(size: 30, color: Colors.red),
        child: Row(children: [CrownIcon(), SwordsIcon(size: 16), AppGlyphIcon(AppGlyph(Icons.star))]),
      ),
    ));
    expect(tester.getSize(find.byType(CrownIcon)), const Size(30, 30));
    expect(tester.getSize(find.byType(SwordsIcon)), const Size(16, 16));
    expect(find.byIcon(Icons.star), findsOneWidget);
  });
}
