import 'api.dart';

/// An admin announcement: a flyer with a title, text and an optional button
/// (web lib/announcements.ts). Shown once as a pop-up after sign-in.
class Announcement {
  final String id;
  final String title;
  final String body;
  final String? imageUrl;
  final String? linkUrl;
  final String? ctaLabel;

  const Announcement({required this.id, required this.title, this.body = '', this.imageUrl, this.linkUrl, this.ctaLabel});

  static String? _opt(Object? v) => v is String && v.trim().isNotEmpty ? v : null;

  factory Announcement.fromJson(Map<String, dynamic> j) => Announcement(
    id: j['id'] as String,
    title: (j['title'] as String?) ?? '',
    body: (j['body'] as String?) ?? '',
    imageUrl: _opt(j['image_url']),
    linkUrl: _opt(j['link_url']),
    ctaLabel: _opt(j['cta_label']),
  );
}

final _uuid = RegExp(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');
bool isAnnouncementId(String? id) => id != null && _uuid.hasMatch(id);

/// The newest announcement this user hasn't seen yet, or null.
Future<Announcement?> fetchPendingAnnouncement(Api api) async {
  final j = await api.get('/api/announcements/pending');
  return j is Map ? Announcement.fromJson(Map<String, dynamic>.from(j)) : null;
}

/// One announcement by id (opened from a notification, even if already seen).
Future<Announcement?> fetchAnnouncement(Api api, String id) async {
  if (!isAnnouncementId(id)) return null;
  final j = await api.get('/api/announcements/$id');
  return j is Map ? Announcement.fromJson(Map<String, dynamic>.from(j)) : null;
}

Future<void> markAnnouncementSeen(Api api, String id) async {
  if (!isAnnouncementId(id)) return;
  await api.post('/api/announcements/$id/seen');
}

/// Where an announcement's button goes in the app. The admin picks one of the
/// web paths (/play, /, /challenges, /profile, /courts/new) or an https link.
enum AnnouncementLinkKind { map, play, challenges, profile, addCourt, external }

class AnnouncementLink {
  final AnnouncementLinkKind kind;
  final Uri? uri;
  const AnnouncementLink(this.kind, [this.uri]);
}

/// [webBase] is the site that serves other in-app paths (outforground.com).
AnnouncementLink? announcementLink(String? link, {String webBase = 'https://www.outforground.com'}) {
  final l = link?.trim();
  if (l == null || l.isEmpty) return null;
  if (l.startsWith('https://')) {
    final u = Uri.tryParse(l);
    return u == null ? null : AnnouncementLink(AnnouncementLinkKind.external, u);
  }
  if (!l.startsWith('/') || l.startsWith('//')) return null;
  final path = l.split('?').first.split('#').first;
  switch (path) {
    case '/':
      return const AnnouncementLink(AnnouncementLinkKind.map);
    case '/play':
      return const AnnouncementLink(AnnouncementLinkKind.play);
    case '/challenges':
      return const AnnouncementLink(AnnouncementLinkKind.challenges);
    case '/profile':
      return const AnnouncementLink(AnnouncementLinkKind.profile);
    case '/courts/new':
      return const AnnouncementLink(AnnouncementLinkKind.addCourt);
  }
  // Any other app page: open it on the website.
  return AnnouncementLink(AnnouncementLinkKind.external, Uri.parse('${webBase.replaceAll(RegExp(r'/+$'), '')}$l'));
}
