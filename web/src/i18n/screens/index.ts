// Per-area string modules, merged into the main message tree as t.<area>.
import * as account from './account'
import * as admin from './admin'
import * as avatarLabels from './avatarLabels'
import * as card from './card'
import * as courts from './courts'
import * as errors from './errors'
import * as games from './games'
import * as legal from './legal'

export const screensEn = {
  account: account.en,
  admin: admin.en,
  avatarLabels: avatarLabels.en,
  card: card.en,
  courts: courts.en,
  errors: errors.en,
  games: games.en,
  legal: legal.en,
}

export const screensFr: typeof screensEn = {
  account: account.fr,
  admin: admin.fr,
  avatarLabels: avatarLabels.fr,
  card: card.fr,
  courts: courts.fr,
  errors: errors.fr,
  games: games.fr,
  legal: legal.fr,
}
