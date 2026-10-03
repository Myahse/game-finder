const commons = (file: string) => `https://commons.wikimedia.org/wiki/File:${file}`

/**
 * Photos from Wikimedia Commons, self-hosted in `public/sports` (resized to webp, otherwise unaltered).
 * CC BY / BY-SA require attribution: listed under "Photo credits" in the welcome page footer.
 */
export const sportPhotos = [
  {
    slug: 'basketball',
    name: 'Basketball',
    position: '15% 50%',
    credit: {
      author: 'James Moore200',
      license: 'CC BY-SA 4.0',
      href: commons('Basketball_players_10.jpg'),
    },
  },
  {
    slug: 'football',
    name: 'Football',
    position: '62% 50%',
    credit: {
      author: 'Tahiru Rajab',
      license: 'CC BY-SA 4.0',
      href: commons('Night_Football_matches_In_Northern_Ghana_13.jpg'),
    },
  },
  {
    slug: 'volleyball',
    name: 'Volleyball',
    position: '50% 15%',
    credit: {
      author: 'Astro Medya',
      license: 'CC BY 2.0',
      href: commons('5._Islamic_Solidarity_Games_2021_Konya_Women_Volleyball_Sudan_-_Cameroon_20220813_2.jpg'),
    },
  },
  {
    slug: 'tennis',
    name: 'Tennis',
    position: '4% 50%',
    credit: {
      author: 'Godstime Elijah',
      license: 'CC BY-SA 4.0',
      href: commons('Lawn_tennis_training_session_at_unilorin_9.jpg'),
    },
  },
  {
    slug: 'badminton',
    name: 'Badminton',
    position: '60% 50%',
    credit: {
      author: 'Samson Ssemakadde',
      license: 'CC0',
      href: commons('Schools_badminton_in_Lugogo023.jpg'),
    },
  },
] as const
