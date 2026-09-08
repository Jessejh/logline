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
}

export interface FlightResult {
  answers: Answer[];
  line: LinePoint[];
}
