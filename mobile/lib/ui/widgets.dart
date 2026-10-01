import 'package:flutter/material.dart';

import '../core/format.dart';
import '../core/models.dart';
import 'app_icons.dart';
import 'theme.dart';

class StatusPill extends StatelessWidget {
  final Activity activity;
  const StatusPill(this.activity, {super.key});

  @override
  Widget build(BuildContext context) {
    final label = switch (activity) {
      Activity.active => 'GAME ACTIVE',
      Activity.players => 'PLAYERS PRESENT',
      Activity.inactive => 'INACTIVE',
    };
    final color = Palette.activity(activity);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.16), borderRadius: BorderRadius.circular(8)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(activityIconData(activity), size: 16, color: activity == Activity.players ? const Color(0xFF8A6A00) : color),
        const SizedBox(width: 6),
        Text(label,
            style: TextStyle(
              fontWeight: FontWeight.w900,
              letterSpacing: 0.5,
              color: activity == Activity.players ? const Color(0xFF8A6A00) : color,
            )),
      ]),
    );
  }
}

class UserAvatar extends StatelessWidget {
  final PublicUser? user;
  final double size;
  final String? overrideUrl;
  const UserAvatar(this.user, {super.key, this.size = 40, this.overrideUrl});

  @override
  Widget build(BuildContext context) {
    final url = overrideUrl ?? user?.avatarUrl;
    return CircleAvatar(
      radius: size / 2,
      backgroundColor: Palette.brand.withValues(alpha: 0.15),
      backgroundImage: url != null ? NetworkImage(url) : null,
      child: url == null
          ? Text(user?.initials ?? '?',
              style: TextStyle(color: Palette.brand, fontWeight: FontWeight.w900, fontSize: size * 0.38))
          : null,
    );
  }
}

/// SPORT + DISTANCE + PLAYER COUNT + STATUS, at a glance.
class GameCard extends StatelessWidget {
  final Game game;
  final bool showCourt;
  final bool dense;
  final VoidCallback onTap;
  const GameCard({super.key, required this.game, required this.onTap, this.showCourt = true, this.dense = false});

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final muted = t.colorScheme.onSurfaceVariant;
    final full = game.spotsLeft == 0;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Padding(
          padding: EdgeInsets.all(dense ? 10 : 12),
          child: Row(children: [
            Container(
              width: dense ? 52 : 64,
              padding: EdgeInsets.symmetric(vertical: dense ? 6 : 8),
              decoration: BoxDecoration(
                color: game.isLive ? Palette.live.withValues(alpha: 0.15) : t.colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(children: [
                SportIcon(game.sport.slug, size: dense ? 22 : 26, color: game.isLive ? Palette.live : muted),
                Text('${game.playerCount}/${game.maxPlayers}',
                    style: TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: dense ? 15 : 18,
                        color: game.isLive ? Palette.live : muted)),
              ]),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  if (game.isLive)
                    Container(
                      margin: const EdgeInsets.only(right: 6),
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                      decoration: BoxDecoration(color: Palette.live, borderRadius: BorderRadius.circular(4)),
                      child: const Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.local_fire_department, size: 12, color: Colors.white),
                        SizedBox(width: 2),
                        Text('LIVE', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 11)),
                      ]),
                    ),
                  Flexible(
                    child: Text('${gameTypeLabels[game.gameType]} ${game.sport.name.toLowerCase()}',
                        overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ]),
                if (showCourt)
                  Row(children: [
                    Icon(Icons.place, size: 14, color: muted),
                    const SizedBox(width: 4),
                    Expanded(child: Text(game.courtName, overflow: TextOverflow.ellipsis, style: TextStyle(color: muted))),
                  ]),
                const SizedBox(height: 2),
                Row(children: [
                  Icon(Icons.schedule, size: 14, color: muted),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(
                      gameTime(game),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: muted, fontSize: dense ? 12 : 13),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Icon(Icons.star, size: 14, color: muted),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(
                      skillLabels[game.skillLevel] ?? game.skillLevel,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: muted, fontSize: dense ? 12 : 13),
                    ),
                  ),
                ]),
              ]),
            ),
            if (!dense)
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                if (game.distanceM != null)
                  Text(formatDistance(game.distanceM), style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                const SizedBox(height: 4),
                Text(full ? 'Full' : '${game.spotsLeft} spot${game.spotsLeft == 1 ? '' : 's'}',
                    style: TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w700, color: full ? t.colorScheme.error : Palette.live)),
              ]),
          ]),
        ),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? body;
  final Widget? action;
  const EmptyState({super.key, required this.icon, required this.title, this.body, this.action});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
        child: Column(children: [
          Icon(icon, size: 48, color: Theme.of(context).colorScheme.onSurfaceVariant),
          const SizedBox(height: 8),
          Text(title.toUpperCase(), style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
          if (body != null) ...[
            const SizedBox(height: 6),
            Text(body!, textAlign: TextAlign.center, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
          ],
          if (action != null) ...[const SizedBox(height: 16), action!],
        ]),
      );
}

class PasswordTextField extends StatefulWidget {
  final TextEditingController controller;
  final String labelText;
  final String? helperText;
  final String? Function(String?)? validator;
  final Iterable<String>? autofillHints;
  final void Function(String)? onSubmitted;

  const PasswordTextField({
    super.key,
    required this.controller,
    required this.labelText,
    this.helperText,
    this.validator,
    this.autofillHints,
    this.onSubmitted,
  });

  @override
  State<PasswordTextField> createState() => _PasswordTextFieldState();
}

class _PasswordTextFieldState extends State<PasswordTextField> {
  bool _obscure = true;

  @override
  Widget build(BuildContext context) => TextFormField(
        controller: widget.controller,
        obscureText: _obscure,
        autofillHints: widget.autofillHints,
        validator: widget.validator,
        onFieldSubmitted: widget.onSubmitted,
        decoration: InputDecoration(
          labelText: widget.labelText,
          helperText: widget.helperText,
          suffixIcon: IconButton(
            onPressed: () => setState(() => _obscure = !_obscure),
            icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
            tooltip: _obscure ? 'Show password' : 'Hide password',
          ),
        ),
      );
}

class ErrorBanner extends StatelessWidget {
  final String? message;
  const ErrorBanner(this.message, {super.key});
  @override
  Widget build(BuildContext context) {
    if (message == null || message!.isEmpty) return const SizedBox.shrink();
    final c = Theme.of(context).colorScheme.error;
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: c.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
      child: Text(message!, style: TextStyle(color: c, fontWeight: FontWeight.w600)),
    );
  }
}

/// Toggle chip used for sports, skill levels, report types.
class ChoiceTile extends StatelessWidget {
  final String label;
  final Widget? leading;
  final bool selected;
  final VoidCallback onTap;
  const ChoiceTile({super.key, required this.label, this.leading, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: selected ? Palette.brand.withValues(alpha: 0.1) : Theme.of(context).colorScheme.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: selected ? Palette.brand : Theme.of(context).dividerColor, width: 2),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            if (leading != null) ...[leading!, const SizedBox(width: 8)],
            Flexible(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700))),
          ]),
        ),
      );
}

void showSnack(BuildContext context, String msg) =>
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), behavior: SnackBarBehavior.floating));
