export type GateType = '1d' | '2d';

export interface Question {
  /** The prompt shown above the gate. */
  q: string;
  type: GateType;
  /** Column labels, left to right. Always an even count — no neutral middle. */
  cols: string[];
  /** Row labels for 2d gates, top to bottom. */
  rows?: string[];
  xAxis?: readonly [string, string];
  yAxis?: readonly [string, string];
  /** One named material per column. */
  items: string[];
  kind?: 'meta';
}

export interface Answer {
  q: string;
  /**
   * Which gate this was, so a record with questions left open still lines its
   * answers up against the eight. Absent on records written before gates could
   * be skipped, where the answers were always all eight in order.
   */
  gate?: number;
  /**
   * The colour that was on the cell taken, as it was on the day. Held on the
   * record rather than derived from the answer, because a gate's colours are
   * dealt at random and cannot be worked out again afterwards — and because
   * that randomness is the point: nothing about the colour can be aimed for.
   * Absent on records written before the colours moved.
   */
  hue?: string;
  /** Human-readable answer, e.g. "Deep" or "Calm / Heavy". */
  label: string;
  item: string;
  /** Outermost column or row. Flavour only — never worth more. */
  edge: boolean;
  /** Upper half of the scale, which yields refined rather than raw material. */
  refined: boolean;
  ix: number;
  iy: number;
}

/**
 * A point on the logged line, normalised into the gate frame (0..1 on both
 * axes) so a record renders identically on any screen, and so a mid-flight
 * resize can't warp the trail.
 */
export interface LinePoint {
  nx: number;
  ny: number;
  /** Distance flown when this point was laid down. */
  z: number;
  /**
   * Seconds since the flight began. Absent on records written before this
   * existed.
   *
   * The record only grows while the craft moves, so a pause writes no point at
   * all — which meant a long hesitation and none at all produced identical
   * records. With a clock on each point a pause shows up as a large gap in `t`
   * across a tiny gap in `z`, which is the only way the piece can render the
   * moments someone stopped to think.
   */
  t?: number;
}

export interface FlightResult {
  answers: Answer[];
  line: LinePoint[];
  /**
   * Gates met, answered or not. What a flight earns is counted from this and
   * never from `answers`: flying over a question you would rather not answer
   * has to cost nothing, or the cheapest way to be paid is to answer anything
   * at all — see `lib/progress/credits.ts`.
   */
  gates: number;
}
