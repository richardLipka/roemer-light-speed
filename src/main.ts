/**
 * The shell: build the views once, then write to them on every frame.
 *
 * Nothing here decides anything. The clock advances, `buildScene` works out
 * where everything is and what light has reached us, and each view writes CSS
 * custom properties. The panels rebuild only when something they show changes.
 */

import './style.css';

import { translate } from './i18n/i18n.js';
import { DEFAULT_MOON } from './physics/constants.js';
import { eclipsePeriodDays, nextEclipse } from './physics/eclipses.js';
import type { Observation } from './physics/solve.js';
import { ObservationLog } from './state/log.js';
import { RATE_LADDER, Store } from './state/store.js';
import { createLogPanel } from './log/logPanel.js';
import { createSolveView } from './log/solveView.js';
import { createWalkthrough } from './walkthrough/walkthrough.js';
import { button, el } from './view/dom.js';
import { createJovian } from './view/jovian.js';
import { createMap } from './view/map.js';
import { createReadout } from './view/readout.js';
import { buildScene, scenePositions } from './view/scene.js';
import { createTelescope } from './view/telescope.js';
import { BODIES } from '@orrery/core';
import { GALILEAN_IDS } from './physics/constants.js';

const store = new Store();
const log = new ObservationLog();

/** Each moon's sidereal period, so the scene can size the ghost separation. */
const MOON_PERIODS = Object.fromEntries(
  GALILEAN_IDS.map((id) => [id, BODIES[id].satellite!.periodDays]),
) as Record<(typeof GALILEAN_IDS)[number], number>;

const map = createMap();
const jovian = createJovian();
const readout = createReadout(store);
const telescope = createTelescope(store);
const walkthrough = createWalkthrough(store);
const logPanel = createLogPanel(store, log, loadSampleLog);
const solveView = createSolveView(store, log);

const stage = el('div', 'stage');
stage.append(map.root, jovian.root);

const controls = el('div', 'dock dock--controls');
const docks = el('div', 'dock dock--panels');
docks.append(readout.root, telescope.root, walkthrough.root, logPanel.root, solveView.root);

const notice = el('p', 'notice');

const app = el('div', 'app');
app.append(stage, controls, docks, notice);
document.body.append(app);

// --- recording ------------------------------------------------------------

/**
 * The student's reading, and it is theirs — what gets logged is the moment they
 * pressed, not the moment the eclipse actually happened. CLAUDE.md §7.1.
 */
function record(): void {
  const scene = buildScene(store.clock.julianDate, MOON_PERIODS);
  const watched = scene.moons.find((moon) => moon.id === store.current.moon);
  if (!watched) return;

  const eclipse = nextEclipse(
    scenePositions,
    store.current.moon,
    store.clock.julianDate - eclipsePeriodDays(store.current.moon),
  );

  const observation: Observation = {
    jdRecorded: store.clock.julianDate,
    jdPredicted: eclipse.jdTrue,
    phase: eclipse.phase,
    distanceAu: scene.earthJupiterAu,
  };
  log.add(observation);
}

/**
 * Deterministic noise.
 *
 * `Math.random` was the obvious choice and the wrong one: a class loading the
 * sample log would each get different numbers, so no two students could compare
 * answers and a teacher could not put a result on the board in advance. A fixed
 * seed makes the ready-made log the *same* log for everybody.
 */
function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A ready-made log, so the analysis can be reached inside a 45-minute lesson.
 *
 * The scatter is deliberate: a clean log would fit suspiciously well and teach
 * the wrong thing about measurement (CLAUDE.md §7.4). Roughly three quarters of
 * a minute either way, which is about what judging a three-and-a-half-minute
 * fade is worth.
 */
function loadSampleLog(): void {
  const random = seededRandom(1676);
  const observations: Observation[] = [];
  let jd = store.clock.julianDate;

  for (let i = 0; i < 60; i++) {
    const eclipse = nextEclipse(scenePositions, DEFAULT_MOON, jd, 'disappearance');
    const slip = (random() - 0.5) * 150; // seconds, a human judging a fade
    observations.push({
      jdRecorded: eclipse.jdSeen + slip / 86_400,
      jdPredicted: eclipse.jdTrue,
      phase: eclipse.phase,
      distanceAu: eclipse.distanceAu,
    });
    jd = eclipse.jdTrue + 6; // spread the run across the year
  }

  log.replaceAll(observations);
}

// --- controls -------------------------------------------------------------

function buildControls(): void {
  const { locale } = store.current;
  controls.replaceChildren(
    button('button', translate(locale, store.clock.isRunning ? 'clock.pause' : 'clock.play'), () => {
      if (store.clock.isRunning) store.clock.pause();
      else store.clock.play();
      buildControls();
    }),
    button('button', translate(locale, 'clock.nextEclipse'), () => {
      const eclipse = nextEclipse(scenePositions, store.current.moon, store.clock.julianDate);
      // Stop a little before it, so the fade can actually be watched.
      store.clock.setJd(eclipse.jdSeen - 4 / 1440);
    }),
    button('button button--quiet', translate(locale, 'walkthrough.title'), () =>
      store.patch({ panel: 'walkthrough' }),
    ),
    button('button button--quiet', translate(locale, 'locale.switch'), () => store.toggleLocale()),
  );
}

document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) return;

  if (event.code === 'Space') {
    event.preventDefault();
    record();
  } else if (event.code === 'ArrowRight') {
    store.clock.step(1 / 1440);
  } else if (event.code === 'ArrowLeft') {
    store.clock.step(-1 / 1440);
  }
});

// --- the frame ------------------------------------------------------------

let previous = performance.now();

/**
 * Draw the instrument for whatever the clock currently says.
 *
 * Deliberately **not** only called from the animation frame. A hidden tab, a
 * projector that has throttled rendering, or a browser honouring reduced motion
 * can leave `requestAnimationFrame` unfired for as long as it likes — and the
 * first version of this file drew nowhere else, so the readout and the
 * telescope came up blank until something moved. Every state change repaints
 * too, and so does startup.
 */
function renderScene(): void {
  const scene = buildScene(store.clock.julianDate, MOON_PERIODS);
  map.render(scene);
  jovian.render(scene);
  readout.render(scene);
  telescope.render(scene);
}

function frame(now: number): void {
  store.clock.advance((now - previous) / 1000);
  previous = now;
  renderScene();
  requestAnimationFrame(frame);
}

function renderPanels(): void {
  const { locale, showTruePositions } = store.current;
  document.documentElement.lang = locale;
  document.documentElement.dataset['truePositions'] = String(showTruePositions);
  document.title = translate(locale, 'app.title');
  notice.textContent = translate(locale, 'notes.datesWarning');
  buildControls();
  walkthrough.render();
  logPanel.render();
  solveView.render();
  renderScene();
}

store.subscribe(renderPanels);
store.clock.setRate(RATE_LADDER[store.current.rateIndex] ?? 1);
renderPanels();
requestAnimationFrame(frame);
