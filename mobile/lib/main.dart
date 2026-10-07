import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';

import 'core/api.dart';
import 'core/api_bootstrap.dart';
import 'core/env.dart';
import 'core/firebase_bootstrap.dart';
import 'core/l10n.dart';
import 'core/mapbox_init.dart';
import 'core/monitoring.dart';
import 'core/auth.dart';
import 'core/location.dart';
import 'core/map_pause.dart';
import 'core/notifications.dart';
import 'core/presence.dart';
import 'core/realtime.dart';
import 'screens/auth_screens.dart';
import 'screens/home_shell.dart';
import 'ui/theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  initMonitoring();
  // French day/month names for DateFormat (see localDateFormat in format.dart).
  try {
    await initializeDateFormatting(deviceLanguage == 'fr' ? 'fr' : 'en');
  } catch (_) {}
  await loadAppEnv();
  await ensureFirebaseApp();
  initMapboxAccessToken();
  if (kDebugMode) {
    debugPrint('Find the Game API_URL=$apiUrl mapbox=${mapboxAccessToken.isNotEmpty}');
  }
  final api = Api();
  await api.load();
  final notifications = Notifications(api);
  await notifications.init();

  runApp(MultiProvider(
    providers: [
      ChangeNotifierProvider.value(value: api),
      Provider.value(value: notifications),
      ChangeNotifierProvider(create: (_) => AuthState(api)),
      ChangeNotifierProvider(create: (_) => Realtime(api)),
      ChangeNotifierProvider(create: (_) => LocationState()),
      ChangeNotifierProvider(create: (_) => PresenceState(api, notifications)),
      ChangeNotifierProvider(create: (_) => MapPause()),
    ],
    child: const FindTheGameApp(),
  ));
}

class FindTheGameApp extends StatelessWidget {
  const FindTheGameApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Find the Game',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(Brightness.light),
      darkTheme: buildTheme(Brightness.dark),
      themeMode: ThemeMode.system,
      home: const RootGate(),
    );
  }
}

/// Splash → Welcome → (Register/Login) → Profile setup → Home.
class RootGate extends StatefulWidget {
  const RootGate({super.key});
  @override
  State<RootGate> createState() => _RootGateState();
}

class _RootGateState extends State<RootGate> {
  bool _booting = true;
  String? _sessionUser = '';
  String _bootStatus = tr('Connecting to server…', 'Connexion au serveur…');
  AuthState? _auth;
  bool _authListenerAttached = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _boot());
  }

  void _attachAuthListener() {
    if (_authListenerAttached || !mounted) return;
    _auth = context.read<AuthState>();
    _auth!.addListener(_onAuthChanged);
    _authListenerAttached = true;
    _syncServices(_auth!.user?.id);
  }

  void _onAuthChanged() {
    if (!mounted) return;
    _syncServices(_auth?.user?.id);
  }

  @override
  void dispose() {
    _auth?.removeListener(_onAuthChanged);
    super.dispose();
  }

  Future<void> _boot() async {
    setState(() => _bootStatus = tr('Connecting to server…', 'Connexion au serveur…'));
    await ensureApiReachable();
    if (!mounted) return;
    if (!apiReachable) {
      setState(() => _booting = false);
      return;
    }
    context.read<Realtime>().start();
    setState(() => _bootStatus = tr('Loading…', 'Chargement…'));
    final auth = context.read<AuthState>();
    if (auth.user != null) await auth.refreshMe();
    await Future<void>.delayed(const Duration(milliseconds: 400));
    if (mounted) {
      setState(() => _booting = false);
      _attachAuthListener();
    }
  }

  Future<void> _retryServer() async {
    setState(() {
      _booting = true;
      _bootStatus = tr('Connecting to server…', 'Connexion au serveur…');
    });
    await _boot();
  }

  /// Start/stop session-scoped services when the signed-in user changes.
  void _syncServices(String? userId) {
    if (_sessionUser == userId) return;
    _sessionUser = userId;
    final presence = context.read<PresenceState>();
    context.read<Realtime>().restart();
    if (userId != null) {
      context.read<LocationState>().start();
      presence.refresh();
      final n = context.read<Notifications>();
      n.requestPermission().then((_) => n.registerDevice());
    } else {
      presence.clear();
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthState>().user;
    if (_booting) return SplashScreen(status: _bootStatus);
    if (!apiReachable) {
      return ServerConnectScreen(apiUrl: apiUrl, onRetry: _retryServer);
    }
    if (!_authListenerAttached) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _attachAuthListener());
    }
    if (user == null) return const WelcomeScreen();
    if (!user.onboarded) return const OnboardingScreen();
    return const HomeShell();
  }
}
