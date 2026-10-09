/** Plain-language terms & privacy for signup (not legal advice — customize before wide launch). */

type Section = { title: string; body: string }

export const en = {
  lastUpdatedLabel: 'Last updated:',
  lastUpdated: 'October 2025',
  disclaimer: 'This is a community product template. Have a lawyer review before a large public launch.',
  termsTitle: 'Terms of use',
  privacyTitle: 'Privacy policy',
  termsLink: 'Terms',
  privacyLink: 'Privacy',
  terms: [
    {
      title: 'What Out For Ground is',
      body:
        'Out For Ground helps people discover outdoor courts, join pickup games, and get alerts when games start nearby. You must be 13 or older to use the service.',
    },
    {
      title: 'Your account',
      body:
        'Keep your login private. Use a real email so you can recover access. One person per account. Do not impersonate others or harass players, hosts, or court communities.',
    },
    {
      title: 'Courts & games',
      body:
        'Court locations and game details come from the community and may be wrong or outdated. Playing is at your own risk — follow local rules, respect property, and stay safe. Hosts can cancel games; we do not guarantee any match will happen.',
    },
    {
      title: 'Content you post',
      body:
        'You grant us a license to display photos and text you upload (profile, courts) so the app can work. Do not upload illegal, hateful, or copyrighted material you do not own.',
    },
    {
      title: 'Moderation',
      body:
        'We may remove content, suspend accounts, or reject court proposals that break these rules or harm the community. Admins may access reports and moderation tools.',
    },
    {
      title: 'Changes',
      body:
        'We may update the app and these terms. Continued use after changes means you accept the updated terms.',
    },
  ] as Section[],
  privacy: [
    {
      title: 'What we collect',
      body:
        'Account info (name, username, email, password hash), optional profile photo, preferred sport and skill level, games you join or host, court proposals, check-in presence at courts, coarse “near you” location for map sorting and alerts, device push tokens if you enable notifications, and basic technical logs (IP, requests) for security and rate limits.',
    },
    {
      title: 'Location',
      body:
        'Precise GPS stays on your device except when you check in at a court or when the app sends rounded coordinates to load nearby courts and games. You can control location permission in your device or browser settings.',
    },
    {
      title: 'How we use data',
      body:
        'To run the map, match you with nearby games, send alerts you asked for, prevent abuse, and improve reliability. We do not sell your personal data.',
    },
    {
      title: 'Sharing',
      body:
        'Other players see your public profile (name, username, photo, skill) on games you join. Service providers (hosting, maps, push notifications) process data only to operate the app. We may disclose information if required by law.',
    },
    {
      title: 'Retention & deletion',
      body:
        'We keep data while your account is active. You can ask us to delete your account; some logs may be retained briefly for security.',
    },
    {
      title: 'Contact',
      body: 'Questions about privacy: use the contact email shown on your deployment or project README.',
    },
  ] as Section[],
}

export const fr: typeof en = {
  lastUpdatedLabel: 'Dernière mise à jour :',
  lastUpdated: 'octobre 2025',
  disclaimer:
    'Ceci est un modèle de produit communautaire. Faites-le relire par un avocat avant un lancement public à grande échelle.',
  termsTitle: 'Conditions d’utilisation',
  privacyTitle: 'Politique de confidentialité',
  termsLink: 'Conditions',
  privacyLink: 'Confidentialité',
  terms: [
    {
      title: 'Ce qu’est Out For Ground',
      body:
        'Out For Ground aide les gens à découvrir des terrains en plein air, à rejoindre des matchs improvisés et à recevoir des alertes quand des matchs commencent à proximité. Vous devez avoir 13 ans ou plus pour utiliser le service.',
    },
    {
      title: 'Votre compte',
      body:
        'Gardez vos identifiants confidentiels. Utilisez une adresse e-mail réelle afin de pouvoir récupérer l’accès à votre compte. Un compte par personne. N’usurpez pas l’identité d’autrui et ne harcelez pas les joueurs, les organisateurs ou les communautés des terrains.',
    },
    {
      title: 'Terrains et matchs',
      body:
        'L’emplacement des terrains et les détails des matchs proviennent de la communauté et peuvent être erronés ou obsolètes. Vous jouez à vos propres risques — respectez les règles locales et les lieux, et restez prudent. Les organisateurs peuvent annuler des matchs ; nous ne garantissons pas qu’un match aura lieu.',
    },
    {
      title: 'Contenu que vous publiez',
      body:
        'Vous nous accordez une licence pour afficher les photos et les textes que vous importez (profil, terrains) afin que l’application puisse fonctionner. N’importez pas de contenu illégal, haineux ou protégé par des droits d’auteur qui ne vous appartient pas.',
    },
    {
      title: 'Modération',
      body:
        'Nous pouvons supprimer du contenu, suspendre des comptes ou rejeter des propositions de terrain qui enfreignent ces règles ou nuisent à la communauté. Les administrateurs peuvent accéder aux signalements et aux outils de modération.',
    },
    {
      title: 'Modifications',
      body:
        'Nous pouvons mettre à jour l’application et ces conditions. Continuer à utiliser le service après une modification signifie que vous acceptez les conditions mises à jour.',
    },
  ],
  privacy: [
    {
      title: 'Ce que nous collectons',
      body:
        'Les informations de compte (nom, nom d’utilisateur, e-mail, empreinte du mot de passe), la photo de profil facultative, le sport préféré et le niveau, les matchs que vous rejoignez ou organisez, les propositions de terrain, votre présence (check-in) sur les terrains, une position approximative « près de vous » pour trier la carte et envoyer les alertes, les jetons de notification de l’appareil si vous activez les notifications, ainsi que des journaux techniques de base (IP, requêtes) pour la sécurité et la limitation du nombre de requêtes.',
    },
    {
      title: 'Localisation',
      body:
        'Votre position GPS précise reste sur votre appareil, sauf lorsque vous faites un check-in sur un terrain ou lorsque l’application envoie des coordonnées arrondies pour charger les terrains et les matchs à proximité. Vous pouvez gérer l’autorisation de localisation dans les réglages de votre appareil ou de votre navigateur.',
    },
    {
      title: 'Utilisation des données',
      body:
        'Pour faire fonctionner la carte, vous proposer des matchs à proximité, envoyer les alertes que vous avez demandées, prévenir les abus et améliorer la fiabilité. Nous ne vendons pas vos données personnelles.',
    },
    {
      title: 'Partage',
      body:
        'Les autres joueurs voient votre profil public (nom, nom d’utilisateur, photo, niveau) sur les matchs que vous rejoignez. Les prestataires de services (hébergement, cartes, notifications push) traitent les données uniquement pour faire fonctionner l’application. Nous pouvons divulguer des informations si la loi l’exige.',
    },
    {
      title: 'Conservation et suppression',
      body:
        'Nous conservons les données tant que votre compte est actif. Vous pouvez nous demander de supprimer votre compte ; certains journaux peuvent être conservés brièvement pour des raisons de sécurité.',
    },
    {
      title: 'Contact',
      body:
        'Pour toute question relative à la confidentialité : utilisez l’adresse e-mail de contact indiquée sur votre déploiement ou dans le README du projet.',
    },
  ],
}
