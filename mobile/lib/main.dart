import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/api.dart';
import 'core/auth.dart';
import 'core/location.dart';
import 'core/notifications.dart';
import 'core/presence.dart';
import 'core/realtime.dart';
import 'screens/auth_screens.dart';
import 'screens/home_shell.dart';
import 'ui/theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final auth = context.read<AuthState>();
      if (auth.user != null) await auth.refreshMe();
      await Future<void>.delayed(const Duration(milliseconds: 600)); // let the splash breathe
      if (mounted) setState(() => _booting = false);
    });
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
    if (_booting) return const SplashScreen();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _syncServices(user?.id);
    });
    if (user == null) return const WelcomeScreen();
    if (!user.onboarded) return const OnboardingScreen();
    return const HomeShell();
  }
}
