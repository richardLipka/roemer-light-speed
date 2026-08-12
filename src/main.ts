/**
 * The shell: build the views once, then write to them on every frame.
 *
 * Three columns, and the split is by *purpose* rather than by component. The
 * left dock is everything that changes what the instrument is doing; the middle
 * is the instrument; the right is everything the instrument reports. A student
 * hunting for a control never reads past a measurement, and vice versa. The
 * language and notes toggles sit in a bar at the top right, out of both.
 *
 * Nothing here decides anything about the physics. The clock advances,
 * `buildScene` works out where everything is and what light has reached us, and
 * each view writes CSS custom properties.
 */

import './style.css';

import { BODIES } from '@orrery/core';

import { translate } from './i18n/i18n.js';
import { nextExtremum } from './physics/configuration.js';
import { DEFAULT_MOON, GALILEAN_IDS } from './physics/constants.js';
import { nearestEclipse, nextEclipse } from './physics/eclipses.js';
import type { Observation } from './physics/solve.js';
import { ObservationLog } from './state/log.js';
import { RATE_LADDER, Store } from './state/store.js';
import { createLogPanel } from './log/logPanel.js';
import { createSolveView } from './log/solveView.js';
import { createWalkthrough } from './walkthrough/walkthrough.js';
import { createControls } from './view/controls.js';
import { createComparison } from './view/comparison.js';
import { createDelayCurve } from './view/delayCurve.js';
import { button, el } from './view/dom.js';
import { createJovian } from './view/jovian.js';
import { createMap } from './view/map.js';
import { createReadout } from './view/readout.js';
import { buildScene, scenePositions } from './view/scene.js';
import { createTelescope } from './view/telescope.js';

const store = new Store();
const log = new ObservationLog();

/** Each moon's sidereal period, so the scene can size the ghost separation. */
const MOON_PERIODS = Object.fromEntries(
  GALILEAN_IDS.map((id) => [id, BODIES[id].satellite!.periodDays]),
) as Record<(typeof GALILEAN_IDS)[number], number>;

// --- actions the controls invoke ------------------------------------------

const actions = {
  toggleClock(): void {
    if (store.clock.isRunning) store.clock.pause();
    else store.clock.play();
  },
  nextEclipse(): void {
    const eclipse = nextEclipse(scenePositions, store.current.moon, store.clock.julianDate);
    // Stop a little before it, so the fade can actually be watched.
    store.clock.setJd(eclipse.jdSeen - 4 / 1440);
    store.ticked();
  },
  jumpNearest(): void {
    store.clock.setJd(nextExtremum(scenePositions, store.clock.julianDate, 'nearest'));
    store.ticked();
  },
  jumpFurthest(): void {
    store.clock.setJd(nextExtremum(scenePositions, store.clock.julianDate, 'furthest'));
    store.ticked();
  },
};

// --- views ----------------------------------------------------------------

const map = createMap(store);
const jovian = createJovian(store);
const readout = createReadout(store);
const telescope = createTelescope(store);
const walkthrough = createWalkthrough(store);
const logPanel = createLogPanel(store, log, loadSampleLog, () => record());
const solveView = createSolveView(store, log);
const controls = createControls(store, actions);
const delayCurveView = createDelayCurve(store);
const comparison = createComparison(store, log);

const topBar = el('div', 'topbar');

const stage = el('div', 'stage');
stage.append(map.root, jovian.root, telescope.root);

const left = el('div', 'dock dock--left');
left.append(controls.root, walkthrough.root);

const right = el('div', 'dock dock--right');
right.append(readout.root, delayCurveView.root, logPanel.root, solveView.root, comparison.root);

const notice = el('p', 'notice');

const app = el('div', 'app');
app.append(topBar, left, stage, right, notice);
document.body.append(app);

// --- recording ------------------------------------------------------------

/**
 * The student's reading, and it is theirs — what gets logged is the moment they
 * pressed, not the moment the eclipse actually happened. CLAUDE.md §7.1.
 *
 * Matched against the eclipse **nearest in seen time**, since the arrival of the
 * news is the only clock an observer has. A press with no eclipse near it is
 * refused and says so: the first version asked for the next eclipse two periods
 * in the past and logged every observation about 2 800 minutes late.
 */
function record(): void {
  const { locale, moon } = store.current;
  const pressed = store.clock.julianDate;
  const eclipse = nearestEclipse(scenePositions, moon, pressed);

  if (!eclipse) {
    logPanel.report(translate(locale, 'log.nothingThere'));
    return;
  }

  log.add({
    jdRecorded: pressed,
    jdPredicted: eclipse.jdTrue,
    phase: eclipse.phase,
    distanceAu: eclipse.distanceAu,
  });

  logPanel.report(
    translate(locale, 'log.recorded', {
      minutes: ((pressed - eclipse.jdTrue) * 1440).toFixed(1),
    }),
  );
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
 * the wrong thing about measurement (CLAUDE.md §7.4).
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

// --- the top bar ----------------------------------------------------------

function buildTopBar(): void {
  const { locale, showNotes } = store.current;
  topBar.replaceChildren(
    el('h1', 'topbar__title', translate(locale, 'app.title')),
    button(`button button--quiet${showNotes ? ' button--on' : ''}`, translate(locale, 'notes.toggle'), () =>
      store.patch({ showNotes: !showNotes }),
    ),
    button('button button--quiet', translate(locale, 'locale.switch'), () => store.toggleLocale()),
  );
}

document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;

  if (event.code === 'Space') {
    event.preventDefault();
    record();
  } else if (event.code === 'ArrowRight') {
    store.clock.step(1 / 1440);
    store.ticked();
  } else if (event.code === 'ArrowLeft') {
    store.clock.step(-1 / 1440);
    store.ticked();
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
 * telescope came up blank until something moved.
 */
function renderScene(): void {
  const scene = buildScene(store.clock.julianDate, MOON_PERIODS);
  map.render(scene);
  jovian.render(scene);
  readout.render(scene);
  telescope.render(scene);
  delayCurveView.render(scene.jd);
  comparison.render(scene);
}

function frame(now: number): void {
  store.clock.advance((now - previous) / 1000);
  previous = now;
  renderScene();
  requestAnimationFrame(frame);
}

function renderPanels(): void {
  const { locale, showTruePositions, showNotes } = store.current;
  document.documentElement.lang = locale;
  document.documentElement.dataset['truePositions'] = String(showTruePositions);
  document.documentElement.dataset['notes'] = showNotes ? 'on' : 'off';
  document.title = translate(locale, 'app.title');
  notice.textContent = translate(locale, 'notes.datesWarning');
  buildTopBar();
  controls.render();
  walkthrough.render();
  logPanel.render();
  solveView.render();
  renderScene();
}

store.subscribe(renderPanels);
store.clock.setRate(RATE_LADDER[store.current.rateIndex] ?? 1);
renderPanels();
requestAnimationFrame(frame);
