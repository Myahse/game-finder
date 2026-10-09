import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../presets'
import { avataaarsSvg, innerOfGroup } from './avataaars'

describe('innerOfGroup', () => {
  it('returns the inside of the group, nested groups included', () => {
    const svg = '<svg><g id="a"><g><path/></g><circle/></g><g id="b"/></svg>'
    expect(innerOfGroup(svg, '<g id="a">')).toBe('<g><path/></g><circle/>')
    expect(innerOfGroup(svg, '<g id="x">')).toBe('')
  })
})

describe('avataaarsSvg blink', () => {
  it('adds a hidden closed-eyes copy next to the open eyes', () => {
    const svg = avataaarsSvg(defaultConfig())
    expect(svg).toContain('<g class="ftg-av-eyes-closed" opacity="0" transform="translate(76 90)">')
    expect(svg).toContain('<g class="ftg-av-eyes" transform="translate(76 90)">')
    expect(innerOfGroup(svg, '<g class="ftg-av-eyes-closed" opacity="0" transform="translate(76 90)">').length).toBeGreaterThan(20)
  })
})
