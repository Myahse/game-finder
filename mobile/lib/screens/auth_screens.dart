import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});
  @override
  Widget build(BuildContext context) => const Scaffold(
        backgroundColor: Palette.night,
        body: Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text('🏀', style: TextStyle(fontSize: 64)),
            SizedBox(height: 12),
            _Wordmark(size: 40),
          ]),
        ),
      );
}

class _Wordmark extends StatelessWidget {
  final double size;
  const _Wordmark({required this.size});
  @override
  Widget build(BuildContext context) => Text.rich(
        TextSpan(children: [
          const TextSpan(text: 'FIND THE\n', style: TextStyle(color: Colors.white)),
          const TextSpan(text: 'GAME', style: TextStyle(color: Palette.brand)),
        ]),
        style: TextStyle(fontSize: size, fontWeight: FontWeight.w900, height: 0.95, letterSpacing: -1),
      );
}

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Palette.night,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Spacer(),
            Row(children: [
              Container(width: 10, height: 10, decoration: const BoxDecoration(color: Palette.live, shape: BoxShape.circle)),
              const SizedBox(width: 8),
              const Text('Games happening near you right now',
                  style: TextStyle(color: Color(0xFF9AA3AE), fontWeight: FontWeight.w600)),
            ]),
            const SizedBox(height: 16),
            const _Wordmark(size: 72),
            const SizedBox(height: 20),
            const Text.rich(TextSpan(children: [
              TextSpan(text: "Don't search for a court.\n"),
              TextSpan(text: 'Find the game.', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
            ]), style: TextStyle(color: Color(0xFFC9CED6), fontSize: 20, height: 1.35)),
            const SizedBox(height: 40),
            FilledButton(
              onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const RegisterScreen())),
              child: const Text('CREATE ACCOUNT'),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white24)),
              onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const LoginScreen())),
              child: const Text('LOG IN'),
            ),
          ]),
        ),
      ),
    );
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  String? _error;
  bool _busy = false;

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<AuthState>().login(_email.text, _password.text);
      if (mounted) Navigator.of(context).popUntil((r) => r.isFirst);
    } catch (e) {
      setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('LOG IN')),
        body: ListView(padding: const EdgeInsets.all(20), children: [
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            autofillHints: const [AutofillHints.email],
            decoration: const InputDecoration(labelText: 'Email'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _password,
            obscureText: true,
            autofillHints: const [AutofillHints.password],
            decoration: const InputDecoration(labelText: 'Password'),
            onSubmitted: (_) => _submit(),
          ),
          const SizedBox(height: 16),
          ErrorBanner(_error),
          FilledButton(onPressed: _busy ? null : _submit, child: Text(_busy ? '…' : 'LOG IN')),
        ]),
      );
}

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _form = GlobalKey<FormState>();
  final _first = TextEditingController();
  final _last = TextEditingController();
  final _username = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  XFile? _photo;
  String? _error;
  bool _busy = false;

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final auth = context.read<AuthState>();
    final api = context.read<Api>();
    try {
      await auth.register(
        firstName: _first.text,
        lastName: _last.text,
        username: _username.text,
        email: _email.text,
        password: _password.text,
      );
      if (_photo != null) {
        try {
          final url = await api.upload(await _photo!.readAsBytes(), _photo!.name, 'avatar');
          await auth.updateMe({'avatar_url': url});
        } catch (_) {} // optional; they can add it later from Profile
      }
      if (mounted) Navigator.of(context).popUntil((r) => r.isFirst);
    } catch (e) {
      setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String? _required(String? v) => (v == null || v.trim().isEmpty) ? 'Required' : null;

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('CREATE ACCOUNT')),
        body: Form(
          key: _form,
          child: ListView(padding: const EdgeInsets.all(20), children: [
            Row(children: [
              GestureDetector(
                onTap: () async {
                  final f = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1024, imageQuality: 85);
                  if (f != null) setState(() => _photo = f);
                },
                child: CircleAvatar(
                  radius: 32,
                  backgroundColor: Palette.brand.withValues(alpha: 0.15),
                  child: Icon(_photo == null ? Icons.add_a_photo_outlined : Icons.check, color: Palette.brand),
                ),
              ),
              const SizedBox(width: 14),
              Text(_photo == null ? 'Add profile photo (optional)' : 'Photo selected',
                  style: const TextStyle(color: Palette.brand, fontWeight: FontWeight.w700)),
            ]),
            const SizedBox(height: 20),
            Row(children: [
              Expanded(child: TextFormField(controller: _first, validator: _required, decoration: const InputDecoration(labelText: 'First name'))),
              const SizedBox(width: 12),
              Expanded(child: TextFormField(controller: _last, validator: _required, decoration: const InputDecoration(labelText: 'Last name'))),
            ]),
            const SizedBox(height: 12),
            TextFormField(
              controller: _username,
              decoration: const InputDecoration(labelText: 'Username', helperText: '3–24 letters, numbers, _ or .'),
              validator: (v) => RegExp(r'^[A-Za-z0-9_.]{3,24}$').hasMatch(v ?? '') ? null : '3–24 letters, numbers, _ or .',
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Email'),
              validator: (v) => (v ?? '').contains('@') ? null : 'Enter a valid email',
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _password,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Password', helperText: 'At least 8 characters'),
              validator: (v) => (v ?? '').length >= 8 ? null : 'At least 8 characters',
            ),
            const SizedBox(height: 16),
            ErrorBanner(_error),
            FilledButton(onPressed: _busy ? null : _submit, child: Text(_busy ? '…' : 'CREATE ACCOUNT')),
          ]),
        ),
      );
}

/// Profile setup: preferred sport + level.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});
  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  List<Sport>? _sports;
  String? _sportId;
  String _skill = 'intermediate';
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    context.read<Api>().get('/api/sports').then((j) {
      if (!mounted) return;
      setState(() => _sports = [for (final s in j) Sport.fromJson(s)]);
    }).catchError((Object e) {
      if (mounted) setState(() => _error = errorText(e));
    });
  }

  Future<void> _done(String sportId) async {
    setState(() => _busy = true);
    try {
      await context.read<AuthState>().updateMe({'preferred_sport_id': sportId, 'skill_level': _skill, 'onboarded': true});
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthState>().user;
    final active = _sports?.where((s) => s.active).toList() ?? const <Sport>[];
    final soon = _sports?.where((s) => !s.active).toList() ?? const <Sport>[];
    final chosen = _sportId ?? (active.isNotEmpty ? active.first.id : null);
    return Scaffold(
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.all(24), children: [
          Text('Welcome, ${user?.firstName ?? ''}', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
          Text('WHAT DO YOU PLAY?', style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 20),
          if (_sports == null && _error == null) const Center(child: CircularProgressIndicator()),
          for (final s in active)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: ChoiceTile(label: '${s.icon}  ${s.name.toUpperCase()}', selected: chosen == s.id, onTap: () => setState(() => _sportId = s.id)),
            ),
          if (soon.isNotEmpty)
            Text('Coming soon: ${soon.map((s) => '${s.icon} ${s.name}').join(' · ')}',
                style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
          const SizedBox(height: 28),
          Text('YOUR LEVEL', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 10),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final e in skillLabels.entries)
              ChoiceTile(label: e.value, selected: _skill == e.key, onTap: () => setState(() => _skill = e.key)),
          ]),
          const SizedBox(height: 32),
          ErrorBanner(_error),
          FilledButton(
            onPressed: _busy || chosen == null ? null : () => _done(chosen),
            child: const Text("LET'S PLAY"),
          ),
        ]),
      ),
    );
  }
}
