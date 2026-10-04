import 'package:flutter/material.dart';

import '../core/models.dart';

/// Court-at-night palette: hardwood orange for action, scoreboard green for live.
/// Space for the floating tab bar above the system inset (map CTAs sit above this).
const kFloatingNavClearance = 84.0;

class Palette {
  static const brand = Color(0xFFFF5A1F);
  static const live = Color(0xFF16A34A);
  static const upcoming = Color(0xFF2563EB);
  static const players = Color(0xFFEAB308);
  static const idle = Color(0xFF9AA0A8);
  static const night = Color(0xFF0B0E12);

  static Color activity(Activity a) => switch (a) {
        Activity.active => live,
        Activity.players => players,
        Activity.inactive => idle,
      };
}

ThemeData buildTheme(Brightness b) {
  final dark = b == Brightness.dark;
  final scheme = ColorScheme.fromSeed(
    seedColor: Palette.brand,
    brightness: b,
    primary: Palette.brand,
    onPrimary: Colors.white,
    surface: dark ? const Color(0xFF151A21) : Colors.white,
    surfaceContainerHighest: dark ? const Color(0xFF1D232C) : const Color(0xFFEFECE6),
  );
  final base = ThemeData(useMaterial3: true, colorScheme: scheme, brightness: b);
  return base.copyWith(
    scaffoldBackgroundColor: dark ? Palette.night : const Color(0xFFF6F4F0),
    textTheme: base.textTheme.copyWith(
      // Condensed, heavy, uppercase headlines give the sports feel.
      displaySmall: base.textTheme.displaySmall?.copyWith(fontWeight: FontWeight.w900, letterSpacing: -0.5, height: 1),
      headlineMedium: base.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900, letterSpacing: -0.3),
      titleLarge: base.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: dark ? Palette.night : const Color(0xFFF6F4F0),
      surfaceTintColor: Colors.transparent,
      titleTextStyle: base.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900, color: scheme.onSurface),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, 52),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16, letterSpacing: 0.6),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 52),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: dark ? const Color(0xFF151A21) : Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: dark ? const Color(0xFF262D37) : const Color(0xFFE2DED6)),
      ),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: scheme.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: dark ? const Color(0xFF262D37) : const Color(0xFFE2DED6)),
      ),
      margin: EdgeInsets.zero,
    ),
    navigationBarTheme: NavigationBarThemeData(
      height: 72,
      elevation: 0,
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      shadowColor: Colors.transparent,
      indicatorColor: Palette.brand.withValues(alpha: 0.14),
      labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return TextStyle(
          fontSize: 12,
          fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
          letterSpacing: 0.1,
          color: selected ? Palette.brand : scheme.onSurfaceVariant,
        );
      }),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return IconThemeData(
          size: 24,
          color: selected ? Palette.brand : scheme.onSurfaceVariant,
        );
      }),
    ),
  );
}
