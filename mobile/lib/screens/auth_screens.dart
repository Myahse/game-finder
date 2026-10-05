import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../core/pick_image.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/env.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/notifications.dart';
import '../ui/theme.dart';
import '../ui/app_icons.dart';
import '../ui/apple_button.dart';
import '../ui/google_button.dart';
import '../ui/widgets.dart';
import 'legal_screens.dart';

class SplashScreen extends StatelessWidget {
  final String? status;
  const SplashScreen({super.key, this.status});
  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Palette.night,
        body: Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.sports_basketball, size: 72, color: Palette.brand),
            const SizedBox(height: 12),
            const _Wordmark(size: 40),
            if (status != null) ...[
              const SizedBox(height: 28),
              Text(status!, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.white70)),
              const SizedBox(height: 16),
              const SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 2, color: Palette.brand)),
            ],
          ]),
        ),
      );
}

/// Shown when the API cannot be reached after startup discovery.
class ServerConnectScreen extends StatefulWidget {
  final String apiUrl;
  final Future<void> Function() onRetry;

  const ServerConnectScreen({super.key, required this.apiUrl, required this.onRetry});

  @override
  State<ServerConnectScreen> createState() => _ServerConnectScreenState();
}

class _ServerConnectScreenState extends State<ServerConnectScreen> {
  late final TextEditingController _url;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _url = TextEditingController(text: widget.apiUrl);
  }

  @override
  void dispose() {
    _url.dispose();
    super.dispose();
  }

  Future<void> _saveAndRetry() async {
    setApiUrl(_url.text);
    setState(() => _busy = true);
    try {
      await widget.onRetry();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              const Icon(Icons.wifi_off, size: 56, color: Palette.brand),
              const SizedBox(height: 16),
              Text('CAN\'T REACH THE SERVER', style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text(
                'Start Docker on your PC: docker compose up -d db api\n'
                'Phone and PC must be on the same Wi‑Fi.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _url,
                decoration: const InputDecoration(labelText: 'API URL', hintText: 'http://192.168.1.10:8080'),
                keyboardType: TextInputType.url,
                autocorrect: false,
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _busy ? null : _saveAndRetry,
                child: _busy ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('TRY AGAIN'),
              ),
              const Spacer(flex: 2),
            ],
          ),
        ),
      ),
    );
  }
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

void showLoginSheet(BuildContext context) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    useRootNavigator: true,
    builder: (ctx) => const _LoginSheet(),
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
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
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
            const AppleSignInButton(onDark: true),
            const SizedBox(height: 12),
            const GoogleSignInButton(onDark: true),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const RegisterScreen())),
              child: const Text('CREATE ACCOUNT'),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white24)),
              onPressed: () => showLoginSheet(context),
              child: const Text('LOG IN'),
            ),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                TextButton(
                  onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => LegalTextScreen(title: 'Terms', sections: termsSections))),
                  child: const Text('Terms', style: TextStyle(color: Palette.brand)),
                ),
                Text('·', style: TextStyle(color: Colors.white38)),
                TextButton(
                  onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => LegalTextScreen(title: 'Privacy', sections: privacySections))),
                  child: const Text('Privacy', style: TextStyle(color: Palette.brand)),
                ),
              ],
            ),
          ]),
        ),
      ),
    );
  }
}

class _LoginSheet extends StatefulWidget {
  const _LoginSheet();

  @override
  State<_LoginSheet> createState() => _LoginSheetState();
}

class _LoginSheetState extends State<_LoginSheet> {
  final _login = TextEditingController();
  final _password = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _login.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<AuthState>().login(_login.text, _password.text);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    final safe = MediaQuery.paddingOf(context).bottom;
    return AnimatedPadding(
      padding: EdgeInsets.only(bottom: keyboard),
      duration: const Duration(milliseconds: 120),
      curve: Curves.easeOut,
      child: Container(
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: EdgeInsets.fromLTRB(20, 12, 20, 24 + (keyboard > 0 ? 8 : safe)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
            Center(
              child: Container(
                width: 40,
                height: 5,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(color: Theme.of(context).dividerColor, borderRadius: BorderRadius.circular(99)),
              ),
            ),
            Text('LOG IN', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 4),
            Text('Pick up where you left off on the map.', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
            const SizedBox(height: 20),
            AppleSignInButton(onDark: Theme.of(context).brightness == Brightness.dark),
            const SizedBox(height: 12),
            GoogleSignInButton(onDark: Theme.of(context).brightness == Brightness.dark),
            const SizedBox(height: 16),
            TextField(
              controller: _login,
              keyboardType: TextInputType.text,
              autofillHints: const [AutofillHints.username],
              textCapitalization: TextCapitalization.none,
              autocorrect: false,
              decoration: const InputDecoration(labelText: 'Email or username'),
            ),
            const SizedBox(height: 12),
            PasswordTextField(
              controller: _password,
              labelText: 'Password',
              autofillHints: const [AutofillHints.password],
              onSubmitted: (_) => _submit(),
            ),
            const SizedBox(height: 16),
            ErrorBanner(_error),
            FilledButton(onPressed: _busy ? null : _submit, child: Text(_busy ? '…' : 'LOG IN')),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () {
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(builder: (_) => const RegisterScreen()));
              },
              child: const Text('Create an account'),
            ),
          ]),
        ),
      ),
    );
  }
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
  bool _agreedTerms = false;

  @override
  void dispose() {
    _first.dispose();
    _last.dispose();
    _username.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    if (!_agreedTerms) {
      setState(() => _error = 'Please accept the Terms and Privacy Policy.');
      return;
    }
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
        } catch (_) {}
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
                  final f = await pickImageFile(context, maxWidth: 1024, imageQuality: 85);
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
            PasswordTextField(
              controller: _password,
              labelText: 'Password',
              helperText: 'At least 8 characters',
              validator: (v) => (v ?? '').length >= 8 ? null : 'At least 8 characters',
            ),
            const SizedBox(height: 8),
            CheckboxListTile(
              value: _agreedTerms,
              onChanged: (v) => setState(() => _agreedTerms = v ?? false),
              controlAffinity: ListTileControlAffinity.leading,
              contentPadding: EdgeInsets.zero,
              title: const Text('I agree to the Terms and Privacy Policy.'),
              subtitle: Wrap(
                spacing: 4,
                children: [
                  TextButton(
                    onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => LegalTextScreen(title: 'Terms', sections: termsSections))),
                    child: const Text('Read Terms'),
                  ),
                  TextButton(
                    onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => LegalTextScreen(title: 'Privacy', sections: privacySections))),
                    child: const Text('Read Privacy'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            ErrorBanner(_error),
            FilledButton(onPressed: _busy || !_agreedTerms ? null : _submit, child: Text(_busy ? '…' : 'CREATE ACCOUNT')),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () {
                Navigator.pop(context);
                showLoginSheet(context);
              },
              child: const Text('Already playing? Log in'),
            ),
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
  static const _steps = 3;
  static final _usernameRe = RegExp(r'^[A-Za-z0-9_.]{3,24}$');

  final _formKey = GlobalKey<FormState>();
  final _page = PageController();
  final _first = TextEditingController();
  final _last = TextEditingController();
  final _username = TextEditingController();
  List<Sport>? _sports;
  String? _sportId;
  String _skill = 'intermediate';
  int _step = 0;
  String? _error;
  bool _busy = false;
  bool _usernameTaken = false;
  String? _initialUsername;
  bool _profileSeeded = false;

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

  @override
  void dispose() {
    _page.dispose();
    _first.dispose();
    _last.dispose();
    _username.dispose();
    super.dispose();
  }

  void _seedProfile(Me? user) {
    if (user == null || _profileSeeded) return;
    _profileSeeded = true;
    _initialUsername = user.username;
    _first.text = user.firstName;
    _last.text = user.lastName;
    _username.text = user.username;
  }

  int _usernameCheckGen = 0;

  Future<void> _checkUsername() async {
    final u = _username.text.trim();
    if (!_usernameRe.hasMatch(u)) {
      if (mounted) setState(() => _usernameTaken = false);
      return;
    }
    if (_initialUsername != null && u.toLowerCase() == _initialUsername!.toLowerCase()) {
      if (mounted) setState(() => _usernameTaken = false);
      return;
    }
    final gen = ++_usernameCheckGen;
    try {
      final j = Map<String, dynamic>.from(
        await context.read<Api>().get('/api/auth/username-available?username=${Uri.encodeComponent(u)}'),
      );
      if (!mounted || gen != _usernameCheckGen) return;
      setState(() => _usernameTaken = j['available'] != true);
    } catch (_) {
      if (mounted && gen == _usernameCheckGen) setState(() => _usernameTaken = false);
    }
  }

  bool _profileValid() =>
      _first.text.trim().isNotEmpty &&
      _last.text.trim().isNotEmpty &&
      _usernameRe.hasMatch(_username.text.trim()) &&
      !_usernameTaken;

  bool _canAdvance() {
    switch (_step) {
      case 0:
        return _profileValid();
      case 1:
        return _sportId != null;
      case 2:
        return _sportId != null && _profileValid();
      default:
        return false;
    }
  }

  Future<void> _back() async {
    if (_step == 0) {
      Navigator.pop(context);
      return;
    }
    setState(() {
      _error = null;
      _step--;
    });
    await _page.previousPage(duration: const Duration(milliseconds: 280), curve: Curves.easeOutCubic);
  }

  Future<void> _next() async {
    setState(() => _error = null);
    if (_step == 0) {
      if (!_formKey.currentState!.validate()) return;
      await _checkUsername();
      if (_usernameTaken) return;
    } else if (_step == 1) {
      if (_sportId == null) {
        setState(() => _error = 'Pick a sport to continue.');
        return;
      }
    } else {
      await _done(_sportId!);
      return;
    }
    setState(() => _step++);
    await _page.nextPage(duration: const Duration(milliseconds: 280), curve: Curves.easeOutCubic);
  }

  Future<void> _done(String sportId) async {
    if (!_formKey.currentState!.validate() || _usernameTaken) return;
    setState(() => _busy = true);
    try {
      await context.read<AuthState>().updateMe({
        'first_name': _first.text.trim(),
        'last_name': _last.text.trim(),
        'username': _username.text.trim(),
        'preferred_sport_id': sportId,
        'skill_level': _skill,
        'onboarded': true,
      });
      if (mounted) await context.read<Notifications>().registerDevice();
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _onboardingDots() => Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(_steps, (i) {
          final active = i == _step;
          final done = i < _step;
          return AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            margin: const EdgeInsets.symmetric(horizontal: 3),
            height: 6,
            width: active ? 28 : (done ? 14 : 14),
            decoration: BoxDecoration(
              color: active ? Palette.brand : (done ? Palette.brand.withValues(alpha: 0.5) : Theme.of(context).dividerColor),
              borderRadius: BorderRadius.circular(99),
            ),
          );
        }),
      );

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthState>().user;
    _seedProfile(user);
    final active = _sports?.where((s) => s.active).toList() ?? const <Sport>[];
    final soon = _sports?.where((s) => !s.active).toList() ?? const <Sport>[];
    return Scaffold(
      appBar: AppBar(leading: BackButton(onPressed: () => _back())),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Welcome, ${user?.firstName ?? ''}', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                Text('SET UP YOUR COURT RADAR', style: Theme.of(context).textTheme.displaySmall),
                const SizedBox(height: 12),
                _onboardingDots(),
                const SizedBox(height: 6),
                Text(
                  'Step ${_step + 1} of $_steps',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Theme.of(context).colorScheme.onSurfaceVariant),
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: Card(
                    margin: EdgeInsets.zero,
                    child: PageView(
                      controller: _page,
                      physics: const NeverScrollableScrollPhysics(),
                      children: [
                        _stepPanel(
                          title: 'YOUR PROFILE',
                          subtitle: 'How other players will see you.',
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Row(children: [
                                Expanded(child: TextFormField(controller: _first, decoration: const InputDecoration(labelText: 'First name'), validator: _required)),
                                const SizedBox(width: 12),
                                Expanded(child: TextFormField(controller: _last, decoration: const InputDecoration(labelText: 'Last name'), validator: _required)),
                              ]),
                              const SizedBox(height: 12),
                              TextFormField(
                                controller: _username,
                                decoration: InputDecoration(
                                  labelText: 'Username',
                                  helperText: _usernameTaken ? 'That username is taken.' : '3–24 letters, numbers, _ or .',
                                  helperStyle: TextStyle(color: _usernameTaken ? Theme.of(context).colorScheme.error : null),
                                ),
                                onChanged: (_) => setState(() => _usernameTaken = false),
                                onEditingComplete: _checkUsername,
                                validator: (v) => _usernameRe.hasMatch(v ?? '') ? null : '3–24 letters, numbers, _ or .',
                              ),
                              if (user != null && user.email.isNotEmpty) ...[
                                const SizedBox(height: 8),
                                Text('Email: ${user.email}', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 13)),
                              ],
                            ],
                          ),
                        ),
                        _stepPanel(
                          title: 'YOUR SPORT',
                          subtitle: 'Pick the one sport you play. The map stays on that sport — it can\'t be changed later.',
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              if (_sports == null && _error == null) const Center(child: CircularProgressIndicator()),
                              for (final s in active)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: ChoiceTile(
                                    leading: SportIcon(s.slug, size: 22, color: Palette.brand),
                                    label: s.name.toUpperCase(),
                                    selected: _sportId == s.id,
                                    onTap: () => setState(() => _sportId = s.id),
                                  ),
                                ),
                              if (soon.isNotEmpty)
                                Wrap(
                                  spacing: 10,
                                  runSpacing: 6,
                                  crossAxisAlignment: WrapCrossAlignment.center,
                                  children: [
                                    Text('Coming soon:', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                                    for (final s in soon) SportInline(s, iconSize: 14, textStyle: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                                  ],
                                ),
                            ],
                          ),
                        ),
                        _stepPanel(
                          title: 'YOUR LEVEL',
                          subtitle: 'Games use this as a guide for who joins.',
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Wrap(spacing: 8, runSpacing: 8, children: [
                                for (final e in skillLabels.entries)
                                  ChoiceTile(label: e.value, selected: _skill == e.key, onTap: () => setState(() => _skill = e.key)),
                              ]),
                              const SizedBox(height: 12),
                              Text(
                                'Turn on location on the map for distances and nearby alerts.',
                                textAlign: TextAlign.center,
                                style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 13),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                ErrorBanner(_error),
                Row(
                  children: [
                    if (_step > 0)
                      Expanded(
                        child: OutlinedButton(onPressed: _busy ? null : _back, child: const Text('Back')),
                      ),
                    if (_step > 0) const SizedBox(width: 12),
                    Expanded(
                      flex: _step == 0 ? 1 : 1,
                      child: PrimaryButton(
                        onPressed: _busy || !_canAdvance() ? null : _next,
                        child: Text(_busy ? '…' : (_step < _steps - 1 ? 'Next' : 'OPEN THE MAP')),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _stepPanel({required String title, required String subtitle, required Widget child}) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(subtitle, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
          const SizedBox(height: 16),
          child,
        ],
      );

  String? _required(String? v) => (v == null || v.trim().isEmpty) ? 'Required' : null;
}
