import type { Answer, Question } from './types';

/**
 * Eight questions: one orienting, then one per domain. Every gate is
 * even-width so there is no neutral middle to drift into, and every cell
 * yields exactly one colour — edges differ in flavour, never in value.
 *
 * ## How the colours are chosen
 *
 * All thirty-two are solved rather than picked: every one sits at L* 85 and
 * C* 21.5 in Lab, so they differ only in hue angle. Two things follow, and
 * both are the point.
 *
 * No cell is prettier to land in than its neighbour. Weight is what the eye
 * ranks colours by, and every colour here carries the same weight, so wanting
 * a particular one can never bend an answer.
 *
 * And the drawn line stays legible on all of them. The piece puts the record
 * in ink over these as a ground; at one fixed lightness the faintest stroke
 * reads exactly as well on the last colour as on the first, which a
 * hand-picked set could only approximate. 21.5 is the sharpest chroma every
 * hue can reach at that lightness while staying inside sRGB.
 *
 * Within a gate the four are a quarter-turn apart, so the options are plainly
 * different colours; each gate is offset an eighth of that from the last, so
 * no two of the thirty-two repeat.
 */
export const QUESTIONS: readonly Question[] = [
  {
    q: 'Where are you in the day?',
    type: '1d',
    cols: ['Dawn', 'Midday', 'Dusk', 'Night'],
    colors: [
      { name: 'Blush', hex: '#fcc6d5' },
      { name: 'Straw', hex: '#e4d3ac' },
      { name: 'Seafoam', hex: '#a4e0d4' },
      { name: 'Periwinkle', hex: '#bdd6fc' }
    ],
    kind: 'meta'
  },
  {
    q: 'How did you sleep?',
    type: '1d',
    cols: ['Barely', 'Restless', 'Enough', 'Deep'],
    colors: [
      { name: 'Rosewater', hex: '#fec6cd' },
      { name: 'Chamomile', hex: '#dcd5ac' },
      { name: 'Aquamarine', hex: '#a0e0db' },
      { name: 'Wisteria', hex: '#c7d3fc' }
    ]
  },
  {
    q: 'What is your energy like?',
    type: '1d',
    cols: ['Empty', 'Low', 'Steady', 'Charged'],
    colors: [
      { name: 'Salmon', hex: '#ffc7c6' },
      { name: 'Pear', hex: '#d4d8af' },
      { name: 'Turquoise', hex: '#9ee0e3' },
      { name: 'Lilac', hex: '#d1d1fa' }
    ]
  },
  {
    q: 'Where does today sit?',
    type: '2d',
    cols: ['Calm', '', '', 'Restless'],
    rows: ['Light', '', '', 'Heavy'],
    xAxis: ['Calm', 'Restless'],
    yAxis: ['Light', 'Heavy'],
    colors: [
      { name: 'Apricot', hex: '#fec8bf' },
      { name: 'Celadon', hex: '#cbdab2' },
      { name: 'Sky', hex: '#9edfea' },
      { name: 'Mauve', hex: '#dbcef6' }
    ]
  },
  {
    q: 'How near were other people?',
    type: '1d',
    cols: ['Alone', 'Distant', 'Warm', 'Held'],
    colors: [
      { name: 'Peach', hex: '#fbc9b8' },
      { name: 'Sage', hex: '#c2dcb7' },
      { name: 'Cornflower', hex: '#a0def0' },
      { name: 'Orchid', hex: '#e4ccf1' }
    ]
  },
  {
    q: 'And your attention?',
    type: '2d',
    cols: ['Scattered', '', '', 'Sharp'],
    rows: ['Easy', '', '', 'Forced'],
    xAxis: ['Scattered', 'Sharp'],
    yAxis: ['Easy', 'Forced'],
    colors: [
      { name: 'Melon', hex: '#f7cbb3' },
      { name: 'Jade', hex: '#baddbd' },
      { name: 'Cerulean', hex: '#a5dcf5' },
      { name: 'Heather', hex: '#eccaeb' }
    ]
  },
  {
    q: 'What is the body saying?',
    type: '1d',
    cols: ['Sore', 'Tense', 'Easy', 'Alive'],
    colors: [
      { name: 'Sand', hex: '#f2ceaf' },
      { name: 'Mint', hex: '#b2dfc4' },
      { name: 'Powder Blue', hex: '#abdbf9' },
      { name: 'Thistle', hex: '#f3c8e4' }
    ]
  },
  {
    q: 'Did you find any stillness?',
    type: '1d',
    cols: ['None', 'A moment', 'Some', 'Plenty'],
    colors: [
      { name: 'Honey', hex: '#ebd0ad' },
      { name: 'Verdigris', hex: '#aae0cc' },
      { name: 'Bluebell', hex: '#b4d8fc' },
      { name: 'Peony', hex: '#f9c7dd' }
    ]
  }
];

/** Bare paper, for an answer whose question no longer exists. */
const UNPAINTED = '#e8ecef';

/**
 * The colour an answer was given in. Records written before colours replaced
 * materials carry none, so they are resolved from the question they answered —
 * which is why an old journal still draws a full-coloured piece.
 */
export function colorOf(answer: Answer): string {
  if (answer.hex) return answer.hex;
  const question = QUESTIONS.find((q) => q.q === answer.q);
  return question?.colors[answer.ix]?.hex ?? UNPAINTED;
}
