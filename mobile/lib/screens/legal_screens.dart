import 'package:flutter/material.dart';

import '../core/l10n.dart';

class LegalTextScreen extends StatelessWidget {
  final String title;
  final List<(String, String)> sections;

  const LegalTextScreen({super.key, required this.title, required this.sections});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(tr('Last updated: October 2025', 'Dernière mise à jour : octobre 2025'), style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 8),
          Text(
            tr('This is a community product template. Have a lawyer review before a large public launch.',
                'Ceci est un modèle de produit communautaire. Faites-le relire par un avocat avant un lancement public à grande échelle.'),
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 16),
          for (final (h, body) in sections) ...[
            Text(h, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(body, style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 20),
          ],
        ],
      ),
    );
  }
}

/// Mirrors web/src/i18n/screens/legal.ts section titles and bodies (EN/FR).
List<(String, String)> get termsSections => [
      (
        tr('What Find the Game is', 'Ce qu’est Find the Game'),
        tr(
          'Find the Game helps people discover outdoor courts, join pickup games, and get alerts when games start nearby. You must be 13 or older to use the service.',
          'Find the Game aide les gens à découvrir des terrains en plein air, à rejoindre des matchs improvisés et à recevoir des alertes quand des matchs commencent à proximité. Vous devez avoir 13 ans ou plus pour utiliser le service.',
        ),
      ),
      (
        tr('Your account', 'Votre compte'),
        tr(
          'Keep your login private. Use a real email so you can recover access. One person per account. Do not impersonate others or harass players, hosts, or court communities.',
          'Gardez vos identifiants confidentiels. Utilisez une adresse e-mail réelle afin de pouvoir récupérer l’accès à votre compte. Un compte par personne. N’usurpez pas l’identité d’autrui et ne harcelez pas les joueurs, les organisateurs ou les communautés des terrains.',
        ),
      ),
      (
        tr('Courts & games', 'Terrains et matchs'),
        tr(
          'Court locations and game details come from the community and may be wrong or outdated. Playing is at your own risk — follow local rules, respect property, and stay safe. Hosts can cancel games; we do not guarantee any match will happen.',
          'L’emplacement des terrains et les détails des matchs proviennent de la communauté et peuvent être erronés ou obsolètes. Vous jouez à vos propres risques — respectez les règles locales et les lieux, et restez prudent. Les organisateurs peuvent annuler des matchs ; nous ne garantissons pas qu’un match aura lieu.',
        ),
      ),
      (
        tr('Content you post', 'Contenu que vous publiez'),
        tr(
          'You grant us a license to display photos and text you upload (profile, courts) so the app can work. Do not upload illegal, hateful, or copyrighted material you do not own.',
          'Vous nous accordez une licence pour afficher les photos et les textes que vous importez (profil, terrains) afin que l’application puisse fonctionner. N’importez pas de contenu illégal, haineux ou protégé par des droits d’auteur qui ne vous appartient pas.',
        ),
      ),
      (
        tr('Moderation', 'Modération'),
        tr(
          'We may remove content, suspend accounts, or reject court proposals that break these rules or harm the community. Admins may access reports and moderation tools.',
          'Nous pouvons supprimer du contenu, suspendre des comptes ou rejeter des propositions de terrain qui enfreignent ces règles ou nuisent à la communauté. Les administrateurs peuvent accéder aux signalements et aux outils de modération.',
        ),
      ),
      (
        tr('Changes', 'Modifications'),
        tr(
          'We may update the app and these terms. Continued use after changes means you accept the updated terms.',
          'Nous pouvons mettre à jour l’application et ces conditions. Continuer à utiliser le service après une modification signifie que vous acceptez les conditions mises à jour.',
        ),
      ),
    ];

List<(String, String)> get privacySections => [
      (
        tr('What we collect', 'Ce que nous collectons'),
        tr(
          'Account info (name, username, email, password hash), optional profile photo, preferred sport and skill level, games you join or host, court proposals, check-in presence at courts, coarse “near you” location for map sorting and alerts, device push tokens if you enable notifications, and basic technical logs (IP, requests) for security and rate limits.',
          'Les informations de compte (nom, nom d’utilisateur, e-mail, empreinte du mot de passe), la photo de profil facultative, le sport préféré et le niveau, les matchs que vous rejoignez ou organisez, les propositions de terrain, votre présence (check-in) sur les terrains, une position approximative « près de vous » pour trier la carte et envoyer les alertes, les jetons de notification de l’appareil si vous activez les notifications, ainsi que des journaux techniques de base (IP, requêtes) pour la sécurité et la limitation du nombre de requêtes.',
        ),
      ),
      (
        tr('Location', 'Localisation'),
        tr(
          'Precise GPS stays on your device except when you check in at a court or when the app sends rounded coordinates to load nearby courts and games. You can control location permission in your device or browser settings.',
          'Votre position GPS précise reste sur votre appareil, sauf lorsque vous faites un check-in sur un terrain ou lorsque l’application envoie des coordonnées arrondies pour charger les terrains et les matchs à proximité. Vous pouvez gérer l’autorisation de localisation dans les réglages de votre appareil ou de votre navigateur.',
        ),
      ),
      (
        tr('How we use data', 'Utilisation des données'),
        tr(
          'To run the map, match you with nearby games, send alerts you asked for, prevent abuse, and improve reliability. We do not sell your personal data.',
          'Pour faire fonctionner la carte, vous proposer des matchs à proximité, envoyer les alertes que vous avez demandées, prévenir les abus et améliorer la fiabilité. Nous ne vendons pas vos données personnelles.',
        ),
      ),
      (
        tr('Sharing', 'Partage'),
        tr(
          'Other players see your public profile (name, username, photo, skill) on games you join. Service providers (hosting, maps, push notifications) process data only to operate the app. We may disclose information if required by law.',
          'Les autres joueurs voient votre profil public (nom, nom d’utilisateur, photo, niveau) sur les matchs que vous rejoignez. Les prestataires de services (hébergement, cartes, notifications push) traitent les données uniquement pour faire fonctionner l’application. Nous pouvons divulguer des informations si la loi l’exige.',
        ),
      ),
      (
        tr('Retention & deletion', 'Conservation et suppression'),
        tr(
          'We keep data while your account is active. You can ask us to delete your account; some logs may be retained briefly for security.',
          'Nous conservons les données tant que votre compte est actif. Vous pouvez nous demander de supprimer votre compte ; certains journaux peuvent être conservés brièvement pour des raisons de sécurité.',
        ),
      ),
      (
        tr('Contact', 'Contact'),
        tr(
          'Questions about privacy: use the contact email shown on your deployment or project README.',
          'Pour toute question relative à la confidentialité : utilisez l’adresse e-mail de contact indiquée sur votre déploiement ou dans le README du projet.',
        ),
      ),
    ];

String get termsTitle => tr('Terms of use', 'Conditions d’utilisation');
String get privacyTitle => tr('Privacy policy', 'Politique de confidentialité');

/// Opens the terms of use.
void openTerms(BuildContext context) =>
    Navigator.push(context, MaterialPageRoute(builder: (_) => LegalTextScreen(title: termsTitle, sections: termsSections)));

/// Opens the privacy policy.
void openPrivacy(BuildContext context) =>
    Navigator.push(context, MaterialPageRoute(builder: (_) => LegalTextScreen(title: privacyTitle, sections: privacySections)));
