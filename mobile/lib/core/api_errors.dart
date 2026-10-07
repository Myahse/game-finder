// API error copy, ported from web/src/i18n/screens/errors.ts so both apps word
// errors the same way. The Go API sends English messages; we localize by code.
// Generated from the web tables — keep in sync when codes are added there.

import 'l10n.dart';

typedef _Pair = (String en, String fr);

String _pick(_Pair p) => tr(p.$1, p.$2);

String get genericErrorText => tr('Something went wrong.', 'Une erreur s’est produite.');
String get networkErrorText => tr('Can\'t reach the server. Check your connection.', 'Impossible de joindre le serveur. Vérifiez votre connexion.');
String get invalidValueText => tr('Invalid value.', 'Valeur invalide.');

const Map<String, _Pair> _codes = {
  'not_authenticated': ('Please sign in.', 'Veuillez vous connecter.'),
  'admin_only': ('Admins only.', 'Réservé aux administrateurs.'),
  'not_allowed': ('You can\'t do that.', 'Vous ne pouvez pas faire cela.'),
  'suspended': ('This account is suspended.', 'Ce compte est suspendu.'),
  'invalid_credentials': ('Wrong username, email, or password.', 'Nom d’utilisateur, e-mail ou mot de passe incorrect.'),
  'invalid_refresh_token': ('Session expired. Please sign in again.', 'Session expirée. Veuillez vous reconnecter.'),
  'email_not_verified': ('Verify your email before signing in.', 'Vérifiez votre e-mail avant de vous connecter.'),
  'social_account': ('This account uses Google sign-in. Tap “Continue with Google”, then add a password in your profile to also sign in with your username.', 'Ce compte utilise la connexion Google. Touchez « Continuer avec Google », puis ajoutez un mot de passe dans votre profil pour pouvoir aussi vous connecter avec votre nom d’utilisateur.'),
  'password_registration_disabled': ('Email sign-up is disabled. Use Google sign-in instead.', 'L’inscription par e-mail est désactivée. Utilisez plutôt la connexion Google.'),
  'wrong_password': ('Your current password is wrong.', 'Votre mot de passe actuel est incorrect.'),
  'weak_password': ('Password must be 8–72 characters.', 'Le mot de passe doit contenir entre 8 et 72 caractères.'),
  'invalid_email': ('Enter a valid email.', 'Saisissez une adresse e-mail valide.'),
  'invalid_username': ('Username: 3–24 letters, numbers, _ or .', 'Nom d’utilisateur : 3 à 24 lettres, chiffres, _ ou .'),
  'invalid_first_name': ('Enter your first name.', 'Saisissez votre prénom.'),
  'invalid_last_name': ('Enter your last name.', 'Saisissez votre nom.'),
  'invalid_token': ('This verification link is invalid or expired.', 'Ce lien de vérification est invalide ou a expiré.'),
  'already_exists': ('That already exists.', 'Cela existe déjà.'),
  'google_not_configured': ('Google sign-in isn\'t available.', 'La connexion Google n’est pas disponible.'),
  'firebase_not_configured': ('Sign-in isn\'t available.', 'La connexion n’est pas disponible.'),
  'invalid_google_token': ('Google sign-in failed. Try again.', 'Échec de la connexion Google. Réessayez.'),
  'invalid_firebase_token': ('Sign-in failed. Try again.', 'Échec de la connexion. Réessayez.'),
  'google_email_unverified': ('Your sign-in email isn\'t verified.', 'L’e-mail de votre compte de connexion n’est pas vérifié.'),
  'apple_email_unverified': ('Your Apple account email isn\'t verified.', 'L’e-mail de votre compte Apple n’est pas vérifié.'),
  'oauth_email_required': ('We need an email from your sign-in provider. Try again and allow email sharing.', 'Nous avons besoin d’un e-mail de votre fournisseur de connexion. Réessayez en autorisant le partage de l’e-mail.'),
  'email_password_account': ('An account with this email already uses a password. Sign in with your password first.', 'Un compte avec cet e-mail utilise déjà un mot de passe. Connectez-vous d’abord avec votre mot de passe.'),
  'google_account_mismatch': ('This email is linked to a different Google account. Log in with your password.', 'Cet e-mail est lié à un autre compte Google. Connectez-vous avec votre mot de passe.'),
  'apple_account_mismatch': ('This email is linked to a different Apple ID. Log in with your password.', 'Cet e-mail est lié à un autre identifiant Apple. Connectez-vous avec votre mot de passe.'),
  'cannot_delete_self': ('You can\'t delete your own account here.', 'Vous ne pouvez pas supprimer votre propre compte ici.'),
  'cannot_suspend_self': ('You can\'t suspend yourself.', 'Vous ne pouvez pas vous suspendre vous-même.'),
  'rate_limited': ('Too many requests. Try again in a minute.', 'Trop de requêtes. Réessayez dans une minute.'),
  'bad_request': ('Invalid request body.', 'Corps de requête invalide.'),
  'internal': ('Something went wrong.', 'Une erreur s’est produite.'),
  'server_error': ('Could not save avatar.', 'Impossible d’enregistrer l’avatar.'),
  'not_found': ('Not found.', 'Introuvable.'),
  'invalid': ('Invalid value.', 'Valeur invalide.'),
  'invalid_input': ('Invalid input.', 'Saisie invalide.'),
  'invalid_reference': ('Something referenced doesn\'t exist.', 'Un élément référencé n’existe pas.'),
  'invalid_request': ('Send approve or pending.', 'Envoyez « approve » ou « pending ».'),
  'invalid_status': ('Status must be resolved, rejected or open.', 'Le statut doit être « resolved », « rejected » ou « open ».'),
  'invalid_kind': ('kind must be avatar or court.', 'kind doit valoir « avatar » ou « court ».'),
  'too_long': ('Keep it under 1000 characters.', 'Pas plus de 1000 caractères.'),
  'weather_unavailable': ('Weather is unavailable right now.', 'La météo n’est pas disponible pour le moment.'),
  'user_not_found': ('No player with that username.', 'Aucun joueur avec ce nom d’utilisateur.'),
  'already_friends': ('You\'re already friends with that player.', 'Vous êtes déjà ami avec ce joueur.'),
  'request_pending': ('Friend request already sent.', 'Demande d’ami déjà envoyée.'),
  'invite_not_found': ('This invite link is invalid or expired.', 'Ce lien d’invitation est invalide ou a expiré.'),
  'sport_locked': ('Your sport was set at signup and can\'t be changed.', 'Votre sport a été choisi à l’inscription et ne peut pas être modifié.'),
  'wrong_sport': ('You can only use your chosen sport.', 'Vous ne pouvez utiliser que le sport que vous avez choisi.'),
  'sport_required': ('Choose at least one sport.', 'Choisissez au moins un sport.'),
  'invalid_sport': ('Unknown sport.', 'Sport inconnu.'),
  'too_many_sports': ('You can add up to 2 extra sports.', 'Vous pouvez ajouter jusqu’à 2 sports supplémentaires.'),
  'invalid_option': ('Invalid skill level.', 'Niveau invalide.'),
  'invalid_avatar': ('Invalid avatar configuration.', 'Configuration d’avatar invalide.'),
  'invalid_photo_url': ('Photos must be uploaded through the app.', 'Les photos doivent être importées via l’application.'),
  'file_required': ('Attach an image.', 'Joignez une image.'),
  'too_large': ('Image is too large.', 'L’image est trop volumineuse.'),
  'unsupported_type': ('Use a JPEG, PNG or WebP image.', 'Utilisez une image JPEG, PNG ou WebP.'),
  'upload_storage': ('Upload storage is not available.', 'Le stockage des fichiers n’est pas disponible.'),
  'court_not_found': ('Court not found.', 'Terrain introuvable.'),
  'court_not_available': ('This court isn\'t available.', 'Ce terrain n’est pas disponible.'),
  'court_required': ('Choose a court and sport.', 'Choisissez un terrain et un sport.'),
  'sport_not_offered_at_court': ('That sport isn\'t played at this court.', 'Ce sport ne se pratique pas sur ce terrain.'),
  'too_many_pending_courts': ('You already have pending court proposals. Wait for review.', 'Vous avez déjà des propositions de terrain en attente. Attendez qu’elles soient examinées.'),
  'invalid_name': ('Give the court a name (2–80 characters).', 'Donnez un nom au terrain (2 à 80 caractères).'),
  'invalid_hours': ('Use 24-hour times like 06:00 and 22:00.', 'Utilisez le format 24 h, par exemple 06:00 et 22:00.'),
  'invalid_location': ('Invalid location.', 'Emplacement invalide.'),
  'photos_required': ('Choose at least one photo.', 'Choisissez au moins une photo.'),
  'too_many_photos': ('Up to 6 photos.', 'Jusqu’à 6 photos.'),
  'report_not_found': ('Report not found.', 'Signalement introuvable.'),
  'invalid_type': ('Choose what\'s wrong.', 'Choisissez ce qui ne va pas.'),
  'too_far_from_court': ('You need to be at the court to check in.', 'Vous devez être sur le terrain pour faire un check-in.'),
  'location_required': ('Turn on location to check in.', 'Activez la localisation pour faire un check-in.'),
  'no_active_presence': ('You\'re not checked in anywhere.', 'Vous n’avez fait de check-in nulle part.'),
  'notify_jump_too_far': ('Move your alert area gradually or check in at a court first.', 'Déplacez votre zone d’alerte progressivement ou faites d’abord un check-in sur un terrain.'),
  'notify_rate_limited': ('You can change your alert area again in a few minutes.', 'Vous pourrez modifier votre zone d’alerte dans quelques minutes.'),
  'browse_location_mismatch': ('Map center is too far from your alert area. Update alerts or check in nearby.', 'Le centre de la carte est trop loin de votre zone d’alerte. Mettez à jour vos alertes ou faites un check-in à proximité.'),
  'token_in_use': ('This device is registered to another account.', 'Cet appareil est enregistré sur un autre compte.'),
  'game_not_found': ('Game not found.', 'Match introuvable.'),
  'game_link_not_found': ('This game link is invalid or the game is no longer open.', 'Ce lien de match est invalide ou le match n’est plus ouvert.'),
  'use_cancel_game': ('Use cancel to stop a game.', 'Utilisez « Annuler » pour arrêter un match.'),
  'already_joined': ('You\'re already in this game.', 'Vous participez déjà à ce match.'),
  'game_full': ('This game is full.', 'Ce match est complet.'),
  'game_closed': ('This game is no longer open.', 'Ce match n’est plus ouvert.'),
  'removed_from_game': ('You were removed from this game.', 'Vous avez été retiré de ce match.'),
  'not_in_game': ('You\'re not in this game.', 'Vous ne participez pas à ce match.'),
  'start_time_in_past': ('Start time is in the past.', 'L’heure de début est déjà passée.'),
  'start_time_too_far': ('Start time must be within 30 days.', 'L’heure de début doit être dans les 30 prochains jours.'),
  'max_players_below_current': ('More players have already joined.', 'Davantage de joueurs ont déjà rejoint le match.'),
  'invalid_duration': ('Duration must be 15–600 minutes.', 'La durée doit être comprise entre 15 et 600 minutes.'),
  'invalid_max_players': ('Max players must be 2–50, or 0 for unlimited.', 'Le nombre maximum de joueurs doit être compris entre 2 et 50, ou 0 pour illimité.'),
  'game_not_started': ('Scores and stats can be added once the game has started.', 'Les scores et statistiques pourront être ajoutés une fois le match commencé.'),
  'challenge_not_found': ('Challenge not found.', 'Défi introuvable.'),
  'challenge_closed': ('This challenge is no longer open.', 'Ce défi n’est plus ouvert.'),
  'challenge_pending': ('You already have a pending challenge with this player.', 'Vous avez déjà un défi en attente avec ce joueur.'),
  'too_many_challenges': ('Too many open challenges. Wait for answers first.', 'Trop de défis ouverts. Attendez d’abord les réponses.'),
  'result_awaiting_you': ('The other player reported a result — confirm or dispute it.', 'L’autre joueur a déclaré un résultat — confirmez-le ou contestez-le.'),
};

/// Alternate server wordings for one code, keyed by the exact English message.
const Map<String, Map<String, _Pair>> _variants = {
  'already_exists': {
    'That username is taken.': ('That username is taken.', 'Ce nom d’utilisateur est déjà pris.'),
    'An account with that email already exists.': ('An account with that email already exists.', 'Un compte existe déjà avec cet e-mail.'),
  },
  'email_not_verified': {
    'Verify your email before using the app.': ('Verify your email before using the app.', 'Vérifiez votre e-mail avant d’utiliser l’application.'),
  },
  'invalid': {
    'Invalid period.': ('Invalid period.', 'Période invalide.'),
    'Use month=YYYY-MM.': ('Use month=YYYY-MM.', 'Utilisez month=AAAA-MM.'),
  },
  'invalid_credentials': {
    'Enter your username or email and password.': ('Enter your username or email and password.', 'Saisissez votre nom d’utilisateur ou votre e-mail, et votre mot de passe.'),
  },
  'invalid_hours': {
    'Set both opening and closing times, or clear both.': ('Set both opening and closing times, or clear both.', 'Indiquez l’heure d’ouverture et l’heure de fermeture, ou effacez les deux.'),
    'Set both opening and closing times, or leave both empty.': ('Set both opening and closing times, or leave both empty.', 'Indiquez l’heure d’ouverture et l’heure de fermeture, ou laissez les deux vides.'),
  },
  'invalid_input': {
    'Choose a sport, format and court.': ('Choose a sport, format and court.', 'Choisissez un sport, un format et un terrain.'),
    'Pick the winner.': ('Pick the winner.', 'Choisissez le gagnant.'),
  },
  'invalid_location': {
    'Invalid coordinates.': ('Invalid coordinates.', 'Coordonnées invalides.'),
    'Pick the court\'s location on the map.': ('Pick the court\'s location on the map.', 'Indiquez l’emplacement du terrain sur la carte.'),
  },
  'invalid_option': {
    'Invalid skill level or game type.': ('Invalid skill level or game type.', 'Niveau ou type de match invalide.'),
  },
  'invalid_photo_url': {
    'Avatar must be uploaded through the app.': ('Avatar must be uploaded through the app.', 'L’avatar doit être importé via l’application.'),
  },
  'invalid_sport': {
    'Extra sports must be different from your main sport.': ('Extra sports must be different from your main sport.', 'Les sports supplémentaires doivent être différents de votre sport principal.'),
    'That sport is not available yet.': ('That sport is not available yet.', 'Ce sport n’est pas encore disponible.'),
  },
  'invalid_token': {
    'Invalid push token.': ('Invalid push token.', 'Jeton de notification invalide.'),
    'Verification link is invalid.': ('Verification link is invalid.', 'Le lien de vérification est invalide.'),
  },
  'location_required': {
    'Turn on location to connect.': ('Turn on location to connect.', 'Activez la localisation pour vous connecter.'),
    'lat and lng are required.': ('lat and lng are required.', 'lat et lng sont obligatoires.'),
  },
  'not_allowed': {
    'You can only edit courts you proposed.': ('You can only edit courts you proposed.', 'Vous ne pouvez modifier que les terrains que vous avez proposés.'),
    'You can only add the first court photo when the court has none yet.': ('You can only add the first court photo when the court has none yet.', 'Vous ne pouvez ajouter la première photo d’un terrain que s’il n’en a pas encore.'),
  },
  'not_found': {
    'Court not found.': ('Court not found.', 'Terrain introuvable.'),
  },
  'photos_required': {
    'Choose at least one photo to remove.': ('Choose at least one photo to remove.', 'Choisissez au moins une photo à supprimer.'),
  },
  'rate_limited': {
    'Too many attempts. Try again in a minute.': ('Too many attempts. Try again in a minute.', 'Trop de tentatives. Réessayez dans une minute.'),
    'Too many requests. Try again later.': ('Too many requests. Try again later.', 'Trop de requêtes. Réessayez plus tard.'),
  },
  'sport_required': {
    'Choose your sport in setup first.': ('Choose your sport in setup first.', 'Choisissez d’abord votre sport dans la configuration.'),
  },
  'too_many_photos': {
    'Up to 6 photos for the court.': ('Up to 6 photos for the court.', 'Jusqu’à 6 photos pour le terrain.'),
    'Up to 6 photos per request.': ('Up to 6 photos per request.', 'Jusqu’à 6 photos par envoi.'),
    'This court already has the maximum of 6 photos.': ('This court already has the maximum of 6 photos.', 'Ce terrain a déjà le maximum de 6 photos.'),
  },
  'wrong_sport': {
    'Tag courts with your sport only.': ('Tag courts with your sport only.', 'N’associez les terrains qu’à votre sport.'),
  },
};

/// Modal title + body for location / alert-area errors.
const Map<String, (_Pair title, _Pair description)> _toasts = {
  'browse_location_mismatch': (('Map area unavailable', 'Zone de carte indisponible'), ('This view is far from your alert zone. Open the map where you play, or check in at a court when you travel — we update alerts from your location.', 'Cette vue est loin de votre zone d’alerte. Ouvrez la carte là où vous jouez, ou faites un check-in sur un terrain quand vous voyagez — nous mettons à jour les alertes selon votre position.')),
  'notify_jump_too_far': (('Alert area', 'Zone d’alerte'), ('Move your alert zone gradually, or check in at a court first.', 'Déplacez votre zone d’alerte progressivement, ou faites d’abord un check-in sur un terrain.')),
  'notify_rate_limited': (('Alert area', 'Zone d’alerte'), ('You can change your alert zone again in a few minutes.', 'Vous pourrez modifier votre zone d’alerte dans quelques minutes.')),
  'rate_limited': (('Slow down', 'Doucement'), ('Too many requests. Wait a minute and try again.', 'Trop de requêtes. Attendez une minute et réessayez.')),
  'too_many_pending_courts': (('Court proposals', 'Propositions de terrain'), ('You already have pending courts waiting for review.', 'Vous avez déjà des terrains en attente d’examen.')),
  'too_far_from_court': (('You\'re not at the court', 'Vous n’êtes pas sur le terrain'), ('Move within about 500 m of the court to check in or join a live game.', 'Rapprochez-vous à environ 500 m du terrain pour faire un check-in ou rejoindre un match en cours.')),
  'location_required': (('Location needed', 'Localisation requise'), ('Turn on location so we can confirm you are at the court.', 'Activez la localisation pour que nous puissions confirmer que vous êtes sur le terrain.')),
  'email_not_verified': (('Verify your email', 'Vérifiez votre e-mail'), ('Check your inbox for the verification link, then sign in again.', 'Consultez votre boîte de réception pour trouver le lien de vérification, puis reconnectez-vous.')),
};

/// Localized text for an API error: exact-message variant, then the code's copy,
/// then the server message.
String apiErrorCopy(String code, String message) {
  final v = _variants[code]?[message] ?? _codes[code];
  if (v != null) return _pick(v);
  if (code.startsWith('invalid:')) return invalidValueText;
  return message.isEmpty ? genericErrorText : message;
}

/// Title and body for a modal error (alert area, location), or null.
({String title, String description})? apiErrorToast(String code) {
  final t = _toasts[code];
  if (t == null) return null;
  return (title: _pick(t.$1), description: _pick(t.$2));
}
