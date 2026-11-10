# Out For Ground — affiches publicitaires

| Emplacement | Fichier | Taille |
|---|---|---|
| Panneaux (logo et adresse centrés) | `artsyde-panneau.png` | 2400 × 1200 |
| Tikitoko | `artsyde-story.png` | 1080 × 1920 |
| Babigram et téléphone | `artsyde-portrait.png` | 1080 × 1350 |
| Carré | `artsyde-carre.png` | 1080 × 1080 |
| Icône écran d’accueil | `artsyde-icone.png` | 512 × 512 |
| Écran LED | `artsyde-led.png` | 1800 × 1000 |
| Géant | `artsyde-geant.png` | 2860 × 1000 |
| Sucette | `artsyde-sucette.png` | 1400 × 2000 |
| Banderole | `artsyde-banderole.png` | 2500 × 400 |

The story keeps its text out of the top 250 px and bottom 340 px, where the app draws its own interface.

## Changer un texte et régénérer

Texts, colours and pin positions are in `src/flyer.html`. Preview one format by opening `src/flyer.html?f=led` in a browser. To render every PNG again (needs Node and Playwright):

```bash
node brand/ads/src/render.mjs            # tous les formats
node brand/ads/src/render.mjs led geant  # seulement ceux-là
```
