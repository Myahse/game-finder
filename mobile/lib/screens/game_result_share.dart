import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../core/api.dart';
import '../core/game_share.dart';
import '../core/l10n.dart';
import '../core/models.dart';
import '../core/scoreboard_models.dart';
import '../ui/widgets.dart';

/// Card frame in logical pixels (4:5); captured at 3× → 1080×1350 like the web card.
const _cardW = 360.0;
const _cardH = 450.0;
const _ink = Color(0xFF12151A);
const _deep = Color(0xFF7A1F00);
const _accent = Color(0xFFFFB020);
const _brand = Color(0xFFFF5A1F);

/// "Share result": the scoreboard as an image card + a link to the game.
Future<void> showResultShareSheet(BuildContext context, {required Game game, required Scoreboard sb}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => _ResultSheet(game: game, sb: sb),
  );
}

/// Short share link while the game is open; afterwards the in-app game link.
Future<String> resultUrl(Api api, Game game) async {
  if (game.isOpen) {
    try {
      return await createGameShareUrl(api, game.id);
    } catch (_) {
      // fall through
    }
  }
  return '$webAppUrl/games/${game.id}';
}

String resultDateLabel(DateTime d) {
  const en = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fr = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  return '${d.day} ${tr(en[d.month - 1], fr[d.month - 1])} ${d.year}';
}

class _ResultSheet extends StatefulWidget {
  final Game game;
  final Scoreboard sb;
  const _ResultSheet({required this.game, required this.sb});
  @override
  State<_ResultSheet> createState() => _ResultSheetState();
}

class _ResultSheetState extends State<_ResultSheet> {
  final _boundary = GlobalKey();
  final _shareButton = GlobalKey();
  String? _url;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    resultUrl(context.read<Api>(), widget.game).then((u) {
      if (mounted) setState(() => _url = u);
    });
  }

  Future<Uint8List?> _capture() async {
    // Let avatars finish painting before the snapshot.
    await Future<void>.delayed(const Duration(milliseconds: 50));
    final ro = _boundary.currentContext?.findRenderObject();
    if (ro is! RenderRepaintBoundary) return null;
    final image = await ro.toImage(pixelRatio: 3);
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    return data?.buffer.asUint8List();
  }

  Rect? _origin() {
    final box = _shareButton.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return null;
    return box.localToGlobal(Offset.zero) & box.size;
  }

  Future<void> _share() async {
    final url = _url;
    if (url == null) return;
    setState(() => _busy = true);
    final text = '${tr('Game result on Find the Game:', 'Résultat du match sur Find the Game :')} $url';
    try {
      final png = await _capture();
      final origin = _origin();
      await SharePlus.instance.share(ShareParams(
        title: tr('Game result', 'Résultat du match'),
        text: text,
        files: png == null ? null : [XFile.fromData(png, mimeType: 'image/png')],
        fileNameOverrides: png == null ? null : ['find-the-game-result-${widget.game.id.substring(0, 8)}.png'],
        sharePositionOrigin: origin,
      ));
    } catch (_) {
      await Clipboard.setData(ClipboardData(text: text));
      if (mounted) showSnack(context, tr('Could not open sharing — link copied instead.', 'Partage impossible — lien copié à la place.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _copy() async {
    final url = _url;
    if (url == null) return;
    await Clipboard.setData(ClipboardData(text: url));
    if (mounted) showSnack(context, tr('Link copied!', 'Lien copié !'));
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(tr('GAME RESULT', 'RÉSULTAT DU MATCH'), style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 12),
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 290),
              child: AspectRatio(
                aspectRatio: _cardW / _cardH,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: FittedBox(
                    child: Semantics(
                      label: tr('Result card', 'Carte du résultat'),
                      child: RepaintBoundary(
                        key: _boundary,
                        child: GameResultCard(game: widget.game, sb: widget.sb, url: _url),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(
              child: FilledButton.icon(
                key: _shareButton,
                onPressed: _url == null || _busy ? null : _share,
                icon: _busy
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.ios_share),
                label: Text(tr('SHARE', 'PARTAGER')),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _url == null ? null : _copy,
                icon: const Icon(Icons.link),
                label: Text(tr('COPY LINK', 'COPIER LE LIEN'), overflow: TextOverflow.ellipsis),
              ),
            ),
          ]),
        ]),
      ),
    );
  }
}

/// The shareable card: sport, court, date, score, winner, top players + MVP and the game link.
class GameResultCard extends StatelessWidget {
  final Game game;
  final Scoreboard sb;
  final String? url;
  const GameResultCard({super.key, required this.game, required this.sb, this.url});

  @override
  Widget build(BuildContext context) {
    final byId = {for (final p in game.players) p.id: p};
    final top = [
      for (final p in sb.resultPlayers(3))
        if (byId[p.userId] != null) (user: byId[p.userId]!, value: p.value, mvp: p.mvp),
    ];
    final teams = sb.teams.take(4).toList();
    final scored = teams.length >= 2 && teams.any((t) => t.score > 0);
    final statLbl = sb.mainKey == null ? '' : statLabel(sb.mainKey!);
    const white = Colors.white;

    return MediaQuery(
      // Fixed layout: ignore the phone's text scale so the image always fits.
      data: MediaQuery.of(context).copyWith(textScaler: TextScaler.noScaling),
      child: Material(
        type: MaterialType.transparency,
        child: Container(
          width: _cardW,
          height: _cardH,
          decoration: const BoxDecoration(
            gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [_ink, _deep]),
          ),
          child: Stack(children: [
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: const Alignment(0, -0.45),
                    radius: 0.9,
                    colors: [_brand.withValues(alpha: 0.33), _brand.withValues(alpha: 0)],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(22, 18, 22, 14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Row(children: [
                  const Text.rich(
                    TextSpan(children: [
                      TextSpan(text: 'FIND THE ', style: TextStyle(color: white)),
                      TextSpan(text: 'GAME', style: TextStyle(color: _accent)),
                    ]),
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, letterSpacing: -0.3),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(resultDateLabel(game.startTime),
                        textAlign: TextAlign.right,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: white.withValues(alpha: 0.75), fontSize: 11, fontWeight: FontWeight.w700)),
                  ),
                ]),
                const SizedBox(height: 8),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(game.courtName.toUpperCase(),
                      maxLines: 1, style: const TextStyle(color: white, fontSize: 28, fontWeight: FontWeight.w900, height: 1.05)),
                ),
                Text(game.sport.name, style: const TextStyle(color: _accent, fontSize: 12, fontWeight: FontWeight.w700)),
                const SizedBox(height: 10),
                // Score + top players shrink to fit whatever the font metrics are.
                Expanded(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.topCenter,
                    child: SizedBox(
                      width: _cardW - 44,
                      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        if (scored && teams.length == 2)
                          _TwoTeams(sb: sb, teams: teams)
                        else if (scored)
                          for (final t in [...teams]..sort((a, b) => b.score.compareTo(a.score)))
                            Container(
                              margin: const EdgeInsets.only(bottom: 5),
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                              decoration: BoxDecoration(color: hexColor(t.color), borderRadius: BorderRadius.circular(9)),
                              child: Row(children: [
                                if (sb.winner == t) const Padding(padding: EdgeInsets.only(right: 4), child: Icon(Icons.emoji_events, size: 14, color: white)),
                                Expanded(
                                  child: Text(t.name.toUpperCase(),
                                      overflow: TextOverflow.ellipsis, style: const TextStyle(color: white, fontSize: 15, fontWeight: FontWeight.w900)),
                                ),
                                Text('${t.score}', style: const TextStyle(color: white, fontSize: 20, fontWeight: FontWeight.w900)),
                              ]),
                            ),
                        const SizedBox(height: 14),
                        if (top.isNotEmpty) ...[
                          Text(tr('TOP PLAYERS', 'MEILLEURS JOUEURS'),
                              style: TextStyle(color: white.withValues(alpha: 0.8), fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 0.4)),
                          const SizedBox(height: 6),
                          Row(children: [
                            for (final p in top)
                              Expanded(
                                child: Column(children: [
                                  Container(
                                    padding: const EdgeInsets.all(2),
                                    decoration: BoxDecoration(shape: BoxShape.circle, color: p.mvp ? _accent : white),
                                    child: Container(
                                      decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xEBFFFFFF)),
                                      child: UserAvatar(p.user, size: top.length == 1 ? 52 : 42),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text('@${p.user.username}',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(color: white, fontSize: 11, fontWeight: FontWeight.w700)),
                                  Text(
                                    [
                                      if (p.value > 0) '${p.value} $statLbl',
                                      if (p.mvp) 'MVP',
                                    ].join(' · '),
                                    maxLines: 1,
                                    style: const TextStyle(color: _accent, fontSize: 13, fontWeight: FontWeight.w900),
                                  ),
                                ]),
                              ),
                          ]),
                          const SizedBox(height: 10),
                        ],
                      ]),
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(color: white, borderRadius: BorderRadius.circular(12)),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(tr('SEE THE GAME', 'VOIR LE MATCH'),
                        style: const TextStyle(color: _ink, fontSize: 15, fontWeight: FontWeight.w900)),
                    Text(
                      (url ?? '…').replaceFirst(RegExp(r'^https?://'), ''),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: _brand, fontSize: 11, fontWeight: FontWeight.w700),
                    ),
                  ]),
                ),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

class _TwoTeams extends StatelessWidget {
  final Scoreboard sb;
  final List<ScoreTeam> teams;
  const _TwoTeams({required this.sb, required this.teams});

  @override
  Widget build(BuildContext context) {
    final winner = sb.winner;
    Widget side(ScoreTeam t) {
      final won = winner == t;
      return Expanded(
        child: Column(children: [
          Container(
            height: 96,
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            decoration: BoxDecoration(
              color: hexColor(t.color).withValues(alpha: won ? 0.95 : 0.55),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(children: [
              Text(t.name.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w900)),
              Expanded(
                child: FittedBox(
                  child: Text('${t.score}', style: const TextStyle(color: Colors.white, fontSize: 60, fontWeight: FontWeight.w900, height: 1)),
                ),
              ),
            ]),
          ),
          const SizedBox(height: 5),
          SizedBox(
            height: 20,
            child: won
                ? Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: _accent, borderRadius: BorderRadius.circular(10)),
                    child: Text('★ ${tr('WINNER', 'VAINQUEUR')}',
                        style: const TextStyle(color: _ink, fontSize: 10, fontWeight: FontWeight.w900)),
                  )
                : null,
          ),
        ]),
      );
    }

    return Column(children: [
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        side(teams[0]),
        Padding(
          padding: const EdgeInsets.only(top: 38),
          child: SizedBox(
            width: 22,
            child: Text('–',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 26, fontWeight: FontWeight.w900)),
          ),
        ),
        side(teams[1]),
      ]),
      if (winner == null)
        Text(tr('DRAW', 'ÉGALITÉ'), style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w900)),
    ]);
  }
}
