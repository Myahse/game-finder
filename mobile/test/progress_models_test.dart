import 'package:flutter_test/flutter_test.dart';
import 'package:find_the_game/core/catalog.dart';
import 'package:find_the_game/core/progress_models.dart';

Map<String, dynamic> user(String id, String username) =>
    {'id': id, 'username': username, 'first_name': username, 'last_name': '', 'created_at': '2026-01-01T00:00:00Z'};

void main() {
  test('challenge list parses', () {
    final l = ChallengeList.fromJson({
      'incoming': [
        {
          'id': 'c1',
          'sport': {'id': 's', 'name': 'Basketball', 'slug': 'basketball', 'icon': 'basketball', 'active': true},
          'format': 'bball_1v1_11',
          'team_size': 1,
          'challenger': user('u1', 'kofi'),
          'opponent': user('u2', 'ama'),
          'court': {'id': 'k1', 'name': 'Terrain IUGB'},
          'start_time': '2026-10-06T18:00:00Z',
          'status': 'pending',
          'is_open': false,
          'created_at': '2026-10-06T17:00:00Z',
        }
      ],
      'outgoing': [],
      'active': [],
      'history': [],
      'record': {'wins': 3, 'losses': 1},
    });
    expect(l.incoming.single.opponent!.username, 'ama');
    expect(l.wins, 3);
    expect(formatById(l.incoming.single.format)!.teamSize, 1);
  });

  test('progress parses and every badge has catalogue info', () {
    final p = Progress.fromJson({
      'xp': 1340,
      'level': 5,
      'level_xp': 1000,
      'next_level_xp': 1500,
      'streak': {'current': 3, 'best': 5, 'active_this_week': false},
      'ratings': [
        {'sport': {'id': 's', 'name': 'Basketball', 'slug': 'basketball', 'icon': 'b', 'active': true}, 'rating': 1087, 'games': 14}
      ],
      'badges': [for (final b in badgeCatalog) {'id': b.id, 'goal': 1, 'have': 0, 'earned_at': null}],
      'crowns': [
        {'court_id': 'k1', 'court_name': 'Terrain IUGB'}
      ],
      'new_badges': ['king'],
    });
    expect(p.levelProgress, closeTo(0.68, 0.001));
    expect(levelTitle(p.level), anyOf('Hooper'));
    expect(p.crowns.single.name, 'Terrain IUGB');
    expect(p.badges.length, badgeCatalog.length);
    for (final b in p.badges) {
      expect(badgeInfo(b.id).how, isNotEmpty);
    }
  });

  test('every sport has challenge formats', () {
    for (final s in ['basketball', 'football', 'volleyball', 'tennis', 'badminton']) {
      expect(formatsForSport(s), isNotEmpty);
    }
  });
}
