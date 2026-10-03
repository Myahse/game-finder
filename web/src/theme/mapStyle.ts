import { MAP_STYLE_DARK, MAP_STYLE_LIGHT } from '../lib/mapbox'

export function mapStyleForTheme(dark: boolean) {
  return dark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT
}
