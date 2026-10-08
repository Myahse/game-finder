import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../core/pick_image.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/friend_invite.dart';
import '../core/env.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/notifications.dart';
import '../ui/theme.dart';
import '../ui/app_icons.dart';
import '../ui/apple_button.dart';
import '../ui/extra_sports_picker.dart';
import '../ui/platform_intro.dart';
import '../ui/google_button.dart';
import '../ui/widgets.dart';
import 'legal_screens.dart';
import '../core/l10n.dart';

class SplashScreen extends StatelessWidget {
  final String? status;
  const SplashScreen({super.key, this.status});
  @override
  Widget build(BuildContext context) => AnnotatedRegion<SystemUiOverlayStyle>(
        value: systemBarsFor(Brightness.dark), // light icons on the night background
        child: Scaffold(
          backgroundColor: Palette.night,
          body: Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(kNeutralSportIcon, size: 72, color: Palette.brand), // sport-neutral: no user yet
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
              Text(tr('CAN\'T REACH THE SERVER', 'SERVEUR INJOIGNABLE'), style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text(
                tr('Start Docker on your PC: docker compose up -d db api\nPhone and PC must be on the same Wi‑Fi.',
                    'Lancez Docker sur votre PC : docker compose up -d db api\nLe téléphone et le PC doivent être sur le même Wi‑Fi.'),
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _url,
                decoration: InputDecoration(labelText: tr('API URL', 'URL de l’API'), hintText: 'http://192.168.1.10:8080'),
                keyboardType: TextInputType.url,
                autocorrect: false,
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _busy ? null : _saveAndRetry,
                child: _busy ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2)) : Text(tr('TRY AGAIN', 'RÉESSAYER')),
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
    // Keeps the sheet below the status bar / Dynamic Island when the keyboard
    // pushes it up on short phones; its content scrolls instead.
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    useRootNavigator: true,
    builder: (ctx) => const _LoginSheet(),
  );
}

class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});
  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  @override
  void initState() {
    super.initState();
    // First launch: what the app is for, in three steps (once).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) maybeShowGuestIntro(context);
    });
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: systemBarsFor(Brightness.dark), // light icons on the night background
      child: Scaffold(
        backgroundColor: Palette.night,
        // The login sheet's keyboard must not squeeze this screen behind the sheet.
        resizeToAvoidBottomInset: false,
        body: SafeArea(
          child: _FillOrScroll(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const Spacer(),
              Row(children: [
                Container(width: 10, height: 10, decoration: const BoxDecoration(color: Palette.live, shape: BoxShape.circle)),
                const SizedBox(width: 8),
                Text(tr('Games happening near you right now', 'Des matchs près de vous en ce moment'),
                    style: const TextStyle(color: Color(0xFF9AA3AE), fontWeight: FontWeight.w600)),
              ]),
              const SizedBox(height: 16),
              const _Wordmark(size: 72),
              const SizedBox(height: 20),
              Text.rich(TextSpan(children: [
                TextSpan(text: '${tr("Don't search for a court.", 'Ne cherchez pas un terrain.')}\n'),
                TextSpan(text: tr('Find the game.', 'Trouvez le match.'), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
              ]), style: const TextStyle(color: Color(0xFFC9CED6), fontSize: 20, height: 1.35)),
              const SizedBox(height: 40),
              const AppleSignInButton(onDark: true),
              const SizedBox(height: 12),
              const GoogleSignInButton(onDark: true),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const RegisterScreen())),
                child: Text(tr('CREATE ACCOUNT', 'CRÉER UN COMPTE')),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white24)),
                onPressed: () => showLoginSheet(context),
                child: Text(tr('LOG IN', 'SE CONNECTER')),
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  TextButton(
                    onPressed: () => openTerms(context),
                    child: Text(tr('Terms', 'Conditions'), style: const TextStyle(color: Palette.brand)),
                  ),
                  Text('·', style: TextStyle(color: Colors.white38)),
                  TextButton(
                    onPressed: () => openPrivacy(context),
                    child: Text(tr('Privacy', 'Confidentialité'), style: const TextStyle(color: Palette.brand)),
                  ),
                ],
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Fills the viewport (so [Spacer]s work) and scrolls when the content is taller
/// — iPhone SE with the Apple button, or large accessibility text.
class _FillOrScroll extends StatelessWidget {
  final EdgeInsets padding;
  final Widget child;
  const _FillOrScroll({required this.padding, required this.child});

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, box) => SingleChildScrollView(
          padding: padding,
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: box.maxHeight - padding.vertical),
            child: IntrinsicHeight(child: child),
          ),
        ),
      );
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
            Text(tr('LOG IN', 'SE CONNECTER'), style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 4),
            Text(tr('Pick up where you left off on the map.', 'Reprenez là où vous en étiez sur la carte.'), style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
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
              decoration: InputDecoration(labelText: tr('Email or username', 'E-mail ou nom d’utilisateur')),
            ),
            const SizedBox(height: 12),
            PasswordTextField(
              controller: _password,
              labelText: tr('Password', 'Mot de passe'),
              autofillHints: const [AutofillHints.password],
              onSubmitted: (_) => _submit(),
            ),
            const SizedBox(height: 16),
            ErrorBanner(_error),
            FilledButton(onPressed: _busy ? null : _submit, child: Text(_busy ? '…' : tr('LOG IN', 'SE CONNECTER'))),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () {
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(builder: (_) => const RegisterScreen()));
              },
              child: Text(tr('Create an account', 'Créer un compte')),
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
  /// Set when the server wants the email verified before the first sign-in.
  String? _checkEmail;

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
      setState(() => _error = tr('Please accept the Terms and Privacy Policy.', 'Veuillez accepter les Conditions et la Politique de confidentialité.'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final auth = context.read<AuthState>();
    final api = context.read<Api>();
    try {
      final signedIn = await auth.register(
        firstName: _first.text,
        lastName: _last.text,
        username: _username.text,
        email: _email.text,
        password: _password.text,
      );
      if (!signedIn) {
        if (mounted) setState(() => _checkEmail = _email.text.trim());
        return;
      }
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

  String? _required(String? v) => (v == null || v.trim().isEmpty) ? tr('Required', 'Obligatoire') : null;

  Widget _checkEmailView(String email) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    return Scaffold(
      appBar: AppBar(title: Text(tr('CHECK YOUR EMAIL', 'VÉRIFIEZ VOS E-MAILS'))),
      body: ListView(padding: const EdgeInsets.all(24), children: [
        const Icon(Icons.mark_email_unread_outlined, size: 56, color: Palette.brand),
        const SizedBox(height: 16),
        Text.rich(
          TextSpan(children: [
            TextSpan(text: tr('We sent a verification link to ', 'Nous avons envoyé un lien de vérification à ')),
            TextSpan(text: email, style: const TextStyle(fontWeight: FontWeight.w700)),
            TextSpan(text: tr('. Open it, then sign in.', '. Ouvrez-le, puis connectez-vous.')),
          ]),
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 16),
        ),
        const SizedBox(height: 12),
        Text(
          tr('Email sign-up stays available — Google sign-in works too.',
              'L’inscription par e-mail reste disponible — la connexion Google fonctionne aussi.'),
          textAlign: TextAlign.center,
          style: TextStyle(color: muted),
        ),
        const SizedBox(height: 24),
        FilledButton(
          onPressed: () {
            Navigator.pop(context);
            showLoginSheet(context);
          },
          child: Text(tr('GO TO LOG IN', 'ALLER À LA CONNEXION')),
        ),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) => _checkEmail != null
      ? _checkEmailView(_checkEmail!)
      : Scaffold(
        appBar: AppBar(title: Text(tr('CREATE ACCOUNT', 'CRÉER UN COMPTE'))),
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
              Text(_photo == null ? tr('Add profile photo (optional)', 'Ajouter une photo de profil (optionnel)') : tr('Photo selected', 'Photo sélectionnée'),
                  style: const TextStyle(color: Palette.brand, fontWeight: FontWeight.w700)),
            ]),
            const SizedBox(height: 20),
            Row(children: [
              Expanded(child: TextFormField(controller: _first, validator: _required, decoration: InputDecoration(labelText: tr('First name', 'Prénom')))),
              const SizedBox(width: 12),
              Expanded(child: TextFormField(controller: _last, validator: _required, decoration: InputDecoration(labelText: tr('Last name', 'Nom')))),
            ]),
            const SizedBox(height: 12),
            TextFormField(
              controller: _username,
              decoration: InputDecoration(labelText: tr('Username', 'Nom d’utilisateur'), helperText: tr('3–24 letters, numbers, _ or .', '3–24 lettres, chiffres, _ ou .')),
              validator: (v) => RegExp(r'^[A-Za-z0-9_.]{3,24}$').hasMatch(v ?? '') ? null : tr('3–24 letters, numbers, _ or .', '3–24 lettres, chiffres, _ ou .'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(labelText: tr('Email', 'E-mail')),
              validator: (v) => (v ?? '').contains('@') ? null : tr('Enter a valid email.', 'Saisissez une adresse e-mail valide.'),
            ),
            const SizedBox(height: 12),
            PasswordTextField(
              controller: _password,
              labelText: tr('Password', 'Mot de passe'),
              helperText: tr('At least 8 characters.', 'Au moins 8 caractères.'),
              validator: (v) => (v ?? '').length >= 8 ? null : tr('At least 8 characters.', 'Au moins 8 caractères.'),
            ),
            const SizedBox(height: 8),
            CheckboxListTile(
              value: _agreedTerms,
              onChanged: (v) => setState(() => _agreedTerms = v ?? false),
              controlAffinity: ListTileControlAffinity.leading,
              contentPadding: EdgeInsets.zero,
              title: Text(tr('I agree to the Terms and Privacy Policy.', 'J’accepte les Conditions et la Politique de confidentialité.')),
              subtitle: Wrap(
                spacing: 4,
                children: [
                  TextButton(
                    onPressed: () => openTerms(context),
                    child: Text(tr('Read Terms', 'Lire les Conditions')),
                  ),
                  TextButton(
                    onPressed: () => openPrivacy(context),
                    child: Text(tr('Read Privacy', 'Lire la Confidentialité')),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            ErrorBanner(_error),
            FilledButton(onPressed: _busy || !_agreedTerms ? null : _submit, child: Text(_busy ? '…' : tr('CREATE ACCOUNT', 'CRÉER UN COMPTE'))),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () {
                Navigator.pop(context);
                showLoginSheet(context);
              },
              child: Text(tr('Already playing? Log in', 'Déjà inscrit ? Se connecter')),
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
  List<String> _extra = [];
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
    _extra = [...user.extraSportIds];
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
        setState(() => _error = tr('Pick a sport to continue.', 'Choisissez un sport pour continuer.'));
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
    final api = context.read<Api>();
    try {
      await context.read<AuthState>().updateMe({
        'first_name': _first.text.trim(),
        'last_name': _last.text.trim(),
        'username': _username.text.trim(),
        'preferred_sport_id': sportId,
        'extra_sport_ids': [for (final id in _extra) if (id != sportId) id],
        'skill_level': _skill,
        'onboarded': true,
      });
      // A friend invite opened before signing up (web OnboardingPage).
      await PendingFriendInvite.acceptPending(api);
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
                Text(tr('Welcome, ${user?.firstName ?? ''}', 'Bienvenue, ${user?.firstName ?? ''}'), style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                Text(tr('SET UP YOUR COURT RADAR', 'CONFIGUREZ VOTRE RADAR'), style: Theme.of(context).textTheme.displaySmall),
                const SizedBox(height: 12),
                _onboardingDots(),
                const SizedBox(height: 6),
                Text(
                  tr('Step ${_step + 1} of $_steps', 'Étape ${_step + 1} sur $_steps'),
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
                          title: tr('YOUR PROFILE', 'VOTRE PROFIL'),
                          subtitle: tr('How other players will see you.', 'Comment les autres joueurs vous verront.'),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Row(children: [
                                Expanded(child: TextFormField(controller: _first, decoration: InputDecoration(labelText: tr('First name', 'Prénom')), validator: _required)),
                                const SizedBox(width: 12),
                                Expanded(child: TextFormField(controller: _last, decoration: InputDecoration(labelText: tr('Last name', 'Nom')), validator: _required)),
                              ]),
                              const SizedBox(height: 12),
                              TextFormField(
                                controller: _username,
                                decoration: InputDecoration(
                                  labelText: tr('Username', 'Nom d’utilisateur'),
                                  helperText: _usernameTaken ? tr('That username is taken.', 'Ce nom d’utilisateur est pris.') : tr('3–24 letters, numbers, _ or .', '3–24 lettres, chiffres, _ ou .'),
                                  helperStyle: TextStyle(color: _usernameTaken ? Theme.of(context).colorScheme.error : null),
                                ),
                                onChanged: (_) => setState(() => _usernameTaken = false),
                                onEditingComplete: _checkUsername,
                                validator: (v) => _usernameRe.hasMatch(v ?? '') ? null : tr('3–24 letters, numbers, _ or .', '3–24 lettres, chiffres, _ ou .'),
                              ),
                              if (user != null && user.email.isNotEmpty) ...[
                                const SizedBox(height: 8),
                                Text(tr('Email: ${user.email}', 'E-mail : ${user.email}'), style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 13)),
                              ],
                            ],
                          ),
                        ),
                        _stepPanel(
                          title: tr('YOUR SPORT', 'VOTRE SPORT'),
                          subtitle: tr('This becomes your main sport. You can add others on the next step, but this one stays.',
                              'Ce sera votre sport principal. Vous pourrez en ajouter d\'autres ensuite, mais celui-ci reste.'),
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
                                    onTap: () => setState(() {
                                      _sportId = s.id;
                                      _extra = [for (final x in _extra) if (x != s.id) x];
                                    }),
                                  ),
                                ),
                              if (soon.isNotEmpty)
                                Wrap(
                                  spacing: 10,
                                  runSpacing: 6,
                                  crossAxisAlignment: WrapCrossAlignment.center,
                                  children: [
                                    Text(tr('Coming soon:', 'Bientôt :'), style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                                    for (final s in soon) SportInline(s, iconSize: 14, textStyle: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                                  ],
                                ),
                            ],
                          ),
                        ),
                        _stepPanel(
                          title: tr('YOUR LEVEL', 'VOTRE NIVEAU'),
                          subtitle: tr('Games use this as a guide for who joins.', 'Les matchs s’en servent pour indiquer qui peut rejoindre.'),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              if (_sportId != null && active.length > 1) ...[
                                ExtraSportsPicker(
                                  sports: active,
                                  mainSportId: _sportId,
                                  selected: _extra,
                                  onChanged: (v) => setState(() => _extra = v),
                                  title: tr('Also play these? (optional)', 'Vous jouez aussi à… ? (optionnel)'),
                                  hint: tr('Up to 2. They show up as filters on the map.', 'Jusqu\'à 2. Ils apparaissent comme filtres sur la carte.'),
                                ),
                                const SizedBox(height: 16),
                                Text(tr('Skill level', 'Niveau'), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                                const SizedBox(height: 8),
                              ],
                              Wrap(spacing: 8, runSpacing: 8, children: [
                                for (final e in skillLabels.entries)
                                  ChoiceTile(label: e.value, selected: _skill == e.key, onTap: () => setState(() => _skill = e.key)),
                              ]),
                              const SizedBox(height: 12),
                              Text(
                                tr('Turn on location on the map for distances and nearby alerts.', 'Activez la localisation sur la carte pour les distances et alertes.'),
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
                        child: OutlinedButton(onPressed: _busy ? null : _back, child: Text(tr('Back', 'Retour'))),
                      ),
                    if (_step > 0) const SizedBox(width: 12),
                    Expanded(
                      flex: _step == 0 ? 1 : 1,
                      child: PrimaryButton(
                        onPressed: _busy || !_canAdvance() ? null : _next,
                        child: Text(_busy ? '…' : (_step < _steps - 1 ? tr('Next', 'Suivant') : tr('OPEN THE MAP', 'OUVRIR LA CARTE'))),
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

  String? _required(String? v) => (v == null || v.trim().isEmpty) ? tr('Required', 'Obligatoire') : null;
}
