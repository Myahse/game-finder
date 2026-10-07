import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../core/format.dart';
import '../core/friends.dart';
import '../core/l10n.dart';
import '../core/models.dart';
import '../ui/share_image.dart';
import '../ui/widgets.dart';

/// Card frame in logical pixels (4:5); captured at 3× → 1080×1350 like the web card.
const _cardW = 360.0;
const _cardH = 450.0;
const _ink = Color(0xFF12151A);
const _deep = Color(0xFF7A1F00);
const _accent = Color(0xFFFFB020);
const _brand = Color(0xFFFF5A1F);

/// "Share my profile" button (web ShareProfileButton).
class ShareProfileButton extends StatelessWidget {
  final Me me;
  final Sport? sport;
  const ShareProfileButton({super.key, required this.me, this.sport});

  @override
  Widget build(BuildContext context) => OutlinedButton.icon(
        onPressed: () => showShareProfileSheet(context, me: me, sport: sport),
        icon: const Icon(Icons.ios_share),
        label: Text(tr('SHARE MY PROFILE', 'PARTAGER MON PROFIL')),
      );
}

/// "Sport · Level" under the name ("All levels" is left out, like the web).
String profileCardSubtitle(Sport? sport, String? skillLevel) => [
      if (sport != null) sport.name,
      if (skillLevel != null && skillLevel != 'all_levels') skillLabels[skillLevel] ?? skillLevel,
    ].join(' · ');

Future<void> showShareProfileSheet(BuildContext context, {required Me me, Sport? sport}) => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (_) => _ShareProfileSheet(me: me, sport: sport),
    );

class _ShareProfileSheet extends StatefulWidget {
  final Me me;
  final Sport? sport;
  const _ShareProfileSheet({required this.me, this.sport});
  @override
  State<_ShareProfileSheet> createState() => _ShareProfileSheetState();
}

class _ShareProfileSheetState extends State<_ShareProfileSheet> {
  final _boundary = GlobalKey();
  final _shareButton = GlobalKey();
  bool _busy = false;
  String? _note;

  String get _url => profileShareUrl(widget.me.username);

  Future<void> _share() async {
    setState(() => _busy = true);
    // Many apps drop the link when a file is attached, so it also rides in the text.
    final text = '${tr('Play with me on Find the Game:', 'Viens jouer avec moi sur Find the Game :')} $_url';
    try {
      final png = await captureBoundaryPng(_boundary, settle: const Duration(milliseconds: 150));
      await sharePngs(
        [if (png != null) (bytes: png, name: 'find-the-game-${widget.me.username}.png')],
        title: tr('Share your profile', 'Partager votre profil'),
        text: text,
        origin: shareOriginOf(_shareButton),
      );
    } catch (_) {
      await _copy();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: _url));
    if (mounted) setState(() => _note = tr('Link copied!', 'Lien copié !'));
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(tr('SHARE YOUR PROFILE', 'PARTAGER VOTRE PROFIL'),
              style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 12),
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 272),
              child: AspectRatio(
                aspectRatio: _cardW / _cardH,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: FittedBox(
                    child: Semantics(
                      label: tr('Your profile card', 'Votre carte de profil'),
                      child: RepaintBoundary(
                        key: _boundary,
                        child: ProfileShareCard(
                          user: widget.me,
                          url: _url,
                          subtitle: profileCardSubtitle(widget.sport, widget.me.skillLevel),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            key: _shareButton,
            onPressed: _busy ? null : _share,
            icon: _busy
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.ios_share),
            label: Text(tr('SHARE', 'PARTAGER')),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _copy,
            icon: const Icon(Icons.link),
            label: Text(tr('COPY LINK', 'COPIER LE LIEN')),
          ),
          if (_note != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_note!, textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w600)),
            ),
        ]),
      ),
    );
  }
}

/// The shareable card (web lib/profileCard.ts): avatar, @username, sport and
/// level, and a QR code to the public profile link.
class ProfileShareCard extends StatelessWidget {
  final PublicUser user;
  final String url;
  final String subtitle;
  const ProfileShareCard({super.key, required this.user, required this.url, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    const white = Colors.white;
    final cta = tr('SCAN TO\nPLAY WITH ME', 'SCANNE POUR\nJOUER AVEC MOI');
    return MediaQuery(
      // Fixed layout: ignore the phone's text scale so the image always fits.
      data: MediaQuery.of(context).copyWith(textScaler: TextScaler.noScaling),
      child: Material(
        type: MaterialType.transparency,
        child: Container(
          width: _cardW,
          height: _cardH,
          decoration: const BoxDecoration(
            gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [_brand, _deep]),
          ),
          child: Stack(children: [
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: const Alignment(0.7, -0.8),
                    radius: 1.1,
                    colors: [_accent.withValues(alpha: 0.4), _accent.withValues(alpha: 0)],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(26, 22, 26, 22),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                const Text.rich(
                  TextSpan(children: [
                    TextSpan(text: 'FIND THE ', style: TextStyle(color: white)),
                    TextSpan(text: 'GAME', style: TextStyle(color: _accent)),
                  ]),
                  style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900, letterSpacing: -0.3),
                ),
                const SizedBox(height: 10),
                Center(
                  child: Container(
                    width: 148,
                    height: 148,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: white.withValues(alpha: 0.92),
                      border: Border.all(color: white, width: 3),
                    ),
                    alignment: Alignment.center,
                    child: UserAvatar(user, size: 140, crown: false),
                  ),
                ),
                const SizedBox(height: 12),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text('@${user.username}',
                      maxLines: 1, style: const TextStyle(color: white, fontSize: 36, fontWeight: FontWeight.w900, height: 1.05)),
                ),
                if (subtitle.isNotEmpty)
                  Text(subtitle,
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: white.withValues(alpha: 0.85), fontSize: 13, fontWeight: FontWeight.w600)),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: white, borderRadius: BorderRadius.circular(12)),
                  child: Row(children: [
                    QrImageView(
                      data: url,
                      size: 96,
                      padding: EdgeInsets.zero,
                      backgroundColor: white,
                      errorCorrectionLevel: QrErrorCorrectLevel.M,
                      eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: _ink),
                      dataModuleStyle: const QrDataModuleStyle(dataModuleShape: QrDataModuleShape.square, color: _ink),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(cta, style: const TextStyle(color: _ink, fontSize: 19, fontWeight: FontWeight.w900, height: 1.05)),
                        const SizedBox(height: 6),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text(url.replaceFirst(RegExp(r'^https?://'), ''),
                              maxLines: 1, style: const TextStyle(color: _brand, fontSize: 11, fontWeight: FontWeight.w700)),
                        ),
                      ]),
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
