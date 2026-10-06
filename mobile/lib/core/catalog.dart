// Bilingual catalogue for challenges and badges (EN/FR by device language).

import 'package:flutter/material.dart';

import 'l10n.dart';

class ChallengeFormat {
  final String sport, id, emoji, _nameEn, _nameFr, _descEn, _descFr, _unitEn, _unitFr;
  final int teamSize;
  const ChallengeFormat(this.sport, this.id, this.teamSize, this.emoji, this._nameEn, this._nameFr, this._descEn, this._descFr, this._unitEn, this._unitFr);
  String get name => tr(_nameEn, _nameFr);
  String get desc => tr(_descEn, _descFr);
  String get unit => tr(_unitEn, _unitFr);
}

const challengeFormats = <ChallengeFormat>[
  ChallengeFormat('basketball', 'bball_1v1_11', 1, '🏀', '1v1 to 11', '1c1 en 11', 'Make-it-take-it, ones and twos.', 'Qui marque garde la balle, 1 et 2 points.', 'Points', 'Points'),
  ChallengeFormat('basketball', 'bball_1v1_21', 1, '🔥', '1v1 to 21', '1c1 en 21', 'Longer duel, win by 2.', 'Duel long, 2 points d’écart.', 'Points', 'Points'),
  ChallengeFormat('basketball', 'bball_horse', 1, '🐴', 'H.O.R.S.E.', 'H.O.R.S.E.', 'Copy the shot or take a letter.', 'Copie le tir ou prends une lettre.', 'Letters', 'Lettres'),
  ChallengeFormat('basketball', 'bball_3pt', 1, '🎯', '3-point contest', 'Concours à 3 pts', '25 shots from 5 spots — most makes wins.', '25 tirs sur 5 spots — le plus de paniers gagne.', 'Made', 'Réussis'),
  ChallengeFormat('basketball', 'bball_2v2', 2, '🤝', '2v2', '2c2', 'Bring a partner, to 21.', 'Avec un partenaire, en 21.', 'Points', 'Points'),
  ChallengeFormat('basketball', 'bball_3v3', 3, '👊', '3v3', '3c3', 'Half court, to 21.', 'Demi-terrain, en 21.', 'Points', 'Points'),
  ChallengeFormat('football', 'foot_1v1', 1, '⚽', '1v1', '1c1', 'Small goals, first to 5.', 'Petits buts, premier à 5.', 'Goals', 'Buts'),
  ChallengeFormat('football', 'foot_penalties', 1, '🥅', 'Penalty shootout', 'Séance de tirs au but', '5 shots each, then sudden death.', '5 tirs chacun, puis mort subite.', 'Goals', 'Buts'),
  ChallengeFormat('football', 'foot_juggling', 1, '🦶', 'Juggling contest', 'Concours de jongles', 'Most touches without dropping it.', 'Le plus de touches sans faire tomber.', 'Touches', 'Touches'),
  ChallengeFormat('football', 'foot_2v2', 2, '🤝', '2v2', '2c2', 'Small goals, 2 × 10 min.', 'Petits buts, 2 × 10 min.', 'Goals', 'Buts'),
  ChallengeFormat('football', 'foot_5v5', 5, '🏟️', '5v5', '5c5', 'Five-a-side, 2 × 20 min.', 'Foot à 5, 2 × 20 min.', 'Goals', 'Buts'),
  ChallengeFormat('volleyball', 'volley_1v1', 1, '🏐', '1v1', '1c1', 'Narrow court, to 15.', 'Terrain réduit, en 15.', 'Points', 'Points'),
  ChallengeFormat('volleyball', 'volley_serve', 1, '🎯', 'Serve challenge', 'Défi au service', '20 serves each — most aces wins.', '20 services chacun — le plus d’aces gagne.', 'Aces', 'Aces'),
  ChallengeFormat('volleyball', 'volley_2v2', 2, '🏖️', 'Beach 2v2', 'Beach 2c2', 'Best of 3 sets to 21.', '2 sets gagnants en 21.', 'Sets', 'Sets'),
  ChallengeFormat('volleyball', 'volley_3v3', 3, '👊', '3v3', '3c3', 'Best of 3 sets to 25.', '2 sets gagnants en 25.', 'Sets', 'Sets'),
  ChallengeFormat('tennis', 'tennis_tiebreak', 1, '🎾', 'Super tie-break', 'Super tie-break', 'First to 10, win by 2.', 'Premier à 10, 2 points d’écart.', 'Points', 'Points'),
  ChallengeFormat('tennis', 'tennis_1set', 1, '⏱️', '1 set', '1 set', 'First to 6 games, tie-break at 6–6.', 'Premier à 6 jeux, tie-break à 6–6.', 'Games', 'Jeux'),
  ChallengeFormat('tennis', 'tennis_bo3', 1, '🏆', 'Best of 3', '2 sets gagnants', 'Full match, 2 sets to win.', 'Match complet.', 'Sets', 'Sets'),
  ChallengeFormat('tennis', 'tennis_doubles', 2, '🤝', 'Doubles', 'Double', 'Best of 3 sets, bring a partner.', '2 sets gagnants, avec un partenaire.', 'Sets', 'Sets'),
  ChallengeFormat('badminton', 'badm_21', 1, '🏸', 'Singles to 21', 'Simple en 21', 'One game, win by 2.', 'Un jeu, 2 points d’écart.', 'Points', 'Points'),
  ChallengeFormat('badminton', 'badm_bo3', 1, '🏆', 'Best of 3', '2 jeux gagnants', 'Three games to 21.', 'Trois jeux en 21.', 'Games', 'Jeux'),
  ChallengeFormat('badminton', 'badm_doubles', 2, '🤝', 'Doubles to 21', 'Double en 21', 'One game, bring a partner.', 'Un jeu, avec un partenaire.', 'Points', 'Points'),
];

List<ChallengeFormat> formatsForSport(String? slug) => [for (final f in challengeFormats) if (f.sport == slug) f];

ChallengeFormat? formatById(String id) => challengeFormats.where((f) => f.id == id).firstOrNull;

class BadgeInfo {
  final String id, emoji, _nameEn, _nameFr, _descEn, _descFr;
  final Color color;
  final List<String> _howEn, _howFr;
  const BadgeInfo(this.id, this.emoji, this.color, this._nameEn, this._nameFr, this._descEn, this._descFr, this._howEn, this._howFr);
  String get name => tr(_nameEn, _nameFr);
  String get desc => tr(_descEn, _descFr);
  List<String> get how => isFrench ? _howFr : _howEn;
}

const badgeCatalog = <BadgeInfo>[
  BadgeInfo('first_game', '👟', Color(0xFF16A34A), 'First game', 'Premier match', 'Play your first game', 'Jouez votre premier match', ['Open Play or the map and pick a game near you.', 'Tap Join game — or create your own game at a court.', 'Once the game has started, it counts.'], ['Ouvrez Jouer ou la carte et choisissez un match près de vous.', 'Touchez Rejoindre — ou créez votre propre match sur un terrain.', 'Le match compte dès qu’il a commencé.']),
  BadgeInfo('games_10', '🔟', Color(0xFF0891B2), '10 games', '10 matchs', 'Play 10 games', 'Jouez 10 matchs', ['Join or create games — every game you play counts.', 'Cancelled games don’t count.'], ['Rejoignez ou créez des matchs — chaque match joué compte.', 'Les matchs annulés ne comptent pas.']),
  BadgeInfo('games_50', '💪', Color(0xFF1F6FFF), '50 games', '50 matchs', 'Play 50 games', 'Jouez 50 matchs', ['Keep playing — every game you join counts.', 'Weekly regulars get there fastest.'], ['Continuez à jouer — chaque match rejoint compte.', 'Les habitués de chaque semaine y arrivent le plus vite.']),
  BadgeInfo('games_100', '💯', Color(0xFF9333EA), '100 games', '100 matchs', 'Play 100 games', 'Jouez 100 matchs', ['A century of games. Keep showing up!', 'Every game you join counts, in any of your sports.'], ['Cent matchs ! Continuez à venir.', 'Chaque match rejoint compte, dans tous vos sports.']),
  BadgeInfo('first_win', '🏅', Color(0xFFF5B301), 'First win', 'Première victoire', 'Win a scored game', 'Gagnez un match avec score', ['Play a game where teams are set in Teams & stats.', 'Your team needs the higher final score.', 'Someone in the game saves the score — or win a challenge.'], ['Jouez un match avec des équipes dans Équipes & stats.', 'Votre équipe doit avoir le meilleur score final.', 'Un joueur du match enregistre le score — ou gagnez un défi.']),
  BadgeInfo('wins_10', '🏆', Color(0xFFEAB308), '10 wins', '10 victoires', 'Win 10 games', 'Gagnez 10 matchs', ['Win 10 scored games or challenges.', 'Teams and the final score must be saved in Teams & stats.'], ['Gagnez 10 matchs avec score ou défis.', 'Les équipes et le score final doivent être enregistrés dans Équipes & stats.']),
  BadgeInfo('first_mvp', '⭐', Color(0xFFF59E0B), 'First MVP', 'Premier MVP', 'Be voted MVP', 'Soyez élu MVP', ['Play a game with Teams & stats filled in.', 'The players pick you as MVP.'], ['Jouez un match avec Équipes & stats remplis.', 'Les joueurs vous élisent MVP.']),
  BadgeInfo('mvp_5', '🌟', Color(0xFFE11D48), '5× MVP', '5× MVP', 'Be MVP 5 times', 'Soyez MVP 5 fois', ['Be picked MVP in 5 different games.'], ['Soyez élu MVP dans 5 matchs différents.']),
  BadgeInfo('host_5', '📣', Color(0xFFFF5A1F), 'Host', 'Organisateur', 'Host 5 games', 'Organisez 5 matchs', ['Create 5 games from the map or Play.', 'They must not be cancelled.'], ['Créez 5 matchs depuis la carte ou Jouer.', 'Ils ne doivent pas être annulés.']),
  BadgeInfo('courts_5', '🧭', Color(0xFF0D9488), 'Explorer', 'Explorateur', 'Play at 5 different courts', 'Jouez sur 5 terrains différents', ['Play or check in (“I’m here”) at 5 different courts.', 'Open the map to find courts near you.'], ['Jouez ou faites un check-in (« Je suis là ») sur 5 terrains différents.', 'Ouvrez la carte pour trouver des terrains près de vous.']),
  BadgeInfo('early_bird', '🌅', Color(0xFFFB923C), 'Early bird', 'Lève-tôt', 'Play a game before 8am', 'Jouez un match avant 8 h', ['Play a game that starts before 8 am.'], ['Jouez un match qui commence avant 8 h.']),
  BadgeInfo('night_owl', '🦉', Color(0xFF4338CA), 'Night owl', 'Oiseau de nuit', 'Play a game after 9pm', 'Jouez un match après 21 h', ['Play a game that starts after 9 pm.'], ['Jouez un match qui commence après 21 h.']),
  BadgeInfo('rain_player', '🌧️', Color(0xFF0284C7), 'Rain player', 'Sous la pluie', 'Play a game in the rain', 'Jouez un match sous la pluie', ['Play a game while it’s raining at the court.', 'Save the score in Teams & stats — the weather at game time is recorded then.'], ['Jouez un match pendant qu’il pleut sur le terrain.', 'Enregistrez le score dans Équipes & stats — la météo du match est alors enregistrée.']),
  BadgeInfo('streak_4', '🔥', Color(0xFFEA580C), 'On fire', 'En feu', 'Play 4 weeks in a row', 'Jouez 4 semaines d’affilée', ['Play a game or check in at a court at least once a week.', 'Do it 4 weeks in a row (weeks run Monday to Sunday).'], ['Jouez un match ou faites un check-in au moins une fois par semaine.', 'Pendant 4 semaines d’affilée (du lundi au dimanche).']),
  BadgeInfo('king', '👑', Color(0xFFCA8A04), 'King of the Court', 'Roi du terrain', 'Finish a week #1 at a court', 'Finissez une semaine n°1 d’un terrain', ['Finish a week #1 in a court’s ranking.', 'Win = 3 pts, MVP = 2 pts, game played = 1 pt.', 'The crown is given every Monday.'], ['Terminez une semaine n°1 du classement d’un terrain.', 'Victoire = 3 pts, MVP = 2 pts, match joué = 1 pt.', 'La couronne est remise chaque lundi.']),
  BadgeInfo('social_10', '🤝', Color(0xFFDB2777), 'Connector', 'Rassembleur', 'Have 10 friends', 'Ayez 10 amis', ['Add 10 friends — by @username or invite link.'], ['Ajoutez 10 amis — par @pseudo ou lien d’invitation.']),
  BadgeInfo('duelist', '⚔️', Color(0xFFDC2626), 'Duelist', 'Duelliste', 'Win a challenge', 'Gagnez un défi', ['Challenge a player from their profile, or take an open challenge at a court.', 'Win, report the result and get it confirmed.'], ['Défiez un joueur depuis son profil, ou relevez un défi ouvert sur un terrain.', 'Gagnez, saisissez le résultat et faites-le confirmer.']),
  BadgeInfo('gunslinger', '🎯', Color(0xFF7C2D12), 'Gunslinger', 'Fine gâchette', 'Win 10 challenges', 'Gagnez 10 défis', ['Win 10 challenges.', 'Every confirmed win counts, in any sport.'], ['Gagnez 10 défis.', 'Chaque victoire confirmée compte, dans tous les sports.']),
  BadgeInfo('goatee', '🐐', Color(0xFFA16207), 'Goatee', 'Goatee', 'Be King of the Court 3 times — the GOAT', 'Soyez 3 fois Roi du terrain — le GOAT', ['Finish a week #1 in a court’s ranking — 3 times (any courts, any weeks).', 'Win = 3 pts, MVP = 2 pts, game played = 1 pt.', 'Each Monday’s crown counts. Collect three and you’re the GOAT 🐐'], ['Terminez une semaine n°1 du classement d’un terrain — 3 fois (n’importe quels terrains et semaines).', 'Victoire = 3 pts, MVP = 2 pts, match joué = 1 pt.', 'Chaque couronne du lundi compte. Trois couronnes et vous êtes le GOAT 🐐']),
];

BadgeInfo badgeInfo(String id) =>
    badgeCatalog.where((b) => b.id == id).firstOrNull ?? BadgeInfo(id, '🏅', const Color(0xFF8A94A6), id, id, '', '', const [], const []);

/// Level → title: Rookie, Starter, Hooper, Pro, All-Star, Legend.
int levelTier(int level) => level >= 15 ? 5 : level >= 11 ? 4 : level >= 8 ? 3 : level >= 5 ? 2 : level >= 3 ? 1 : 0;

String levelTitle(int level) => isFrench
    ? const ['Rookie', 'Titulaire', 'Hooper', 'Pro', 'All-Star', 'Légende'][levelTier(level)]
    : const ['Rookie', 'Starter', 'Hooper', 'Pro', 'All-Star', 'Legend'][levelTier(level)];

const tierColors = [Color(0xFF8A94A6), Color(0xFF16A34A), Color(0xFF1F6FFF), Color(0xFF9333EA), Color(0xFFE11D48), Color(0xFFF5B301)];
