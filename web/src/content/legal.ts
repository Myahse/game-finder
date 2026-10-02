/** Plain-language terms & privacy for signup (not legal advice — customize before wide launch). */

export const LEGAL_LAST_UPDATED = 'October 2025'

export const termsSections: { title: string; body: string }[] = [
  {
    title: 'What Find the Game is',
    body:
      'Find the Game helps people discover outdoor courts, join pickup games, and get alerts when games start nearby. You must be 13 or older to use the service.',
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
]

export const privacySections: { title: string; body: string }[] = [
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
    body:
      'Questions about privacy: use the contact email shown on your deployment or project README.',
  },
]
