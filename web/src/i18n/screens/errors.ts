// API error copy. `codes` has one entry per error code the Go API can return (EN = the
// backend's English message). `variants` holds the alternate server messages for codes
// that the backend sends with more than one wording, keyed by the exact English message.

export const en = {
  generic: 'Something went wrong.',
  network: "Can't reach the server. Check your connection.",
  invalidValue: 'Invalid value.',
  // Google / Apple sign-in window (Firebase) problems, by Firebase error code.
  signIn: {
    popupBlocked: 'Your browser blocked the Google window. Tap the button again, or allow pop-ups for this site.',
    unsupported: "This browser can't open Google sign-in. Open the site in Chrome or Safari and try again.",
    unauthorizedDomain: "Google sign-in isn't set up for this address yet. Use www.outforground.com.",
    tooManyRequests: 'Too many tries. Wait a minute and try again.',
    failed: 'Google sign-in didn’t finish. Try again.',
    inAppTitle: 'Open in your browser to use Google',
    inAppBody: 'Google sign-in doesn’t work inside this app’s browser. Open the page in Chrome or Safari, or log in with your username and password.',
    openInChrome: 'Open in Chrome',
    copyLink: 'Copy link',
    copied: 'Link copied — paste it in Chrome or Safari.',
  },
  codes: {
    // Auth & session
    not_authenticated: 'Please sign in.',
    admin_only: 'Admins only.',
    not_allowed: "You can't do that.",
    suspended: 'This account is suspended.',
    invalid_credentials: 'Wrong username, email, or password.',
    invalid_refresh_token: 'Session expired. Please sign in again.',
    email_not_verified: 'Verify your email before signing in.',
    social_account:
      'This account uses Google sign-in. Tap “Continue with Google”, then add a password in your profile to also sign in with your username.',
    password_registration_disabled: 'Email sign-up is disabled. Use Google sign-in instead.',
    wrong_password: 'Your current password is wrong.',
    weak_password: 'Password must be 8–72 characters.',
    invalid_email: 'Enter a valid email.',
    invalid_username: 'Username: 3–24 letters, numbers, _ or .',
    invalid_first_name: 'Enter your first name.',
    invalid_last_name: 'Enter your last name.',
    invalid_token: 'This verification link is invalid or expired.',
    already_exists: 'That already exists.',
    google_not_configured: "Google sign-in isn't available.",
    firebase_not_configured: "Sign-in isn't available.",
    invalid_google_token: 'Google sign-in failed. Try again.',
    invalid_firebase_token: 'Sign-in failed. Try again.',
    google_email_unverified: "Your sign-in email isn't verified.",
    apple_email_unverified: "Your Apple account email isn't verified.",
    oauth_email_required: 'We need an email from your sign-in provider. Try again and allow email sharing.',
    email_password_account: 'An account with this email already uses a password. Sign in with your password first.',
    google_account_mismatch: 'This email is linked to a different Google account. Log in with your password.',
    apple_account_mismatch: 'This email is linked to a different Apple ID. Log in with your password.',
    cannot_delete_self: "You can't delete your own account here.",
    cannot_suspend_self: "You can't suspend yourself.",
    rate_limited: 'Too many requests. Try again in a minute.',
    // Generic
    bad_request: 'Invalid request body.',
    internal: 'Something went wrong.',
    server_error: 'Could not save avatar.',
    not_found: 'Not found.',
    invalid: 'Invalid value.',
    invalid_input: 'Invalid input.',
    invalid_reference: "Something referenced doesn't exist.",
    invalid_request: 'Send approve or pending.',
    invalid_status: 'Status must be resolved, rejected or open.',
    invalid_kind: 'kind must be avatar or court.',
    too_long: 'Keep it under 1000 characters.',
    weather_unavailable: 'Weather is unavailable right now.',
    // Players & friends
    user_not_found: 'No player with that username.',
    already_friends: "You're already friends with that player.",
    request_pending: 'Friend request already sent.',
    invite_not_found: 'This invite link is invalid or expired.',
    // Sports & profile
    sport_locked: "Your sport was set at signup and can't be changed.",
    wrong_sport: 'That sport isn’t one of yours. Add it in your profile first.',
    sport_required: 'Choose at least one sport.',
    invalid_sport: 'Unknown sport.',
    too_many_sports: 'You can add up to 2 extra sports.',
    invalid_option: 'Invalid skill level.',
    invalid_avatar: 'Invalid avatar configuration.',
    invalid_photo_url: 'Photos must be uploaded through the app.',
    // Uploads
    file_required: 'Attach an image.',
    too_large: 'Image is too large.',
    unsupported_type: 'Use a JPEG, PNG or WebP image.',
    upload_storage: 'Upload storage is not available.',
    // Courts
    court_not_found: 'Court not found.',
    court_not_available: "This court isn't available.",
    court_required: 'Choose a court and sport.',
    sport_not_offered_at_court: "That sport isn't played at this court.",
    too_many_pending_courts: 'You already have pending court proposals. Wait for review.',
    invalid_name: 'Give the court a name (2–80 characters).',
    invalid_hours: 'Use 24-hour times like 06:00 and 22:00.',
    invalid_location: 'Invalid location.',
    photos_required: 'Choose at least one photo.',
    too_many_photos: 'Up to 6 photos.',
    report_not_found: 'Report not found.',
    invalid_type: "Choose what's wrong.",
    // Location & alerts
    too_far_from_court: 'You need to be at the court to check in.',
    location_required: 'Turn on location to check in.',
    no_active_presence: "You're not checked in anywhere.",
    notify_jump_too_far: 'Move your alert area gradually or check in at a court first.',
    notify_rate_limited: 'You can change your alert area again in a few minutes.',
    browse_location_mismatch: 'Map center is too far from your alert area. Update alerts or check in nearby.',
    token_in_use: 'This device is registered to another account.',
    // Games
    game_not_found: 'Game not found.',
    game_link_not_found: 'This game link is invalid or the game is no longer open.',
    use_cancel_game: 'Use cancel to stop a game.',
    already_joined: "You're already in this game.",
    game_full: 'This game is full.',
    game_closed: 'This game is no longer open.',
    removed_from_game: 'You were removed from this game.',
    not_in_game: "You're not in this game.",
    start_time_in_past: 'Start time is in the past.',
    start_time_too_far: 'Start time must be within 30 days.',
    max_players_below_current: 'More players have already joined.',
    invalid_duration: 'Duration must be 15–600 minutes.',
    invalid_max_players: 'Max players must be 2–50, or 0 for unlimited.',
    game_not_started: 'Scores and stats can be added once the game has started.',
    // Challenges
    challenge_not_found: 'Challenge not found.',
    challenge_closed: 'This challenge is no longer open.',
    challenge_pending: 'You already have a pending challenge with this player.',
    too_many_challenges: 'Too many open challenges. Wait for answers first.',
    result_awaiting_you: 'The other player reported a result — confirm or dispute it.',
  },
  variants: {
    already_exists: {
      'That username is taken.': 'That username is taken.',
      'An account with that email already exists.': 'An account with that email already exists.',
    },
    email_not_verified: {
      'Verify your email before using the app.': 'Verify your email before using the app.',
    },
    invalid: {
      'Invalid period.': 'Invalid period.',
      'Use month=YYYY-MM.': 'Use month=YYYY-MM.',
    },
    invalid_credentials: {
      'Enter your username or email and password.': 'Enter your username or email and password.',
    },
    invalid_hours: {
      'Set both opening and closing times, or clear both.': 'Set both opening and closing times, or clear both.',
      'Set both opening and closing times, or leave both empty.': 'Set both opening and closing times, or leave both empty.',
    },
    invalid_input: {
      'Choose a sport, format and court.': 'Choose a sport, format and court.',
      'Pick the winner.': 'Pick the winner.',
    },
    invalid_location: {
      'Invalid coordinates.': 'Invalid coordinates.',
      "Pick the court's location on the map.": "Pick the court's location on the map.",
    },
    invalid_option: {
      'Invalid skill level or game type.': 'Invalid skill level or game type.',
    },
    invalid_photo_url: {
      'Avatar must be uploaded through the app.': 'Avatar must be uploaded through the app.',
    },
    invalid_sport: {
      'Extra sports must be different from your main sport.': 'Extra sports must be different from your main sport.',
      'That sport is not available yet.': 'That sport is not available yet.',
    },
    invalid_token: {
      'Invalid push token.': 'Invalid push token.',
      'Verification link is invalid.': 'Verification link is invalid.',
    },
    location_required: {
      'Turn on location to connect.': 'Turn on location to connect.',
      'lat and lng are required.': 'lat and lng are required.',
    },
    not_allowed: {
      'You can only edit courts you proposed.': 'You can only edit courts you proposed.',
      'You can only add the first court photo when the court has none yet.':
        'You can only add the first court photo when the court has none yet.',
    },
    not_found: {
      'Court not found.': 'Court not found.',
    },
    photos_required: {
      'Choose at least one photo to remove.': 'Choose at least one photo to remove.',
    },
    rate_limited: {
      'Too many attempts. Try again in a minute.': 'Too many attempts. Try again in a minute.',
      'Too many requests. Try again later.': 'Too many requests. Try again later.',
    },
    sport_required: {
      'Choose your sport in setup first.': 'Choose your sport in setup first.',
    },
    too_many_photos: {
      'Up to 6 photos for the court.': 'Up to 6 photos for the court.',
      'Up to 6 photos per request.': 'Up to 6 photos per request.',
      'This court already has the maximum of 6 photos.': 'This court already has the maximum of 6 photos.',
    },
    wrong_sport: {
      'Tag courts with your sport only.': 'Tag courts with your sport only.',
    },
  },
  toast: {
    browse_location_mismatch: {
      title: 'Map area unavailable',
      description:
        'This view is far from your alert zone. Open the map where you play, or check in at a court when you travel — we update alerts from your location.',
    },
    notify_jump_too_far: {
      title: 'Alert area',
      description: 'Move your alert zone gradually, or check in at a court first.',
    },
    notify_rate_limited: {
      title: 'Alert area',
      description: 'You can change your alert zone again in a few minutes.',
    },
    rate_limited: {
      title: 'Slow down',
      description: 'Too many requests. Wait a minute and try again.',
    },
    too_many_pending_courts: {
      title: 'Court proposals',
      description: 'You already have pending courts waiting for review.',
    },
    too_far_from_court: {
      title: "You're not at the court",
      description: 'Move within about 500 m of the court to check in or join a live game.',
    },
    location_required: {
      title: 'Location needed',
      description: 'Turn on location so we can confirm you are at the court.',
    },
    email_not_verified: {
      title: 'Verify your email',
      description: 'Check your inbox for the verification link, then sign in again.',
    },
  },
}


export const fr: typeof en = {
  generic: 'Une erreur s’est produite.',
  network: 'Impossible de joindre le serveur. Vérifiez votre connexion.',
  invalidValue: 'Valeur invalide.',
  signIn: {
    popupBlocked: 'Votre navigateur a bloqué la fenêtre Google. Touchez à nouveau le bouton, ou autorisez les pop-ups pour ce site.',
    unsupported: 'Ce navigateur ne peut pas ouvrir la connexion Google. Ouvrez le site dans Chrome ou Safari et réessayez.',
    unauthorizedDomain: 'La connexion Google n’est pas encore configurée pour cette adresse. Utilisez www.outforground.com.',
    tooManyRequests: 'Trop d’essais. Attendez une minute et réessayez.',
    failed: 'La connexion Google n’a pas abouti. Réessayez.',
    inAppTitle: 'Ouvrez dans votre navigateur pour utiliser Google',
    inAppBody: 'La connexion Google ne fonctionne pas dans le navigateur de cette application. Ouvrez la page dans Chrome ou Safari, ou connectez-vous avec votre nom d’utilisateur et votre mot de passe.',
    openInChrome: 'Ouvrir dans Chrome',
    copyLink: 'Copier le lien',
    copied: 'Lien copié — collez-le dans Chrome ou Safari.',
  },
  codes: {
    // Auth & session
    not_authenticated: 'Veuillez vous connecter.',
    admin_only: 'Réservé aux administrateurs.',
    not_allowed: 'Vous ne pouvez pas faire cela.',
    suspended: 'Ce compte est suspendu.',
    invalid_credentials: 'Nom d’utilisateur, e-mail ou mot de passe incorrect.',
    invalid_refresh_token: 'Session expirée. Veuillez vous reconnecter.',
    email_not_verified: 'Vérifiez votre e-mail avant de vous connecter.',
    social_account:
      'Ce compte utilise la connexion Google. Touchez « Continuer avec Google », puis ajoutez un mot de passe dans votre profil pour pouvoir aussi vous connecter avec votre nom d’utilisateur.',
    password_registration_disabled: 'L’inscription par e-mail est désactivée. Utilisez plutôt la connexion Google.',
    wrong_password: 'Votre mot de passe actuel est incorrect.',
    weak_password: 'Le mot de passe doit contenir entre 8 et 72 caractères.',
    invalid_email: 'Saisissez une adresse e-mail valide.',
    invalid_username: 'Nom d’utilisateur : 3 à 24 lettres, chiffres, _ ou .',
    invalid_first_name: 'Saisissez votre prénom.',
    invalid_last_name: 'Saisissez votre nom.',
    invalid_token: 'Ce lien de vérification est invalide ou a expiré.',
    already_exists: 'Cela existe déjà.',
    google_not_configured: 'La connexion Google n’est pas disponible.',
    firebase_not_configured: 'La connexion n’est pas disponible.',
    invalid_google_token: 'Échec de la connexion Google. Réessayez.',
    invalid_firebase_token: 'Échec de la connexion. Réessayez.',
    google_email_unverified: 'L’e-mail de votre compte de connexion n’est pas vérifié.',
    apple_email_unverified: 'L’e-mail de votre compte Apple n’est pas vérifié.',
    oauth_email_required:
      'Nous avons besoin d’un e-mail de votre fournisseur de connexion. Réessayez en autorisant le partage de l’e-mail.',
    email_password_account:
      'Un compte avec cet e-mail utilise déjà un mot de passe. Connectez-vous d’abord avec votre mot de passe.',
    google_account_mismatch: 'Cet e-mail est lié à un autre compte Google. Connectez-vous avec votre mot de passe.',
    apple_account_mismatch: 'Cet e-mail est lié à un autre identifiant Apple. Connectez-vous avec votre mot de passe.',
    cannot_delete_self: 'Vous ne pouvez pas supprimer votre propre compte ici.',
    cannot_suspend_self: 'Vous ne pouvez pas vous suspendre vous-même.',
    rate_limited: 'Trop de requêtes. Réessayez dans une minute.',
    // Generic
    bad_request: 'Corps de requête invalide.',
    internal: 'Une erreur s’est produite.',
    server_error: 'Impossible d’enregistrer l’avatar.',
    not_found: 'Introuvable.',
    invalid: 'Valeur invalide.',
    invalid_input: 'Saisie invalide.',
    invalid_reference: 'Un élément référencé n’existe pas.',
    invalid_request: 'Envoyez « approve » ou « pending ».',
    invalid_status: 'Le statut doit être « resolved », « rejected » ou « open ».',
    invalid_kind: 'kind doit valoir « avatar » ou « court ».',
    too_long: 'Pas plus de 1000 caractères.',
    weather_unavailable: 'La météo n’est pas disponible pour le moment.',
    // Players & friends
    user_not_found: 'Aucun joueur avec ce nom d’utilisateur.',
    already_friends: 'Vous êtes déjà ami avec ce joueur.',
    request_pending: 'Demande d’ami déjà envoyée.',
    invite_not_found: 'Ce lien d’invitation est invalide ou a expiré.',
    // Sports & profile
    sport_locked: 'Votre sport a été choisi à l’inscription et ne peut pas être modifié.',
    wrong_sport: 'Ce sport ne fait pas partie des tiens. Ajoute-le d’abord dans ton profil.',
    sport_required: 'Choisissez au moins un sport.',
    invalid_sport: 'Sport inconnu.',
    too_many_sports: 'Vous pouvez ajouter jusqu’à 2 sports supplémentaires.',
    invalid_option: 'Niveau invalide.',
    invalid_avatar: 'Configuration d’avatar invalide.',
    invalid_photo_url: 'Les photos doivent être importées via l’application.',
    // Uploads
    file_required: 'Joignez une image.',
    too_large: 'L’image est trop volumineuse.',
    unsupported_type: 'Utilisez une image JPEG, PNG ou WebP.',
    upload_storage: 'Le stockage des fichiers n’est pas disponible.',
    // Courts
    court_not_found: 'Terrain introuvable.',
    court_not_available: 'Ce terrain n’est pas disponible.',
    court_required: 'Choisissez un terrain et un sport.',
    sport_not_offered_at_court: 'Ce sport ne se pratique pas sur ce terrain.',
    too_many_pending_courts: 'Vous avez déjà des propositions de terrain en attente. Attendez qu’elles soient examinées.',
    invalid_name: 'Donnez un nom au terrain (2 à 80 caractères).',
    invalid_hours: 'Utilisez le format 24 h, par exemple 06:00 et 22:00.',
    invalid_location: 'Emplacement invalide.',
    photos_required: 'Choisissez au moins une photo.',
    too_many_photos: 'Jusqu’à 6 photos.',
    report_not_found: 'Signalement introuvable.',
    invalid_type: 'Choisissez ce qui ne va pas.',
    // Location & alerts
    too_far_from_court: 'Vous devez être sur le terrain pour faire un check-in.',
    location_required: 'Activez la localisation pour faire un check-in.',
    no_active_presence: 'Vous n’avez fait de check-in nulle part.',
    notify_jump_too_far: 'Déplacez votre zone d’alerte progressivement ou faites d’abord un check-in sur un terrain.',
    notify_rate_limited: 'Vous pourrez modifier votre zone d’alerte dans quelques minutes.',
    browse_location_mismatch:
      'Le centre de la carte est trop loin de votre zone d’alerte. Mettez à jour vos alertes ou faites un check-in à proximité.',
    token_in_use: 'Cet appareil est enregistré sur un autre compte.',
    // Games
    game_not_found: 'Match introuvable.',
    game_link_not_found: 'Ce lien de match est invalide ou le match n’est plus ouvert.',
    use_cancel_game: 'Utilisez « Annuler » pour arrêter un match.',
    already_joined: 'Vous participez déjà à ce match.',
    game_full: 'Ce match est complet.',
    game_closed: 'Ce match n’est plus ouvert.',
    removed_from_game: 'Vous avez été retiré de ce match.',
    not_in_game: 'Vous ne participez pas à ce match.',
    start_time_in_past: 'L’heure de début est déjà passée.',
    start_time_too_far: 'L’heure de début doit être dans les 30 prochains jours.',
    max_players_below_current: 'Davantage de joueurs ont déjà rejoint le match.',
    invalid_duration: 'La durée doit être comprise entre 15 et 600 minutes.',
    invalid_max_players: 'Le nombre maximum de joueurs doit être compris entre 2 et 50, ou 0 pour illimité.',
    game_not_started: 'Les scores et statistiques pourront être ajoutés une fois le match commencé.',
    // Challenges
    challenge_not_found: 'Défi introuvable.',
    challenge_closed: 'Ce défi n’est plus ouvert.',
    challenge_pending: 'Vous avez déjà un défi en attente avec ce joueur.',
    too_many_challenges: 'Trop de défis ouverts. Attendez d’abord les réponses.',
    result_awaiting_you: 'L’autre joueur a déclaré un résultat — confirmez-le ou contestez-le.',
  },
  variants: {
    already_exists: {
      'That username is taken.': 'Ce nom d’utilisateur est déjà pris.',
      'An account with that email already exists.': 'Un compte existe déjà avec cet e-mail.',
    },
    email_not_verified: {
      'Verify your email before using the app.': 'Vérifiez votre e-mail avant d’utiliser l’application.',
    },
    invalid: {
      'Invalid period.': 'Période invalide.',
      'Use month=YYYY-MM.': 'Utilisez month=AAAA-MM.',
    },
    invalid_credentials: {
      'Enter your username or email and password.': 'Saisissez votre nom d’utilisateur ou votre e-mail, et votre mot de passe.',
    },
    invalid_hours: {
      'Set both opening and closing times, or clear both.':
        'Indiquez l’heure d’ouverture et l’heure de fermeture, ou effacez les deux.',
      'Set both opening and closing times, or leave both empty.':
        'Indiquez l’heure d’ouverture et l’heure de fermeture, ou laissez les deux vides.',
    },
    invalid_input: {
      'Choose a sport, format and court.': 'Choisissez un sport, un format et un terrain.',
      'Pick the winner.': 'Choisissez le gagnant.',
    },
    invalid_location: {
      'Invalid coordinates.': 'Coordonnées invalides.',
      "Pick the court's location on the map.": 'Indiquez l’emplacement du terrain sur la carte.',
    },
    invalid_option: {
      'Invalid skill level or game type.': 'Niveau ou type de match invalide.',
    },
    invalid_photo_url: {
      'Avatar must be uploaded through the app.': 'L’avatar doit être importé via l’application.',
    },
    invalid_sport: {
      'Extra sports must be different from your main sport.':
        'Les sports supplémentaires doivent être différents de votre sport principal.',
      'That sport is not available yet.': 'Ce sport n’est pas encore disponible.',
    },
    invalid_token: {
      'Invalid push token.': 'Jeton de notification invalide.',
      'Verification link is invalid.': 'Le lien de vérification est invalide.',
    },
    location_required: {
      'Turn on location to connect.': 'Activez la localisation pour vous connecter.',
      'lat and lng are required.': 'lat et lng sont obligatoires.',
    },
    not_allowed: {
      'You can only edit courts you proposed.': 'Vous ne pouvez modifier que les terrains que vous avez proposés.',
      'You can only add the first court photo when the court has none yet.':
        'Vous ne pouvez ajouter la première photo d’un terrain que s’il n’en a pas encore.',
    },
    not_found: {
      'Court not found.': 'Terrain introuvable.',
    },
    photos_required: {
      'Choose at least one photo to remove.': 'Choisissez au moins une photo à supprimer.',
    },
    rate_limited: {
      'Too many attempts. Try again in a minute.': 'Trop de tentatives. Réessayez dans une minute.',
      'Too many requests. Try again later.': 'Trop de requêtes. Réessayez plus tard.',
    },
    sport_required: {
      'Choose your sport in setup first.': 'Choisissez d’abord votre sport dans la configuration.',
    },
    too_many_photos: {
      'Up to 6 photos for the court.': 'Jusqu’à 6 photos pour le terrain.',
      'Up to 6 photos per request.': 'Jusqu’à 6 photos par envoi.',
      'This court already has the maximum of 6 photos.': 'Ce terrain a déjà le maximum de 6 photos.',
    },
    wrong_sport: {
      'Tag courts with your sport only.': 'N’associez les terrains qu’à votre sport.',
    },
  },
  toast: {
    browse_location_mismatch: {
      title: 'Zone de carte indisponible',
      description:
        'Cette vue est loin de votre zone d’alerte. Ouvrez la carte là où vous jouez, ou faites un check-in sur un terrain quand vous voyagez — nous mettons à jour les alertes selon votre position.',
    },
    notify_jump_too_far: {
      title: 'Zone d’alerte',
      description: 'Déplacez votre zone d’alerte progressivement, ou faites d’abord un check-in sur un terrain.',
    },
    notify_rate_limited: {
      title: 'Zone d’alerte',
      description: 'Vous pourrez modifier votre zone d’alerte dans quelques minutes.',
    },
    rate_limited: {
      title: 'Doucement',
      description: 'Trop de requêtes. Attendez une minute et réessayez.',
    },
    too_many_pending_courts: {
      title: 'Propositions de terrain',
      description: 'Vous avez déjà des terrains en attente d’examen.',
    },
    too_far_from_court: {
      title: 'Vous n’êtes pas sur le terrain',
      description: 'Rapprochez-vous à environ 500 m du terrain pour faire un check-in ou rejoindre un match en cours.',
    },
    location_required: {
      title: 'Localisation requise',
      description: 'Activez la localisation pour que nous puissions confirmer que vous êtes sur le terrain.',
    },
    email_not_verified: {
      title: 'Vérifiez votre e-mail',
      description: 'Consultez votre boîte de réception pour trouver le lien de vérification, puis reconnectez-vous.',
    },
  },
}
