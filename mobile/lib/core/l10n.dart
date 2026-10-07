import 'dart:ui' show PlatformDispatcher;

/// Forces 'en' or 'fr' (tests); null = follow the device.
String? debugLanguageOverride;

/// Device language: French when the phone is in French, English otherwise.
String get deviceLanguage =>
    debugLanguageOverride ?? (PlatformDispatcher.instance.locale.languageCode == 'fr' ? 'fr' : 'en');

bool get isFrench => deviceLanguage == 'fr';

/// Picks the string for the device language.
String tr(String en, String fr) => isFrench ? fr : en;
