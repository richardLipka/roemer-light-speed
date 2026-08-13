/**
 * The observation log — what the student wrote down.
 *
 * Two rules shape this module, and both come from CLAUDE.md §7.
 *
 * **What gets stored is the reading, not the truth.** `jdRecorded` is the moment
 * they pressed the key, three and a half minutes of judgement and all. The error
 * they make is part of the exercise; a log that quietly corrected it would teach
 * that measurement is easy.
 *
 * **Nothing here knows when an eclipse "really" happened**, and that is the
 * point. A row is a time, a moon, a kind of event and a distance — the four
 * things an observer of 1676 could write down. What the timetable says is worked
 * out from the whole log at analysis time (`buildTimetables`), because it is a
 * property of the run and not of any one row.
 *
 * **The distance is recorded with the observation, never derived later.** If it
 * were recomputed at analysis time from the date, a student who cleared the log
 * or edited a row would get a silently different answer. It is a column of the
 * record, like a number copied out of an almanac.
 */

import { GALILEAN_IDS, type GalileanId } from '../physics/constants.js';
import type { Observation, TimingMode } from '../physics/solve.js';

export const DEMONSTRATION_KEY = 'roemer.log';
export const GAME_KEY = 'roemer.game';

/**
 * Bumped when the shape of a stored row changes. An old log is discarded rather
 * than migrated: it is a lesson's worth of clicking, not years of records, and a
 * half-understood migration would corrupt the one thing the analysis reads.
 *
 * Version 2 added `mode`. A version 1 row could have been defaulted to `'seen'`
 * and very nearly always would have been right — which is the argument for
 * throwing it away rather than guessing, since the one case it would get wrong
 * is the control experiment, where a mislabelled row silently poisons the
 * comparison the student is being asked to trust.
 *
 * Version 3 dropped `jdPredicted` and added `moon`. The old field held the
 * model's own eclipse time, which is knowledge no observer has ever had; see the
 * head of `solve.ts`. Nothing is salvageable from a row built around it.
 */
const STORAGE_VERSION = 3;

interface StoredLog {
  version: number;
  observations: Observation[];
}

/** Pure, so the shape can be tested without a browser anywhere near it. */
export function serializeLog(observations: readonly Observation[]): string {
  return JSON.stringify({
    version: STORAGE_VERSION,
    observations: [...observations],
  } satisfies StoredLog);
}

/**
 * Parse, and be suspicious. This string came out of a browser store that a user,
 * an extension or an older build could have written, so every row is checked
 * rather than trusted — one bad field would otherwise reach the solver as a NaN
 * and quietly poison a fitted speed of light.
 */
export function parseLog(raw: string | null): Observation[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return [];

    const stored = parsed as Partial<StoredLog>;
    if (stored.version !== STORAGE_VERSION || !Array.isArray(stored.observations)) return [];

    return stored.observations.filter(isObservation);
  } catch {
    return [];
  }
}

function isObservation(value: unknown): value is Observation {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Partial<Observation>;
  return (
    isFinite(row.jdRecorded) &&
    isFinite(row.distanceAu) &&
    (row.phase === 'disappearance' || row.phase === 'reappearance') &&
    (row.mode === 'seen' || row.mode === 'true') &&
    GALILEAN_IDS.includes(row.moon as GalileanId)
  );
}

const isFinite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * The log itself, with whatever persistence the browser will allow.
 *
 * Every storage call is wrapped. A school machine with storage disabled, a
 * private window, or a full quota must all leave a working app — the log simply
 * does not survive a reload, which is a smaller loss than a blank screen.
 */
export class ObservationLog {
  private observations: Observation[];
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly storageKey: string = DEMONSTRATION_KEY,
    initial: readonly Observation[] = readStorage(storageKey),
  ) {
    this.observations = [...initial];
  }

  get entries(): readonly Observation[] {
    return this.observations;
  }

  get count(): number {
    return this.observations.length;
  }

  /**
   * Just the rows from one of the two experiments.
   *
   * Everything that analyses the log goes through here rather than through
   * `entries`, because the two kinds of reading answer different questions and
   * averaging them together would answer neither. Both are kept, though, so a
   * student can build one run, build the other, and flip between them watching
   * the fitted line stand up and lie flat.
   */
  in(mode: TimingMode): readonly Observation[] {
    return this.observations.filter((observation) => observation.mode === mode);
  }

  countIn(mode: TimingMode): number {
    return this.in(mode).length;
  }

  /** Drop one experiment's rows and keep the other's. */
  clearMode(mode: TimingMode): void {
    this.observations = this.observations.filter((observation) => observation.mode !== mode);
    this.changed();
  }

  add(observation: Observation): void {
    this.observations = [...this.observations, observation].sort(
      (a, b) => a.jdRecorded - b.jdRecorded,
    );
    this.changed();
  }

  replaceAll(observations: readonly Observation[]): void {
    this.observations = [...observations].sort((a, b) => a.jdRecorded - b.jdRecorded);
    this.changed();
  }

  /** Swap one experiment's rows for a fresh set, leaving the other's alone. */
  replaceMode(mode: TimingMode, observations: readonly Observation[]): void {
    this.replaceAll([...this.observations.filter((row) => row.mode !== mode), ...observations]);
  }

  clear(): void {
    this.observations = [];
    this.changed();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    writeStorage(this.storageKey, this.observations);
    for (const listener of this.listeners) listener();
  }
}

function readStorage(key: string): Observation[] {
  try {
    return parseLog(localStorage.getItem(key));
  } catch {
    return [];
  }
}

function writeStorage(key: string, observations: readonly Observation[]): void {
  try {
    localStorage.setItem(key, serializeLog(observations));
  } catch {
    // Quota, private mode, or storage switched off. The session continues.
  }
}

/**
 * The two logs, and whichever one the open tab is writing to.
 *
 * They must be separate. An observation made in the game's universe carries a
 * light time five to twenty times the real one, so a single row of it dropped
 * into the historical run would drag the fitted speed a long way and there would
 * be nothing on screen to say why. Keeping them apart is also what lets a
 * student have a finished measurement on one tab while starting another.
 *
 * Every view takes this rather than an `ObservationLog`, so switching tabs
 * switches the data underneath them with no view knowing it happened. Changes to
 * *either* log are announced, because a view subscribed at construction has to
 * hear about the log it is about to be shown.
 */
export class Logbook {
  readonly demonstration = new ObservationLog(DEMONSTRATION_KEY);
  readonly game = new ObservationLog(GAME_KEY);

  constructor(private readonly isGame: () => boolean) {}

  private get active(): ObservationLog {
    return this.isGame() ? this.game : this.demonstration;
  }

  get entries(): readonly Observation[] {
    return this.active.entries;
  }
  get count(): number {
    return this.active.count;
  }
  in(mode: TimingMode): readonly Observation[] {
    return this.active.in(mode);
  }
  countIn(mode: TimingMode): number {
    return this.active.countIn(mode);
  }
  add(observation: Observation): void {
    this.active.add(observation);
  }
  clearMode(mode: TimingMode): void {
    this.active.clearMode(mode);
  }
  replaceMode(mode: TimingMode, observations: readonly Observation[]): void {
    this.active.replaceMode(mode, observations);
  }

  subscribe(listener: () => void): () => void {
    const stops = [this.demonstration.subscribe(listener), this.game.subscribe(listener)];
    return () => stops.forEach((stop) => stop());
  }
}
