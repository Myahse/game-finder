// The sticker set — everyday pickup-game reactions plus a cheer for the
// player's sport (port of web/src/lib/stickers.ts).

import 'l10n.dart';
import 'player_avatar.dart';

class StickerSpec {
  final String id, caption;
  final AvatarExpression expression;

  /// Caption tilt in degrees.
  final double tilt;
  const StickerSpec(this.id, this.caption, this.expression, this.tilt);
}

const _cheer = {
  'basketball': ('BUCKETS!', 'PANIER !'),
  'football': ('GOAL!', 'BUT !'),
  'volleyball': ('ACE!', 'ACE !'),
  'tennis': ('ACE!', 'ACE !'),
  'badminton': ('SMASH!', 'SMASH !'),
};

List<StickerSpec> stickerSet(String? sport, {bool? french}) {
  final fr = french ?? isFrench;
  String t(String en, String f) => fr ? f : en;
  final cheer = _cheer[sport] ?? ("LET'S GO!", 'ALLEZ !');
  return [
    StickerSpec('got-next', t('GOT NEXT?', 'JE PRENDS LA SUITE'),
        const AvatarExpression(eyes: 'default', eyebrows: 'raisedExcitedNatural', mouth: 'smile'), -4),
    StickerSpec('on-my-way', t('ON MY WAY', "J'ARRIVE"), const AvatarExpression(eyes: 'happy', eyebrows: 'defaultNatural', mouth: 'twinkle'), 3),
    StickerSpec('cheer', t(cheer.$1, cheer.$2), const AvatarExpression(eyes: 'surprised', eyebrows: 'raisedExcited', mouth: 'screamOpen'), -6),
    const StickerSpec('gg', 'GG', AvatarExpression(eyes: 'wink', eyebrows: 'defaultNatural', mouth: 'twinkle'), 5),
    StickerSpec('whos-in', t("WHO'S IN?", 'QUI JOUE ?'), const AvatarExpression(eyes: 'side', eyebrows: 'upDownNatural', mouth: 'default'), -3),
    StickerSpec('lets-go', t("LET'S GO!", 'ALLEZ !'), const AvatarExpression(eyes: 'happy', eyebrows: 'raisedExcitedNatural', mouth: 'smile'), 4),
    StickerSpec('rain-check', t('RAIN CHECK', 'PAS AUJOURD’HUI'),
        const AvatarExpression(eyes: 'default', eyebrows: 'sadConcernedNatural', mouth: 'concerned'), -2),
    StickerSpec('rematch', t('REMATCH?', 'REVANCHE ?'), const AvatarExpression(eyes: 'squint', eyebrows: 'angryNatural', mouth: 'serious'), 3),
  ];
}
