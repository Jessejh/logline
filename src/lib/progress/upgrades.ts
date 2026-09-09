import type { Palette } from '../game/palette';
import type { PieceStyle } from '../game/pieceStyle';

/**
 * What credits buy.
 *
 * Every upgrade here is **appearance only**. That is not restraint for its own
 * sake — nothing in this app is scored, so there is no performance for an
 * upgrade to improve, and an upgrade that made a gate easier to hit would be
 * inventing a difficulty the grading phase does not have. It carries over the
 * village rule from `docs/DESIGN.md`: unlocks and atmosphere, never advantage.
 *
 * One skin per category can be equipped at a time and the three stack, so a
 * hull, a set of frames and a sky combine. Buying is permanent; equipping is
 * free and reversible.
 */

export type UpgradeCategory = 'craft' | 'gates' | 'sky' | 'piece';

export interface Upgrade {
  id: string;
  category: UpgradeCategory;
  name: string;
  /** One line, in the app's voice — describing the look, not a benefit. */
  blurb: string;
  cost: number;
  palette: Partial<Palette>;
  /** Only on 'piece' upgrades: the paper the day is printed on. */
  piece?: Partial<PieceStyle>;
}

export const CATEGORY_LABELS: Record<UpgradeCategory, string> = {
  craft: 'Hull',
  gates: 'Frames',
  sky: 'Sky',
  piece: 'Paper'
};

/**
 * Costs against earnings: eight gates a flight at 3–8 credits a gate is
 * 24–64 a day, so the first hull is about two days in and the far end of the
 * list is a few weeks of showing up.
 */
const SKINS: readonly Upgrade[] = [
  {
    id: 'craft-brass',
    category: 'craft',
    name: 'Brass Hull',
    blurb: 'Warm metal, lamp-lit at the edges.',
    cost: 60,
    palette: { craft: '#e8cfa4', craftGlow: 'rgba(232,184,122,0.85)' }
  },
  {
    id: 'craft-obsidian',
    category: 'craft',
    name: 'Obsidian Hull',
    blurb: 'Dark glass that only shows itself when it turns.',
    cost: 180,
    palette: { craft: '#33405a', craftGlow: 'rgba(168,213,216,0.8)' }
  },
  {
    id: 'gates-amber',
    category: 'gates',
    name: 'Amber Frames',
    blurb: 'Gates lit like windows from a long way off.',
    cost: 90,
    palette: { ice: '#e0bd8c', label: '#c9a97e' }
  },
  {
    id: 'gates-verdigris',
    category: 'gates',
    name: 'Verdigris Frames',
    blurb: 'Old copper, gone green with weather.',
    cost: 200,
    palette: { ice: '#8fc7ab', label: '#7faa95' }
  },
  {
    id: 'sky-aurora',
    category: 'sky',
    name: 'Aurora',
    blurb: 'A slow green wash behind the stars.',
    cost: 120,
    palette: {
      star: '#cfe8dc',
      glowA: 'rgba(86,160,132,0.08)',
      glowB: 'rgba(70,110,150,0.05)'
    }
  },
  {
    id: 'sky-emberfield',
    category: 'sky',
    name: 'Emberfield',
    blurb: 'Warm dark, as though something is burning below the floor.',
    cost: 260,
    palette: {
      void: '#0a0710',
      star: '#e4d3c0',
      glowA: 'rgba(154,96,84,0.08)',
      glowB: 'rgba(90,60,80,0.05)'
    }
  }
];

/**
 * What the day gets printed on.
 *
 * A paper changes the material and nothing else: each of these has to render a
 * flight that held its line and one that ranged wide as two kinds of finished
 * picture, or it would be selling a better day rather than a different sheet.
 * The dark ones print in `screen` because pigment multiplied into a dark ground
 * only ever subtracts its way to nothing.
 */
const PAPERS: readonly Upgrade[] = [
  {
    id: 'piece-nightprint',
    category: 'piece',
    name: 'Nightprint',
    blurb: 'The same day, printed light on dark.',
    cost: 140,
    palette: {},
    piece: {
      cool: '#0e1220',
      warm: '#1a1626',
      ink: '226, 234, 240',
      paints: ['#7fd4ff', '#ffb38a'],
      blend: 'screen',
      grain: 0.05,
      chroma: 0.64
    }
  },
  {
    id: 'piece-linen',
    category: 'piece',
    name: 'Linen',
    blurb: 'Heavy warm stock with a tooth you can feel.',
    cost: 110,
    palette: {},
    piece: {
      cool: '#efe7d8',
      warm: '#f2e3c8',
      ink: '52, 40, 30',
      paints: ['#3f5d43', '#8c4a2f'],
      grain: 0.085,
      chroma: 0.54
    }
  },
  {
    id: 'piece-cyanotype',
    category: 'piece',
    name: 'Cyanotype',
    blurb: 'Printed in Prussian blue, the way a sun-print comes out.',
    cost: 220,
    palette: {},
    piece: {
      cool: '#123a5c',
      warm: '#1b4a6b',
      ink: '223, 236, 244',
      paints: ['#bfe4f5', '#f2d9a8'],
      blend: 'screen',
      grain: 0.06,
      chroma: 0.56
    }
  }
];

/** Everything for sale, in the order the workshop lists it. */
export const UPGRADES: readonly Upgrade[] = [...SKINS, ...PAPERS];

export function upgradeById(id: string): Upgrade | undefined {
  return UPGRADES.find((u) => u.id === id);
}

/** Merge the equipped paper into one set of style overrides. */
export function pieceStyleFor(equipped: Equipped): Partial<PieceStyle> {
  const upgrade = equipped.piece ? upgradeById(equipped.piece) : undefined;
  return upgrade?.piece ?? {};
}

/** The equipped skin per category. Absent means the base look. */
export type Equipped = Partial<Record<UpgradeCategory, string>>;

/** Merge the equipped skins into one set of palette overrides. */
export function paletteFor(equipped: Equipped): Partial<Palette> {
  const out: Partial<Palette> = {};
  for (const id of Object.values(equipped)) {
    const upgrade = id ? upgradeById(id) : undefined;
    if (upgrade) Object.assign(out, upgrade.palette);
  }
  return out;
}
