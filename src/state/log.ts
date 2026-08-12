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
 * **The distance is recorded with the observation, never derived later.** If it
 * were recomputed at analysis time from the date, a student who cleared the log
 * or edited a row would get a silently different answer. It is a column of the
 * record, like a number copied out of an almanac.
 */

import type { Observation } from '../physics/solve.js';

const STORAGE_KEY = 'roemer.log';

/**
 * Bumped when the shape of a stored row changes. An old log is discarded rather
 * than migrated: it is a lesson's worth of clicking, not years of records, and a
 * half-understood migration would corrupt the one thing the analysis reads.
 */
const STORAGE_VERSION = 1;

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
    isFinite(row.jdPredicted) &&
    isFinite(row.distanceAu) &&
    (row.phase === 'disappearance' || row.phase === 'reappearance')
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

  constructor(initial: readonly Observation[] = readStorage()) {
    this.observations = [...initial];
  }

  get entries(): readonly Observation[] {
    return this.observations;
  }

  get count(): number {
    return this.observations.length;
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

  clear(): void {
    this.observations = [];
    this.changed();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    writeStorage(this.observations);
    for (const listener of this.listeners) listener();
  }
}

function readStorage(): Observation[] {
  try {
    return parseLog(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function writeStorage(observations: readonly Observation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializeLog(observations));
  } catch {
    // Quota, private mode, or storage switched off. The session continues.
  }
}
