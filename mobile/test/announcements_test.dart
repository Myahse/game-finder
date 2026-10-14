import 'package:find_the_game/core/announcements.dart';
import 'package:find_the_game/core/l10n.dart';
import 'package:find_the_game/core/notification_links.dart';
import 'package:find_the_game/ui/announcement_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

const _id = '12a7209f-0e71-4750-b2b8-2959814178eb';

void main() {
  test('parses an announcement and drops empty optional fields', () {
    final a = Announcement.fromJson({
      'id': _id,
      'title': 'Les quêtes du jour arrivent',
      'body': '3 quêtes par jour',
      'image_url': '/uploads/announcement/u/x.png',
      'link_url': '/play',
      'cta_label': '',
      'active': true,
      'created_at': '2026-10-14T12:00:00Z',
    });
    expect(a.title, 'Les quêtes du jour arrivent');
    expect(a.imageUrl, '/uploads/announcement/u/x.png');
    expect(a.linkUrl, '/play');
    expect(a.ctaLabel, isNull);
  });

  test('maps button links to app screens or the website', () {
    expect(announcementLink('/play')!.kind, AnnouncementLinkKind.play);
    expect(announcementLink('/')!.kind, AnnouncementLinkKind.map);
    expect(announcementLink('/challenges')!.kind, AnnouncementLinkKind.challenges);
    expect(announcementLink('/profile')!.kind, AnnouncementLinkKind.profile);
    expect(announcementLink('/courts/new')!.kind, AnnouncementLinkKind.addCourt);
    final ext = announcementLink('https://chat.whatsapp.com/abc')!;
    expect(ext.kind, AnnouncementLinkKind.external);
    expect(ext.uri.toString(), 'https://chat.whatsapp.com/abc');
    final web = announcementLink('/my-games')!;
    expect(web.kind, AnnouncementLinkKind.external);
    expect(web.uri.toString(), 'https://www.outforground.com/my-games');
    expect(announcementLink(null), isNull);
    expect(announcementLink(''), isNull);
    expect(announcementLink('//evil.example'), isNull);
    expect(announcementLink('javascript:alert(1)'), isNull);
  });

  test('an announcement notification opens its flyer', () {
    expect(notificationTarget('system', {'kind': 'announcement', 'announcement_id': _id}), const NotificationTarget(NotificationDest.announcement, _id));
    expect(notificationTarget('system', {'kind': 'announcement', 'announcement_id': '../x'}), isNull);
    // other kinds still route as before
    expect(notificationTarget('challenge', {}), const NotificationTarget(NotificationDest.challenges));
    expect(
      targetFromPayload(pushPayload({'type': 'system', 'kind': 'announcement', 'announcement_id': _id})),
      const NotificationTarget(NotificationDest.announcement, _id),
    );
  });

  testWidgets('the pop-up shows the text and a button only when there is a link', (tester) async {
    debugLanguageOverride = 'fr';
    addTearDown(() => debugLanguageOverride = null);
    Future<bool?> open(Announcement a) async {
      bool? result;
      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (ctx) {
              return TextButton(onPressed: () async => result = await showAnnouncementSheet(ctx, a), child: const Text('go'));
            },
          ),
        ),
      );
      await tester.tap(find.text('go'));
      await tester.pumpAndSettle();
      return result;
    }

    await open(const Announcement(id: _id, title: 'Les quêtes du jour arrivent', body: '3 quêtes par jour', linkUrl: '/play', ctaLabel: 'Voir mes quêtes'));
    expect(find.text('NOUVEAU SUR OUT FOR GROUND'), findsOneWidget);
    expect(find.text('Les quêtes du jour arrivent'), findsOneWidget);
    expect(find.text('3 quêtes par jour'), findsOneWidget);
    expect(find.text('Voir mes quêtes'), findsOneWidget);
    expect(find.text('Fermer'), findsOneWidget);
    await tester.tap(find.text('Voir mes quêtes'));
    await tester.pumpAndSettle();
    expect(find.text('Les quêtes du jour arrivent'), findsNothing);

    await open(const Announcement(id: _id, title: 'Sans bouton'));
    expect(find.text('Fermer'), findsOneWidget);
    expect(find.text('Voir'), findsNothing);
  });
}
