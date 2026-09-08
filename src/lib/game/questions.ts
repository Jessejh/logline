import type { Question } from './types';

/**
 * Eight questions: one orienting, then one per domain. Every gate is
 * even-width so there is no neutral middle to drift into, and every cell
 * yields exactly one item — edges differ in flavour, never in value.
 */
export const QUESTIONS: readonly Question[] = [
  {
    q: 'Where are you in the day?',
    type: '1d',
    cols: ['Dawn', 'Midday', 'Dusk', 'Night'],
    items: ['Firstlight', 'Noonstone', 'Duskglass', 'Nightpeat'],
    kind: 'meta'
  },
  {
    q: 'How did you sleep?',
    type: '1d',
    cols: ['Barely', 'Restless', 'Enough', 'Deep'],
    items: ['Emberash', 'Coarse Wool', 'Linen', 'Moonsilk']
  },
  {
    q: 'What is your energy like?',
    type: '1d',
    cols: ['Empty', 'Low', 'Steady', 'Charged'],
    items: ['Cold Iron', 'Rootite', 'Beeswax', 'Sunglass']
  },
  {
    q: 'Where does today sit?',
    type: '2d',
    cols: ['Calm', '', '', 'Restless'],
    rows: ['Light', '', '', 'Heavy'],
    xAxis: ['Calm', 'Restless'],
    yAxis: ['Light', 'Heavy'],
    items: ['Still Clay', 'River Clay', 'Quick Clay', 'Storm Clay']
  },
  {
    q: 'How near were other people?',
    type: '1d',
    cols: ['Alone', 'Distant', 'Warm', 'Held'],
    items: ['Bare Thread', 'Twine', 'Braid', 'Silk Cord']
  },
  {
    q: 'And your attention?',
    type: '2d',
    cols: ['Scattered', '', '', 'Sharp'],
    rows: ['Easy', '', '', 'Forced'],
    xAxis: ['Scattered', 'Sharp'],
    yAxis: ['Easy', 'Forced'],
    items: ['Sand', 'Flint', 'Ground Glass', 'Lens']
  },
  {
    q: 'What is the body saying?',
    type: '1d',
    cols: ['Sore', 'Tense', 'Easy', 'Alive'],
    items: ['Bitterbark', 'Knotwood', 'Balmwood', 'Greenwood']
  },
  {
    q: 'Did you find any stillness?',
    type: '1d',
    cols: ['None', 'A moment', 'Some', 'Plenty'],
    items: ['Raw Peat', 'Dry Peat', 'Cedar', 'Heartwood']
  }
];
