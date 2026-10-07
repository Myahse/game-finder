import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

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

/// Bundled UI font (assets/fonts, same as the web app). Without it iOS draws
/// SF Pro and Android Roboto, so copy wraps and widths differ between phones.
const kFontFamily = 'Inter';

/// Status/navigation bar icons for a screen of brightness [b]: transparent bars
/// and readable icons on both platforms (iOS reads statusBarBrightness, Android
/// the *IconBrightness fields).
SystemUiOverlayStyle systemBarsFor(Brightness b) {
  final dark = b == Brightness.dark;
  return SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarBrightness: b, // iOS: brightness of the content under the bar
    statusBarIconBrightness: dark ? Brightness.light : Brightness.dark,
    systemNavigationBarColor: Colors.transparent,
    systemNavigationBarDividerColor: Colors.transparent,
    systemNavigationBarIconBrightness: dark ? Brightness.light : Brightness.dark,
    systemNavigationBarContrastEnforced: false,
  );
}

/// Default bar style for screens without an AppBar (AppBars set their own).
Widget withSystemBars(BuildContext context, Widget? child) => AnnotatedRegion<SystemUiOverlayStyle>(
      value: systemBarsFor(Theme.of(context).brightness),
      child: child ?? const SizedBox.shrink(),
    );

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
  final base = ThemeData(useMaterial3: true, colorScheme: scheme, brightness: b, fontFamily: kFontFamily);
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
      // Flutter centres titles on iOS only; pick one layout for both platforms.
      centerTitle: false,
      systemOverlayStyle: systemBarsFor(b),
      titleTextStyle: base.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900, color: scheme.onSurface),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, 52),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontFamily: kFontFamily, fontWeight: FontWeight.w900, fontSize: 16, letterSpacing: 0.6),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 52),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontFamily: kFontFamily, fontWeight: FontWeight.w800, fontSize: 15),
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
          fontFamily: kFontFamily,
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
