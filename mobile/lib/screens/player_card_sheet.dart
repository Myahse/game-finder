import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/friends.dart' show profileShareUrl;
import '../core/l10n.dart';
import '../core/models.dart' show Sport;
import '../core/player_card.dart';
import '../ui/app_icons.dart' show sportIconDataOutlined;
import '../ui/player_card_art.dart';
import '../ui/share_image.dart';
import '../ui/widgets.dart';

/// "My card" (own profile) / "View card" (other players' profiles).
class PlayerCardButton extends StatelessWidget {
  /// User id, or "me".
  final String userId;
  final bool own;
  const PlayerCardButton({super.key, required this.userId, this.own = false});

  @override
  Widget build(BuildContext context) {
    final label = Text(own ? tr('MY CARD', 'MA CARTE') : tr('VIEW CARD', 'VOIR SA CARTE'));
    void open() => showPlayerCardSheet(context, userId: userId, own: own);
    const icon = Icon(Icons.style_outlined);
    return own
        ? FilledButton.icon(onPressed: open, icon: icon, label: label)
        : OutlinedButton.icon(onPressed: open, icon: icon, label: label);
  }
}

/// Opens the card sheet for [userId] ("me" for the signed-in player);
/// [sport] is a sport slug (default: the server's pick).
Future<void> showPlayerCardSheet(BuildContext context, {required String userId, String? sport, bool own = false}) =>
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (_) => PlayerCardSheet(userId: userId, sport: sport, own: own),
    );

/// The card drawn live, with style and sport switchers, Share and Download
/// (a 1080×1920 PNG).
class PlayerCardSheet extends StatefulWidget {
  final String userId;
  final String? sport;
  final bool own;
  const PlayerCardSheet({super.key, required this.userId, this.sport, this.own = false});
  @override
  State<PlayerCardSheet> createState() => _PlayerCardSheetState();
}

class _PlayerCardSheetState extends State<PlayerCardSheet> {
  final _boundary = GlobalKey();
  final _shareButton = GlobalKey();
  final _saveButton = GlobalKey();

  /// Cards already loaded, by sport slug ('' = the server's default sport).
  final _cards = <String, PlayerCard>{};
  late String _sport = widget.sport ?? '';
  CardStyle _style = CardStyle.card;
  bool _failed = false;
  bool _busy = false;

  /// Sport whose avatar image is in the cache (ready to capture).
  String? _ready;

  /// Sports the player has a rating in (kept while another sport loads).
  List<Sport> _sports = const [];

  PlayerCard? get _card => _cards[_sport];

  @override
  void initState() {
    super.initState();
    _load(_sport);
  }

  Future<void> _load(String sport) async {
    if (_cards.containsKey(sport)) {
      _prepare(sport);
      return;
    }
    if (_failed) setState(() => _failed = false);
    try {
      final card = await fetchPlayerCard(context.read<Api>(), widget.userId, sport: sport.isEmpty ? null : sport);
      if (!mounted) return;
      setState(() {
        _cards[sport] = card;
        // The default card is also the card of its sport.
        if (sport.isEmpty && card.sport != null) _cards[card.sport!.slug] = card;
        if (card.sports.isNotEmpty) _sports = card.sports;
      });
      _prepare(sport);
    } catch (_) {
      if (mounted && _sport == sport) setState(() => _failed = true);
    }
  }

  /// Loads the avatar into the image cache so the snapshot isn't missing it.
  Future<void> _prepare(String sport) async {
    final src = cardPortraitSource(_cards[sport]!.user);
    if (src != null) await precacheImage(NetworkImage(src.url), context, onError: (_, _) {});
    if (mounted && _sport == sport) setState(() => _ready = sport);
  }

  void _pickSport(String slug) {
    if (slug == _sport || (_sport.isEmpty && _card?.sport?.slug == slug)) return;
    setState(() {
      _sport = slug;
      _ready = null;
    });
    _load(slug);
  }

  String _url(PlayerCard c) => profileShareUrl(c.user.username);

  Future<void> _share({required bool withText}) async {
    final card = _card;
    if (_busy || card == null) return;
    setState(() => _busy = true);
    try {
      final png = await captureBoundaryPng(_boundary, pixelRatio: kCardExportRatio, settle: const Duration(milliseconds: 150));
      if (png == null) throw StateError('render failed');
      final url = _url(card);
      await sharePngs(
        [(bytes: png, name: 'out-for-ground-card-${card.user.username}-${_style.name}.png')],
        title: withText ? tr('Share the card', 'Partager la carte') : null,
        // Many apps drop the link when a file is attached, so it rides in the text.
        text: withText
            ? (widget.own
                  ? '${tr('Who wants to beat me?', 'Qui veut me battre ?')} $url'
                  : '${tr('Check out this player on Out For Ground:', 'Découvre ce joueur sur Out For Ground :')} $url')
            : null,
        origin: shareOriginOf(withText ? _shareButton : _saveButton),
      );
    } catch (_) {
      if (mounted) showSnack(context, tr('Could not create the image.', 'Impossible de créer l’image.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.colorScheme.onSurfaceVariant;
    final card = _card;
    final ready = card != null && _ready == _sport;
    final screenH = MediaQuery.sizeOf(context).height;
    // Fits the card on short phones while leaving room for the controls.
    final maxCardW = (screenH * 0.56 * kCardArtWidth / kCardArtHeight).clamp(180.0, 300.0);
    final sports = _sports;
    final selectedSport = _sport.isEmpty ? card?.sport?.slug : _sport;
    final title = widget.own
        ? tr('MY CARD', 'MA CARTE')
        : (card != null && card.user.username.isNotEmpty ? '@${card.user.username}' : tr('PLAYER CARD', 'CARTE DU JOUEUR'));

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 12),
            // Style switcher.
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final s in CardStyle.values)
                  ChoiceChip(
                    label: Text(s.label),
                    avatar: Icon(_styleIcon(s), size: 18),
                    showCheckmark: false,
                    selected: _style == s,
                    onSelected: (_) => setState(() => _style = s),
                  ),
              ],
            ),
            if (sports.length > 1) ...[
              const SizedBox(height: 8),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final s in sports)
                    ChoiceChip(
                      label: Text(s.name),
                      avatar: Icon(sportIconDataOutlined(s.slug), size: 18),
                      showCheckmark: false,
                      selected: selectedSport == s.slug,
                      onSelected: (_) => _pickSport(s.slug),
                    ),
                ],
              ),
            ],
            const SizedBox(height: 12),
            Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: maxCardW),
                child: AspectRatio(
                  aspectRatio: kCardArtWidth / kCardArtHeight,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: ColoredBox(
                      color: theme.colorScheme.surfaceContainerHighest,
                      child: card != null
                          ? FittedBox(
                              child: Semantics(
                                label: widget.own ? tr('Your player card', 'Votre carte de joueur') : tr('Player card', 'Carte du joueur'),
                                child: RepaintBoundary(
                                  key: _boundary,
                                  child: PlayerCardArt(card: card, style: _style, profileUrl: _url(card)),
                                ),
                              ),
                            )
                          : Center(
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: _failed
                                    ? Text(
                                        genericCardError,
                                        textAlign: TextAlign.center,
                                        style: TextStyle(fontSize: 13, color: muted),
                                      )
                                    : const CircularProgressIndicator(),
                              ),
                            ),
                    ),
                  ),
                ),
              ),
            ),
            if (_failed) ...[
              const SizedBox(height: 8),
              TextButton(onPressed: () => _load(_sport), child: Text(tr('Try again', 'Réessayer'))),
            ],
            if (card != null && widget.own && card.ratedGames == 0) ...[
              const SizedBox(height: 12),
              Text(
                tr(
                  'Play scored games to raise your rating and unlock new card colours.',
                  'Jouez des matchs avec score pour faire monter votre note et débloquer de nouvelles couleurs.',
                ),
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: muted),
              ),
            ],
            const SizedBox(height: 16),
            FilledButton.icon(
              key: _shareButton,
              onPressed: ready && !_busy ? () => _share(withText: true) : null,
              icon: _busy
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.ios_share),
              label: Text(tr('SHARE', 'PARTAGER')),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              key: _saveButton,
              onPressed: ready && !_busy ? () => _share(withText: false) : null,
              icon: const Icon(Icons.download_outlined),
              label: Text(tr('DOWNLOAD', 'TÉLÉCHARGER')),
            ),
          ],
        ),
      ),
    );
  }

  static IconData _styleIcon(CardStyle s) => switch (s) {
    CardStyle.card => Icons.style_outlined,
    CardStyle.poster => Icons.wallpaper_outlined,
    CardStyle.scoreboard => Icons.scoreboard_outlined,
    CardStyle.pass => Icons.qr_code_2,
  };
}
