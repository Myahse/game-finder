// Per-area string modules, merged into the main message tree as t.<area>.
import * as account from './account'
import * as admin from './admin'
import * as announcements from './announcements'
import * as avatarLabels from './avatarLabels'
import * as card from './card'
import * as courts from './courts'
import * as errors from './errors'
import * as games from './games'
import * as jeu from './jeu'
import * as legal from './legal'
import * as whatsapp from './whatsapp'

export const screensEn = {
  account: account.en,
  admin: admin.en,
  announcements: announcements.en,
  avatarLabels: avatarLabels.en,
  card: card.en,
  courts: courts.en,
  errors: errors.en,
  games: games.en,
  jeu: jeu.en,
  legal: legal.en,
  whatsapp: whatsapp.en,
}

export const screensFr: typeof screensEn = {
  account: account.fr,
  admin: admin.fr,
  announcements: announcements.fr,
  avatarLabels: avatarLabels.fr,
  card: card.fr,
  courts: courts.fr,
  errors: errors.fr,
  games: games.fr,
  jeu: jeu.fr,
  legal: legal.fr,
  whatsapp: whatsapp.fr,
}
