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
import { GALILEAN_IDS } from './physics/constants.js';
import { type Eclipse, nearestEclipse, nextEclipse } from './physics/eclipses.js';
import type { Observation } from './physics/solve.js';
import { Logbook } from './state/log.js';
import { CLOSE_UP_RATE, OPENING_JD, Store } from './state/store.js';
import { createLogPanel } from './log/logPanel.js';
import { createSolveView } from './log/solveView.js';
import { createWalkthrough } from './walkthrough/walkthrough.js';
import { createGamePanel } from './game/gamePanel.js';
import { createControls } from './view/controls.js';
import { createCredit } from './view/credit.js';
import { createComparison } from './view/comparison.js';
import { createDelayCurve } from './view/delayCurve.js';
import { button, el } from './view/dom.js';
import { createJovian } from './view/jovian.js';
import { createMap } from './view/map.js';
import { createReadout } from './view/readout.js';
import { buildScene, scenePositions } from './view/scene.js';
import { closeUpZoom, createTelescope } from './view/telescope.js';

const store = new Store();

// Two logs behind one handle: the historical run and the game's, kept apart
// because an observation made where light is fifteen times slower would drag a
// fit across the two universes and there would be nothing on screen to say why.
const log = new Logbook(() => store.current.tab === 'game');

/** Each moon's sidereal period, so the scene can size the ghost separation. */
const MOON_PERIODS = Object.fromEntries(
  GALILEAN_IDS.map((id) => [id, BODIES[id].satellite!.periodDays]),
) as Record<(typeof GALILEAN_IDS)[number], number>;

// --- actions the controls invoke ------------------------------------------

/**
 * When the event the student is timing arrives.
 *
 * Timing what you see means waiting for the light; timing the event itself means
 * being there. The jump buttons have to land on whichever one is armed, or the
 * control experiment sends you to a moment forty minutes after the thing you
 * came to watch.
 */
function jdWatched(eclipse: Eclipse): number {
  return store.current.timingMode === 'seen' ? eclipse.jdSeen : eclipse.jdTrue;
}

/** The next eclipse of the watched moon, in whichever universe is on screen. */
function upcoming(): Eclipse {
  return nextEclipse(
    scenePositions,
    store.current.moon,
    store.clock.julianDate,
    undefined,
    store.lightTimePerAuDays,
  );
}

const actions = {
  toggleClock(): void {
    if (store.clock.isRunning) store.clock.pause();
    else store.clock.play();
  },
  nextEclipse(): void {
    const eclipse = upcoming();
    // Stop a little before it, so the fade can actually be watched.
    store.clock.setJd(jdWatched(eclipse) - 4 / 1440);
    store.ticked();
  },
  /**
   * The eclipse at something like the pace it happens.
   *
   * Ten times real time, which is the compromise this whole feature turns on:
   * the fade takes three and a half minutes and a class will not sit through it,
   * but at a hundred times it is a blink and there is nothing to judge. At ten,
   * the disappearance takes twenty-one seconds — long enough that pressing the
   * button is a real decision, and short enough to do twice.
   *
   * The zoom goes up with it, because at zoom 1 the moons sit within a few
   * pixels of the planet and a fade nobody can see is not worth slowing down
   * for — and it is set from the moon being watched rather than to a fixed
   * number, or a Callisto close-up would magnify Callisto straight off the edge
   * of the field. And the clock is started: a close-up you have to remember to
   * press play on is a close-up that gets missed.
   */
  watchCloseUp(): void {
    const { moon } = store.current;
    const eclipse = upcoming();
    store.clock.setJd(jdWatched(eclipse) - 5 / 1440);
    store.patch({ rateDaysPerSecond: CLOSE_UP_RATE, moonZoom: closeUpZoom(moon) });
    store.clock.play();
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
const delayCurveView = createDelayCurve(store, log);
const comparison = createComparison(store, log);
const gamePanel = createGamePanel(store, log);
const credit = createCredit(store);

const topBar = el('div', 'topbar');
const tabBar = el('nav', 'tabs');

const stage = el('div', 'stage');
stage.append(map.root, jovian.root, telescope.root);

const left = el('div', 'dock dock--left');

const right = el('div', 'dock dock--right');

const notice = el('p', 'notice');

const app = el('div', 'app');
app.append(topBar, tabBar, left, stage, right, notice, credit.root);
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
  const { locale, moon, timingMode } = store.current;
  const pressed = store.clock.julianDate;
  const eclipse = nearestEclipse(scenePositions, moon, pressed, {
    matchOn: timingMode,
    perAuDays: store.lightTimePerAuDays,
  });

  if (!eclipse) {
    logPanel.report(translate(locale, 'log.nothingThere'));
    return;
  }

  // Four things, and every one of them is something an observer of 1676 could
  // have written down: when they pressed, which moon, which kind of event, and
  // how far Jupiter was by the orbital model. No true time is stored, because
  // nobody has ever had one — see the head of `solve.ts`.
  log.add({
    jdRecorded: pressed,
    moon,
    phase: eclipse.phase,
    distanceAu: eclipse.distanceAu,
    mode: timingMode,
  });

  logPanel.report(translate(locale, 'log.recorded', { count: log.countIn(timingMode) }));
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

/** Observations per year of campaign — enough to see the shape, few enough to scroll. */
const SAMPLES_PER_YEAR = 20;
const DAYS_PER_YEAR = 365.25;

/**
 * A ready-made log, so the analysis can be reached inside a 45-minute lesson.
 *
 * Spread evenly across the campaign length rather than packed into the first
 * year, because the length is the point of the setting: at one year the lateness
 * climbs and falls once and could be almost anything, and at six it has come
 * back to where it started five times over. Nothing that drifts does that.
 *
 * Generated for whichever experiment is armed, and anchored at the app's opening
 * date rather than wherever the clock happens to be — the readings have to land
 * inside the window the delay curve draws, or the overlay that makes the
 * periodicity visible has nothing to show.
 *
 * The scatter is deliberate: a clean log would fit suspiciously well and teach
 * the wrong thing about measurement (CLAUDE.md §7.4). It is applied identically
 * in both modes, so the flat result of the control experiment is a genuine null
 * and not a tidier version of the real one.
 */
function loadSampleLog(): void {
  const { moon, timingMode, campaignYears } = store.current;
  const random = seededRandom(1676);
  const observations: Observation[] = [];

  const count = Math.round(SAMPLES_PER_YEAR * campaignYears);
  const spacing = (campaignYears * DAYS_PER_YEAR) / count;

  for (let i = 0; i < count; i++) {
    const eclipse = nextEclipse(
      scenePositions,
      moon,
      OPENING_JD + i * spacing,
      'disappearance',
      store.lightTimePerAuDays,
    );
    const slip = (random() - 0.5) * 150; // seconds, a human judging a fade
    const watched = timingMode === 'seen' ? eclipse.jdSeen : eclipse.jdTrue;
    observations.push({
      jdRecorded: watched + slip / 86_400,
      moon,
      phase: eclipse.phase,
      distanceAu: eclipse.distanceAu,
      mode: timingMode,
    });
  }

  log.replaceMode(timingMode, observations);
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

/**
 * The two tabs, and switching one changes the universe underneath everything.
 *
 * The clock is left where it is rather than reset. A student who has found a
 * good stretch of eclipses and flips across to see what the same moment looks
 * like with slower light is asking a good question, and moving the date out from
 * under them would be answering a different one.
 */
function buildTabs(): void {
  const { locale, tab } = store.current;
  tabBar.replaceChildren(
    ...(['demonstration', 'game'] as const).map((id) =>
      button(`tab${id === tab ? ' tab--active' : ''}`, translate(locale, `tab.${id}`), () =>
        store.patch({ tab: id }),
      ),
    ),
  );
}

/**
 * The right dock, which is not the same on both tabs.
 *
 * The walkthrough and the game are the two things that explain what a student is
 * doing, and showing both at once would offer two answers to the same question.
 */
function buildDocks(): void {
  const game = store.current.tab === 'game';

  left.replaceChildren(controls.root, ...(game ? [] : [walkthrough.root]));
  right.replaceChildren(
    readout.root,
    ...(game ? [gamePanel.root] : []),
    delayCurveView.root,
    logPanel.root,
    solveView.root,
    comparison.root,
  );
}

document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;

  if (event.code === 'Space') {
    event.preventDefault();
    record();
    return;
  }

  const direction = event.code === 'ArrowRight' ? 1 : event.code === 'ArrowLeft' ? -1 : 0;
  if (!direction) return;

  // A minute a press, or a second with shift held. The fine step is what makes
  // the clock genuinely steerable: an eclipse is judged to a few seconds, and a
  // minute is the whole quantity being argued about a fifth of the time.
  event.preventDefault();
  store.clock.step((direction * (event.shiftKey ? 1 / 60 : 1)) / 1440);
  store.ticked();
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
  const scene = buildScene(store.clock.julianDate, MOON_PERIODS, store.lightTimePerAuDays);
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
  buildTabs();
  buildDocks();
  credit.render();
  controls.render();
  walkthrough.render();
  logPanel.render();
  solveView.render();
  gamePanel.render();
  renderScene();
}

store.subscribe(renderPanels);
store.clock.setRate(store.current.rateDaysPerSecond);
renderPanels();
requestAnimationFrame(frame);
