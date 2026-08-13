# Rømer — the first measurement of the speed of light

## 1. What this is

A teaching tool that reconstructs **Ole Rømer's 1676 determination that light
travels at a finite speed**, from the geometry that produces the effect through
to the measurement a student makes themselves.

The subject is one observation and one inference. Io goes round Jupiter every
1.769 days and is eclipsed by Jupiter's shadow once per revolution — a clock in
the sky, ticking at a rate nobody could plausibly claim was variable. Rømer,
working through Cassini's eclipse tables at the Paris Observatory, found that the
ticks ran early when Earth was near Jupiter and late when it was far, by a total
of some tens of minutes across half a year. The clock was not wrong. The light
carrying the news had further to travel.

That is the entire argument, and it is the first time anyone put a number on the
speed of light. This app exists to make it something a student performs rather
than reads.

**The app is built on the Newtonian model** — `nbodyEngine` from `@orrery/core`,
where the planets' orbits emerge from integrating the force law rather than being
prescribed. That is the right engine for this subject on two counts. It is
contemporary with the measurement, and Rømer's result was one of the things
Newton had in hand: the *Principia* cites the finite speed of light as
established. And the quantity the whole demonstration rests on is the
**Earth–Jupiter distance**, which is a matter of dynamics rather than of angular
fitting.

---

## 2. Who it is for, and how it must read

**A high-school student, in a physics lesson, meeting this for the first time.**
Not a university course, not someone who already knows what an opposition is.
That constrains every user-facing string in the app, and it is a harder
constraint than it sounds — the subject is genuinely simple and the vocabulary
around it is genuinely not.

The point being demonstrated is a landmark in the history of physics: **the
moment a quantity everyone had assumed was infinite turned out to be finite and
measurable.** Everything in the app serves that. A detail that does not help a
sixteen-year-old see that point is a detail to cut, however true it is.

### 2.1 Rules for user-facing text

These apply to the walkthrough, the panel notes, the log, the fit view, tooltips,
error messages — everything a student reads. **They do not apply to this file**,
which is working notes for whoever is building the thing and can be as dense as
it likes. Keeping those two registers apart is a real risk: it is very easy to
paste a good sentence from here into the UI.

- **Short sentences.** One idea each. The prose in §1 above is roughly twice as
  heavy as anything the app should show.
- **Define every term on first use, in the same sentence.** *Opposition* — when
  Earth passes between the Sun and Jupiter, so Jupiter is closest to us.
  *Eclipse of Io* — when Io goes into Jupiter's shadow and disappears.
  Not a glossary the student has to go and find.
- **No undefined jargon at all**: ephemeris, residual, osculating, synodic,
  immersion, emersion, O−C, regression, epoch. Some of these have a plain
  equivalent (*going in* and *coming out* for immersion and emersion). Where one
  has no plain equivalent, either define it or do not use it.
- **Numbers a student can check by hand.** Light crosses the Earth's orbit in
  16.6 minutes. Jupiter is between 4.2 and 6.2 times further from us than the Sun
  is. Prefer km and km/s over AU where a student's intuition lives — an AU means
  nothing to them yet, and 300 000 km/s does.
- **At most one equation on screen at a time**, and it must be stated in words
  first. `distance = speed × time`, rearranged, is the whole of the mathematics
  here and it should feel that way.
- **Never "obviously", "simply", "of course", "trivially".** If it were obvious
  it would not have taken until 1676.
- **Say what was hard.** Rømer was doubted for fifty years. Cassini, who had the
  same data, did not accept the conclusion. That is not a footnote — a student
  who learns that good scientists disagreed about a real result has learned
  something the physics alone does not teach.

### 2.1a Claims the audit corrected

Every factual claim in the interface was checked against the model rather than
against memory, and four were wrong. They are listed because the *kind* of error
matters more than the individual fixes.

- **"Each moon disappears into the shadow once every orbit."** False for half of
  them. A moon is eclipsed every revolution only while its excursion out of
  Jupiter's orbital plane stays inside the umbra, and that fails further out:
  measured over a year, Io and Europa are eclipsed on every revolution, Ganymede
  on 48 of 51, and **Callisto on only 8 of 21** — 72 601 km out of plane against
  a 69 981 km umbra at its distance. Real Callisto has eclipse seasons for the
  same reason, so the model was right and the sentence was wrong.
  `eclipseSeasons.test.ts` now holds the whole table.
- **"The best hope of working out longitude at sea."** The Galilean moons never
  worked at sea — a telescope will not hold steady on a rolling deck. They did
  solve longitude *on land*, and redrew the map of Europe. The corrected line
  says both, and the failure at sea is the better story anyway.
- **"That difference is the width of Earth's orbit."** Said of the delay curve's
  full swing, which is about 19 minutes over three years against the 16.63 that
  Earth's orbit alone accounts for. Jupiter moves too. Now stated as *most of
  the difference*, with the 16.6 minutes named and the remainder attributed.
- **"Io is going into Jupiter's shadow"** and the empty-log hint, both of which
  named Io while the student might be watching any of the four. Parameterised.

The lesson for anything added later: a sentence about the model is a claim about
the model, and the model can be asked. Two of these four were caught only by
computing the answer.

### 2.2 What to leave out

Things that are true, that belong in this file, and that must not reach the
screen: the iteration scheme in §5.1, the shadow-cylinder-versus-cone argument in
§5.4, anything about `epochLongitude`, engine names, Julian Dates, and the whole
of §6 as written. §6 does have to be *said* to the student — see §6's second
obligation — but in one plain sentence, not as the analysis it is here.

---

## 3. Decisions locked

These are settled. Changing one is a decision to be taken deliberately, not a
detail to be reconsidered while implementing something else.

| Topic | Decision |
|---|---|
| Audience | **High-school student, first encounter.** §2 governs every user-facing string |
| Languages | **Czech and English, both complete.** Czech is the default and the original — see §10 |
| Repository | **New sibling repo**, `F:\Vyvoj\AI\RoemerLightSpeed`, consuming `@orrery/core` as `file:../ClaudePtolemy/packages/core` — the `PtolemyReconstruction` pattern exactly |
| Position engine | **Newton** (`nbodyEngine`) is the engine on show; the reference ephemeris is available for cross-checking and for tests |
| Io ephemeris | **Phenomenon-accurate, not calendar-accurate.** Core's satellite elements are used as they stand — see §6, which is the most important section in this file |
| True vs. observed | **One map, ghost overlay.** Solid = what Earth sees; faint ghost + link line = where the body actually is at this instant |
| Interactivity | **Two treatments**: a free observation log in which the student times eclipses and works out *c* from their own numbers, and a guided walkthrough of Rømer's 1676 reasoning |
| Getting to *c* | **Two routes, simple one first** — Rømer's own arithmetic, then the careful fit (§7.3) |
| Layout | **Controls left, instrument centre, measurements right**, language and notes in a bar at the top right. Split by purpose, so nobody hunting a control reads past a number |
| Delay curve | **A standing plot of light time against date**, marked with the nearest and furthest approaches — the setup, not the answer. See §9 |
| Not included | No standing **residual**-versus-distance panel and no adjustable-*c* slider. Considered and left out; do not add either without asking |
| Aberration | **Deliberately absent.** Light-time only — see §5.3 |
| Stack | **TypeScript + Vite, vanilla DOM, CSS-only drawing.** No UI framework, no canvas |
| Deployment | **Static files, GitHub Pages from Actions**, relative base path, works offline once loaded |
| Time range | Core's `MIN_JD`–`MAX_JD` (1600–2400). Opens on **1676**, the year of the measurement |

---

## 4. What core already gives, and what this repo must build

`@orrery/core` ships **compiled** JS and declarations, not source. Both
checkouts must be present, and **after editing core you must run
`npm run build:core` in ClaudePtolemy or the change never arrives here.**

### 4.1 Taken from core, unchanged

- `nbodyEngine` — Newtonian positions of Sun, planets and Moon, checkpointed so
  a seek is affordable.
- `satelliteOffsetAt(jd, id)` — Io, Europa, Ganymede, Callisto and Titan
  relative to their primary. Analytic and cheap, which §5.4 depends on.
- `BODIES`, `AU_IN_KM`, body radii, `SATELLITE_IDS`.
- `SimulationClock`, `jdFromCalendar`, `calendarFromJd`, `clampJd`.
- `vec3` arithmetic, `recenter`, `apparentLongitude`.

Import from subpaths, not from the barrel — `@orrery/core/engines/nbody`, not
`ENGINES` — or the bundle pulls in all eight engines and the VSOP87 tables for
nothing.

### 4.2 Built here, because core does not have it

Core's positions are **geometric**: the orrery's own notes record, under
deliberate simplifications, that it applies no light-time correction because the
effect is about 0.01° against a 30° zodiac sign. For that app that is a sound
call. For this one the omitted effect *is* the subject.

So this repository owns:

- **light-time retardation** (§5.1) — the one piece of physics the family does
  not already contain;
- **the eclipse solver** (§5.4) — when Io enters and leaves Jupiter's shadow;
- **the observation log and the two routes to *c*** (§7);
- **the guided walkthrough** (§8);
- its own CSS. Core ships no stylesheet. The orrery's visual language — brass
  on parchment, engraved hairlines, serif labels — is reproduced here as this
  repo's own tokens, the way `PtolemyReconstruction` does it. Copy the look, not
  a dependency.

Anything that turns out to be genuinely general — light-time is the candidate —
may later be pushed *up* into core. Do not do that speculatively. It costs a
core release and a version bump in two consumers.

---

## 5. The physics

### 5.1 Light-time retardation

What an observer sees at time *t* is where the body was at *t* − τ, where τ is
the light travel time over the distance the light actually crossed. That
distance depends on where the body was, which depends on τ — so it is solved by
iteration:

```
τ ← 0
repeat:
  emit  = tObserve − τ
  τ     = |position(body, emit) − position(observer, tObserve)| / c
```

Three passes are ample at solar-system distances; the correction to τ after the
first pass is of order (v/c)·τ. Assert the convergence in a test rather than
trusting the sentence.

None of this reaches the screen. To a student it is one sentence: *what you see
is where it was when the light left, not where it is now.*

Constants:

| | |
|---|---|
| *c* | 299 792.458 km/s — exact by definition of the metre |
| light time, 1 AU | 499.005 s = 8.3168 min |
| light time, Earth's orbital diameter | 998.01 s = **16.63 min** |
| Earth–Jupiter range | ≈ 4.2 AU at opposition to ≈ 6.2 AU at conjunction |
| the same, as light time | ≈ 35 min to ≈ 52 min |

The 16.63 minutes is the number the whole app is arranged around. **Rømer's own
figure was 22 minutes** for the crossing of the Earth's orbit — about a third
too long. He published no speed himself; Huygens converted the figure in 1678
and got roughly 2×10⁸ m/s, low both because of the 22 minutes and because the
astronomical unit was then badly known. The app should show the student's own
value beside both, because *being a third out and still right about the thing
that mattered* is the honest shape of the result, and it is a point a
sixteen-year-old can take away: the first measurement of anything is usually
poor, and that is not the same as being wrong.

### 5.2 Observer

Earth, always, and this is not a limitation to be relaxed later. The orrery lets
you observe from Mars because "what does the sky look like from Mars" is a good
question. Here the observation point is part of the historical subject: Rømer
stood in Paris. A picker would invite a student to switch to Jupiter, where the
delay is zero and the demonstration is empty.

### 5.3 Aberration is deliberately excluded

The observer's own motion tilts the apparent direction of a body by up to about
20.5″. That is a real effect and it is *also* a measurement of the speed of
light — Bradley's, in 1728, and a better one than Rømer's. It is not this one.

Mixing them would be a mistake in teaching before it was a mistake in physics:
light-time is a *delay* and aberration is a *direction*, they are measured by
different observations, and the app's job is to isolate the first. If aberration
is ever wanted, it belongs in a clearly separate mode with its own explanation,
not folded into the ghost offset.

### 5.4 The eclipse

An eclipse of Io is Io entering Jupiter's shadow. The shadow is a **cone**, not a
cylinder, because the Sun is not a point: it starts at Jupiter's equatorial
radius (71 492 km — the equatorial figure, not core's mean 69 911, since the
Galileans orbit near the equatorial plane) and closes to nothing some 8.9×10⁷ km
behind the planet.

That taper was nearly dismissed as negligible and it is not. Across Io's orbital
radius of 421 800 km the umbra narrows by **0.47%** — 338 km, which at Io's
orbital speed is **19.5 seconds** of timing, against a signal of 16.6 minutes. It
would have been a systematic common to every eclipse and would have very largely
cancelled out of the fitted speed, but "it cancels" is a much weaker thing to
rest on than "we modelled it", and modelling it is one multiplication.

The condition, with **s** the unit vector from the Sun to Jupiter and **r** the
Io-relative-to-Jupiter offset:

```
inShadow  =  (r · s) > 0            and  |r − (r·s) s| < R_umbra(r · s)
```

The solver bisects `max(offAxis − R_umbra, −behind)`, a single continuous value
that is negative exactly when both conditions hold — a boolean pair has nothing
to bisect, and a bracket must never straddle a discontinuity.

**Eclipses recur at the *synodic* period, not the sidereal one.** The shadow
points away from the Sun and that direction turns as Jupiter orbits, so the moon
must travel slightly past one revolution to meet it again: 1/P_eclipse = 1/P_moon
− 1/P_jupiter, giving Io 1.769861 days against a sidereal 1.769138. Sixty-two
seconds each time, three and a half hours over a year — twelve times the whole
light-time signal, so nothing may be numbered with the sidereal period.

Io's orbital inclination carries it at most about 16 000 km out of Jupiter's
orbital plane, well inside the 71 492 km shadow radius, so **every revolution
produces an eclipse** — no gaps to special-case.

**Solving for the time**: bracket by coarse sampling at a fraction of Io's
period, then bisect on the shadow function. Cost is the reason §4.1 stresses
that `satelliteOffsetAt` is analytic — the solver varies Io's offset, which is a
closed-form evaluation, while Jupiter's and the Sun's positions barely move over
the few hours being bisected and can be sampled once per bracket. Do **not**
call the n-body engine inside the bisection loop.

**Two clocks, and keeping them straight is the whole app.** The eclipse happens
at a *true* time; it is *seen* at true time + τ(Jupiter→Earth). Every value the
UI shows must be labelled which one it is. A variable named `jd` with no
qualifier is a bug waiting to happen; use `jdTrue` and `jdSeen` throughout, in
core logic and in the log's data model alike.

In the interface these two are **"when it really happened"** and **"when we see
it"**. Not "true" and "apparent", which sound like a judgement about which one
is real.

### 5.5 The event is not instantaneous, and that matters

Io is 3 642 km across and moves at about 17.3 km/s, so it takes roughly
**3½ minutes** to pass fully into the shadow. Against a signal of 16.6 minutes
that is not a rounding detail — it is a fifth of the effect, and it is precisely
why Rømer needed a great many eclipses rather than two well-chosen ones.

The app should therefore report the disappearance as a span rather than an
instant, and the observation log should let the student record a time within it
(§7). A demonstration that hands out exact instants teaches that the measurement
was easy, which is the one thing it certainly was not.

This is also the most valuable thing in the app about *how measurement works*,
and it is well within reach of the audience: your individual readings are sloppy,
you take many, and the average is far better than any one of them.

---

## 6. The honest limitation, and why the demonstration survives it

**Core's satellite mean longitudes are approximate.** Io's `epochLongitude` is
`120.0` — a round number, not a fitted one. The orrery's own notes say precision
is not claimed and that the configuration on a given date is not to be trusted.
That is inherited here unchanged, by decision.

The consequence has to be stated exactly, because it is narrower than it sounds:

- **Wrong**: which calendar date and hour a particular eclipse falls on. An
  eclipse the app puts on 9 November 1676 is not the eclipse Rømer predicted for
  9 November 1676. The offset is essentially a constant phase error in Io's
  orbit.
- **Right**: the *interval* between eclipses, because `periodDays = 1.769138` is
  accurate; and therefore the **deviations** of observed intervals from a
  constant period. That deviation is the measurement. It is set by the
  Earth–Jupiter distance, which comes from the n-body engine, not from Io's
  phase.

A constant phase error shifts every eclipse by the same amount and cancels
completely out of the comparison the student actually makes. **The quantity they
measure is unaffected.** A student working this app should recover *c* to within
a few percent, and a test must assert that, because it is the claim the whole
project stands on.

Two obligations follow, and neither is optional:

1. **The app says so, in the interface, where a student reads it** — not only in
   this file, and in one plain sentence rather than the analysis above. Something
   close to: *The eclipses in this model happen at the right rate, but not on the
   exact dates they happened in history — so the pattern you measure is real,
   while the dates on screen are not.*
2. **The guided walkthrough (§8) never claims to reproduce a specific historical
   observation by date.** It reconstructs Rømer's *reasoning* against correct
   geometry. Quote his dates as history, in prose, clearly separated from what
   the model is showing.

The upgrade path, if this ever becomes insufficient, is to fit Io's epoch
longitude to published eclipse times — one number — which would make absolute
dates good to minutes near the calibration epoch and decay slowly away from it.
That was considered and declined for now. A full Lieske-class Galilean theory is
the only thing that would make 1676 exact, and it is more work than the rest of
this app together.

---

## 7. The observation log — the student's own measurement

The primary interactive treatment. The student does what Cassini's observers
did, and then what Rømer did with their book.

### 7.1 Observing

Run the clock, watch the Jovian system, and time the moment the moon disappears
into the shadow or reappears from it. The map is the whole solar system (§9),
but timing an eclipse needs the telescope view: the four Galilean moons strung
out beside Jupiter's disc, as they look in an eyepiece, with the watched one
fading out over §5.5's three and a half minutes.

**What gets logged is the time they pressed, not the true time.** The error they
make is part of the exercise, and with a couple of dozen eclipses it averages
down in front of them.

**The way in has to be visible.** The first version bound recording to the space
bar and mentioned it in one italic hint, which is the same as having no way in
at all. The panel now carries three numbered steps in the order they are done
and a large button as the primary action, with the key offered beside it as the
shortcut it is — the button is how you find out the key exists.

**A press is matched to the eclipse nearest it in *seen* time.** That is the only
clock an observer has: they are timing the arrival of the news, not the event.
A press with nothing within half an hour is **refused**, and says so, because a
stray key must not enter the log as an observation.

That matching is where the recorder was most badly wrong. It asked for the next
eclipse at or after *two periods ago* — an event three and a half days in the
past — so every row came out about **2 800 minutes late** and the whole
measurement was nonsense. `nearestEclipse.test.ts` pins down both the fix and
the failure, including that matching on true time must never happen by default.

### 7.1a The control experiment

Seen time is the default and the honest case. The interface also offers the
**impossible** one: time the eclipse *itself*, as though light were infinitely
fast. `TimingMode` in `solve.ts`, `matchOn` in `nearestEclipse`, and it must
always be asked for explicitly.

This is not a display option, it is the experiment that makes the argument close.
An effect that appears in one run and not the other, with the same eclipses, the
same moon and the same unsteady hand, cannot be blamed on the clock, the
instrument or the observer. Timing what you see, the lateness runs from 33 to 52
minutes and the fitted slope stands at some seventy standard errors. Timing the
event, the lateness is the student's own scatter about zero and the slope falls
under two. Both are asserted in `solve.test.ts`.

Three consequences the code has to honour:

- **The two runs are never mixed.** Every observation records its mode; the log
  keeps both and everything that analyses it filters to one. Storage went to
  version 2 for the field, and a row without one is discarded rather than
  guessed — the single case a guess would get wrong is the control, where a
  mislabelled row silently poisons the comparison.
- **A slope indistinguishable from zero must not be divided into.** `AU / slope`
  on noise yields a confident six-digit speed of light with a huge error bar, and
  the eye reads the big number, not the bar. Below three standard errors
  (`slopeSigma`), the interface says outright that there is nothing there.
- **The jumps and the telescope follow the armed mode**, or the control
  experiment sends a student to a moment forty minutes after the event they came
  to watch.

### 7.2 The log

Six columns: date, going-in or coming-out, **when you saw it**, **what your
timetable says**, **the difference**, and **how far Jupiter was**. Persisted to
`localStorage`, and the app must still work when that is unavailable.

Putting *the difference* next to *how far* is what makes the pattern findable by
eye, before any graph is drawn — the difference climbs as the distance climbs.
That is how Rømer found it, reading down a table, so those two columns earn their
width.

A row stores four things and only four: **a time, a moon, a kind of event, and a
distance**. Every one of them is something an observer of 1676 could write down.
The distance comes from the orbital model, which is where Rømer's came from too,
and is recorded with the row rather than recomputed later — otherwise a student
who cleared or edited the log would get a silently different answer.

**The distance is taken at the moment of the reading, not at the event.** It was
`eclipse.distanceAu` — the distance the light actually crossed, measured from the
true emission — which is a fact about the *event* and not about the observation.
The two differ by whatever Earth and Jupiter did during the crossing: under a
thousandth of an AU at the real speed of light, but 0.014 AU in the game at
twenty times slower, and in both cases a number quietly imported from the answer.

### 7.2b Nothing absolute reaches the answer

The claim that the method rests on differences between observations is strong
enough to check rather than assert, and `solve.test.ts` checks it four ways.
Each perturbs something no observer could have known and demands the answer not
move:

- **Shift every recorded time by a week.** A calendar off by days, a clock off by
  an hour, a differently chosen epoch — none of it can matter. This one found a
  real defect: the fit was being done on raw Julian Dates near 2 430 000, which
  resolve about 40 µs in a double while the residuals being fitted are a few
  hundred *milliseconds*. Referring everything to the first reading — the whole
  fit now lives in days-since-origin — cut the shift sensitivity by a factor of
  eighty, down to float noise.
- **Get the counting aid 3% wrong.** The one piece of model knowledge left is the
  moon's rough recurrence, used to round each gap to a whole number of eclipses.
  The period that reaches the answer is refitted from the student's timings, so a
  hint wrong by fifty times the light-time signal must change nothing at all.
- **Count the fields on a row.** Structural, and it is what keeps the rest
  honest: if a field for the true time ever comes back, the test fails.
- **Check the distance is the one at the reading**, not at the event.

### 7.2a The timetable is fitted, not looked up

**The single most important correction this project has had.** The column now
headed *what your timetable says* used to hold the model's own light-free eclipse
time and was headed *when it was due*. That is arithmetically convenient and
historically false, and the falsehood is not a detail: it hands the student a
quantity nobody has ever possessed. There was no independent channel to Jupiter.
The light *is* the event, as far as any observer is concerned, and a column
asserting otherwise deletes the entire difficulty of the discovery.

What Rømer had was a table built from **earlier observations** — Cassini's tables
were an empirical fit: watch the eclipses, find the interval, extrapolate. So the
comparison that produced the discovery was never observation against reality. It
was **observation against other observations**, timings from one part of the year
against a rhythm established in another.

So `buildTimetables` fits the student's own log with a period and an epoch per
kind of event, and every row is compared with *their* extrapolation. No true time
is consulted anywhere. Four consequences, all of them physics rather than
concessions:

- **Accuracy drops by an order of magnitude, to about ±10%.** That is the honest
  price. What is left over is the drift in the eclipse interval — precisely what
  made Cassini's tables imperfect and precisely why Cassini did not believe the
  result. Rømer himself was 32% out; the two-eclipse route now lands at about
  34%, which is not a coincidence worth hiding.
- **The mean delay is not recoverable at all.** Fitting an epoch absorbs any
  constant offset; only the *variation* survives. This is exactly why Rømer's
  result was "twenty-two minutes to cross the Earth's orbit" rather than a delay
  to Jupiter in minutes, and the interface says so (`solve.meanNote`).
- **The run must outlast about one and a half synodic cycles**, ~598 days. Below
  that the Earth–Jupiter distance and the drift trace curves no fit can separate
  — measured, the *control* experiment on a 402-day run reported a detection at
  six and a half standard errors in a universe with no light travel at all. Such
  runs are refused outright (§7.5).
- **The interval is allowed to drift**, with one slow term or two. See
  `slowTerms`; the boundary was measured, and both ways of crossing it are
  spectacular — a second term on a one-cycle run returned a speed 818% out
  because the timetable had absorbed the signal, and a single term on a nine-year
  run came out 86% out because it could not follow the drift.

### 7.3 Two routes to the answer, and the simple one comes first

This is where the audience decision does real work. There is a correct way to
extract *c* from a log and there is an understandable way, and they are not the
same. Both are offered, in this order.

Both rest on one quantity, and it is the one Rømer actually worked with: **how
late an eclipse was against the prediction.** He did not fit a line to eclipse
times — he had Cassini's tables, and he compared. So does this app, and the
choice is not only historical; see the box below for what the obvious
alternative cost.

**Route 1 — Rømer's own arithmetic.** Take an eclipse from when Jupiter was
nearest and one from when it was furthest. Each was some minutes later than the
almanac said. The far one was later still, and the difference is how much longer
the light took; the extra ground it covered is the change in distance.

```
speed = extra distance ÷ extra time = 300 000 000 km ÷ 1000 s
```

Two numbers, one division, no period and no counting. This is the version on
screen when the words "you have just measured the speed of light" appear.

**Route 2 — use all of it.** The same idea applied to every eclipse rather than
two: plot how late each one was against how far Jupiter was, and the points lie
on a line whose steepness gives *c*. Presented as *"now let's use all your
measurements instead of two"*, with the plot doing the explaining. The gain is
that the random error in any single reading stops mattering, which §5.5 has
already set up. Measured on the ready-made log: route 2 lands within about 1%,
route 1 within about 6% — and route 1 being the worse of the two is the honest
result, not a defect.

> **Why not count eclipses and multiply by the period?**
> Because it was tried, and it leaves a systematic behind. The shadow points
> away from the Sun and Jupiter's orbital speed is not constant, so eclipses are
> not *quite* evenly spaced even with no light at all: measured across 1676, the
> true times wander ±1.1 minutes about a straight line. Small — except the
> wander is smooth and partly tracks the Earth–Jupiter distance, so it aliases
> into the answer at around 10%, and no quantity of extra observations reduces
> it. Comparing against a prediction that already contains Jupiter's motion
> removes it exactly. The prediction carries no light-time whatever, so it is an
> almanac and not the answer.

Report the value in km/s, the percentage off the true 299 792 km/s, and put
Rømer's 22 minutes and Huygens's speed beside it.

The plot lives **inside this view**, drawn from the student's own data. It is not
a standing panel of the app's own numbers — that was considered and declined
(§3), because a plot the app draws from perfect knowledge answers the question
before the student has asked it.

### 7.4 Seeding

Timing two dozen eclipses at a workable rate is a long sitting, and a school
lesson is 45 minutes. Two mitigations, both honest: a fast-forward that jumps to
the next eclipse, and an option to load a pre-recorded log so the analysis can be
reached directly. The pre-recorded log must carry realistic timing scatter — a
clean one would give a suspiciously perfect answer and teach the wrong thing
about measurement. The same scatter is applied in both timing modes, so the
control experiment's null is a genuine null and not a tidier version of the real
run.

### 7.5 How long the run covers

A campaign length — **two**, three, six or twelve years — governing both the
ready-made log and the window the delay curve draws. Twenty observations a year,
spread evenly across the span and anchored at the app's opening date rather than
at wherever the clock happens to be, so the readings land inside the window the
curve covers.

The setting exists for two reasons, and the second is not optional.

**It makes the periodicity visible.** Jupiter returns to the same arrangement
with Earth every 399 days, so a run shorter than that shows a *trend* and a run
longer than it shows a **periodicity**. A trend could be a clock running slow, an
instrument wearing, an observer's habit settling in. None of those come back to
where they started every thirteen months. Stretching the run until the difference
has risen and fallen five times is what turns a suggestive graph into one that
rules the alternatives out — the argument §8's step 3 asks a student to follow.

**It is also the condition under which the method works at all.** With the
timetable fitted from the student's own data (§7.2a), a run inside one cycle has
its signal eaten by the fitted interval. The shortest option is therefore two
years and not one, and a hand-recorded run below ~598 days is refused with an
explanation rather than given a number. That refusal is a teaching moment worth
having: it is the reason Rømer needed years of Cassini's accumulated records, and
an app that hid it would be teaching that he was merely slow.

---

## 8. The guided walkthrough — Rømer's own reasoning

The second treatment: a stepped narrative that drives the model, so each claim is
made while the geometry that supports it is on screen. Not a slideshow with
pictures, and not a tour of the controls. This is the part a teacher can project
and talk over, so each step should stand as roughly one spoken minute.

The steps, in Rømer's order:

1. **The clock.** Io goes round Jupiter every 1.769 days and vanishes into its
   shadow each time. In the 1600s this was the most reliable clock anyone could
   see from anywhere on Earth, which is why observatories were tabulating it at
   all — it was how longitude was found **on land**, and it redrew the map of
   Europe. At sea it never worked: a telescope will not hold steady on a rolling
   deck. (The interface strings were corrected by the §2.1a audit; this line said
   "the best hope for working out longitude at sea" and was wrong with them.)
2. **Something is wrong.** The tables predict; the observations drift. Eclipses
   come early at some times of year and late at others.
3. **The wrong explanations, taken seriously.** Maybe Io's orbit varies. Maybe
   something about Jupiter. Both fail the same test: the error follows *Earth's*
   position, and Earth has nothing to do with Io. Give this step its time — a
   student who watches two reasonable ideas get ruled out has seen how science
   actually moves.
4. **The idea.** Nothing is wrong with the clock. What is delayed is the *news*.
   Show the ghost offset growing as Earth swings round to the far side of the
   Sun.
5. **The prediction.** In September 1676 Rømer said in public that the November
   eclipse would come about ten minutes late. It did. This is the step that makes
   it science rather than a curve drawn after the fact, and it deserves the most
   weight of the six.
6. **The number, and the fifty years of doubt.** 22 minutes across Earth's orbit;
   Huygens's speed from it; Cassini's refusal to accept it, which was not
   unreasonable — the effect sat at the edge of what the timings could carry
   (§5.5). Bradley settled the question in 1728 by a completely different route.

Step 5 is where §6's second obligation bites. The model cannot put a real
eclipse on 9 November 1676. Say what Rømer predicted and what was seen as
**history, in the prose**, and let the model show the *geometry* of that
moment — Earth far from Jupiter, the delay near its maximum — which it does get
right.

---

## 9. The view

### 9.0 Three columns, split by purpose

**Controls on the left, the instrument in the middle, measurements on the
right**, with language and the notes toggle in a bar across the top right. The
split is by what a thing is *for*, not by what kind of component it is: a
student hunting for a control never scrolls past a result, and a student reading
a result never scrolls past a control.

The left dock carries time, magnification, which moon, and three jumps. The
right carries the readout, the delay curve, the log and the answer.

### 9.0a Position with `left`/`top`, never with a percentage in `translate`

This cost an entire first version of the interface, so it is written down. A
percentage inside `translate` resolves against **the element's own box**; a
percentage in `left`/`top` resolves against **the containing block**. Writing
`--x: 45%` into `translate` on a 14-pixel marker moves it seven pixels, so the
whole solar system piles up within ten pixels of the Sun, every moon sits exactly
on top of its own ghost, and the telescope shows nothing at all. Everything
positioned in a field uses `left: var(--x); top: var(--y)` with
`translate: -50% -50%`.

The same arithmetic bites sloped lines. A rotated element's `width: var(--length)`
resolves against the parent's *width* while its `top` resolved against the
parent's *height*, so a sloped line's length cannot be one percentage unless the
box is square. Plots are therefore drawn as **dense dots**, not as rotated
segments.

### 9.1 The drawings

One composite instrument: a plan view with the Sun at the centre, orbits as
engraved rings, the Jovian system enlarged beneath it, and the telescope strip
below that.

**Two independent zooms**, because the two things worth magnifying differ by a
factor of four hundred: the plan view works in AU, the Jovian system in
hundredths of one. A shared control would be useless at every setting.

**The telescope's one axis is measured square to the Earth–Jupiter line**, not
along the ecliptic x axis. Those coincide only when Earth happens to lie due
y-ward of Jupiter, and using x regardless made the moons' spread wander with the
season for no physical reason. `scene.ts` computes the line of sight once and
every drawing takes its geometry from there, so the plan view and the eyepiece
are guaranteed to be showing the same configuration — the second seen end-on.
A moon further from Earth than Jupiter and within its disc is hidden exactly as
an eclipsed one is, because an observer at the eyepiece cannot tell them apart.

### 9.1a The Jovian inset shows the whole system, and says why it is a clock

All four Galileans with all four orbits, in a **square** field. It was a 2.2:1
strip at zoom 2, which put Callisto's ring 862 pixels across a 480-pixel box:
orbits are circles, so a wide short panel crops the outer two clean out of the
panel whose entire job is showing them. Square, at zoom 1, all four fit.

The inset carries a standing paragraph on **why these bodies are a clock at
all** — each moon circles at a fixed rate, Io every 1.77 days through to
Callisto's 16.69. Io and Europa vanish into the shadow on every revolution; the
outer two sometimes slip past it (§2.1a — Callisto on only 8 of 21). That is the
premise the whole measurement rests on, and without it the panel is a pretty
diagram. The argument a student has to be able to make is: *if the eclipses
arrive at the wrong time, the fault cannot be in the clock.*

### 9.1c The telescope has two lanes

The upper lane is the eyepiece: light delay and all, the only thing anybody has
ever seen. The lower lane is the same system at the same instant drawn as if
light were infinitely fast — the picture nature refuses to send.

Separate lanes rather than a ghost overlaid on the eyepiece, because the upper
lane has to stay *purely* what an observer sees or the panel stops being evidence
and becomes an illustration. The lower one is drawn to Jupiter's real position
with its own line of sight and its own shadow axis, so it is a straight answer to
the question rather than a half-corrected mixture of the two cases.

Run a close-up and the point makes itself with no prose at all: the lower moon
goes dark half an hour before the upper one begins to fade, because the news is
still in flight. The lane a key press is timed against carries a mark, so the
target is never in doubt.

### 9.1d Watching an eclipse at the pace it happens

A close-up button: jump to five minutes before the event, set the clock to **ten
times real time**, magnify, and start running. All four are needed — a close-up
you have to remember to press play on is one that gets missed.

Ten is the compromise the feature turns on. The fade takes three and a half
minutes and a class will not sit through it; at a hundred times it is a blink and
there is nothing to judge. At ten it takes twenty-one seconds: long enough that
pressing the button is a real decision, short enough to do twice.

The zoom is computed from the moon being watched (`closeUpZoom`), not fixed. The
four orbits differ by a factor of four and a half, and a zoom set high enough to
be worth it for Io throws Callisto clean off the field — a Callisto close-up
would magnify Callisto out of view.

### 9.1b Observed against real, after the measurement

Once a speed has been fitted, the number needs turning back into a picture. The
comparison panel states, for the moment on screen, **the same fact three ways**:
the light left this many minutes ago, the moon has moved this many degrees
since, and the light had this far to travel. Three numbers, one fact — a student
who reads them as three separate facts has not got it yet.

Below that, once there are at least three observations, it closes the loop with
the student's *own* figure: *you got 297 428 km/s, which would make the delay
51.9 minutes — that is 0.4 minutes from the real delay.* Their measurement error,
turned back into the quantity they were measuring.

### 9.2 The delay curve, and the student's readings over it

Light time plotted against date across the campaign length (§7.5), with the
nearest and furthest approaches marked and a playhead showing where the clock
stands. Measured: 33 minutes at the nearest approach, 52 at the furthest.

**Drawn as a variation about its own mean, not as an absolute**, and that is not
presentation — it is what the method can see. The timetable is fitted from the
student's own timings and fitting it absorbs whatever constant delay there is
(§7.2a). Plotting an absolute here and their differences over it would put the
two on axes that do not meet. The intro line therefore quotes the *swing* rather
than the two endpoints, because a number no tick mark agrees with is worse than
no number.

§3 rules out a standing plot of the app's own numbers, and this is the exception
that defines the rule. The banned one is the **residual** plot, which hands over
the result before the student has asked the question. This one hands over the
*setup* — where in the cycle to look, and why the effect is far larger at some
times of year than others. A student cannot discover that by scrubbing a
timeline, and asking them to is not teaching. The jump buttons exist for the same
reason.

**The student's own readings are drawn over it**, and the reason this costs
nothing is worth stating plainly: lateness is measured against a prediction
containing no light travel at all, so a reading's lateness simply *is* the light
travel time — the same quantity the curve is drawn from. The dots land on the
curve with nothing fitted, scaled or shifted. Measured: the readings track the
curve to within the reading scatter, and their mean sits at mid-field.

In the control mode the same dots collapse onto zero while the curve goes on
swinging above them — measured, a mean at 0.94 of the field height against 0.49.
The axis is therefore scaled to hold the readings as well as the curve, or the
flat line would be drawn off the bottom of the box and the one comparison the
panel exists for could not be seen.

Rebuilt only when the span, the mode, the log or the visibility of truth
changes. Twelve years costs about 110 ms in samples and turning points, which is
nothing on a click and a visible stutter on every frame.

**The plot is also a seek control.** Click anywhere on it and the clock goes to
that date, running or not. The panel already answered *where in the cycle am I*;
this makes it answer *take me there*, which is the question a student actually
has once they can see the effect is largest at one end.

**The bottom axis is in Earth years.** The caption used to be the only statement
of when the window ran — "from 1 January 1676 to 31 December 1678" — which gives
the ends and nothing about the middle, on a panel whose whole argument is about
*when* things happen relative to a 399-day cycle. Years are the unit that makes
the mismatch legible: the peaks drift steadily later against them, because 399
days is not a year. Labelled every year up to six and every other year beyond,
and the two outermost labels align to their own edge so the first does not land
on top of the y-axis tick beneath it.

**In the game the model curve is not drawn at all.** It *is* the answer, plotted
to scale — its swing is the light time, so its height scales with the slowdown.
The panel stays, because a student needs somewhere to watch their readings rise
and fall, but it is built from their observations alone and titled accordingly.
Handing over the curve to lay their points on would be handing over the answer
and asking them to check it, which is a different exercise entirely.

### 9.2a Time is a continuous control

A **logarithmic** slider from real time to 100 days a second, with named presets
beside it. It was seven fixed rungs stepped with − and +, and both ends were
wrong: between rungs there was nothing usable, and the slowest rung was still 172
times real time, so the app could not watch an eclipse at anything like its own
pace.

Log space is the only sane geometry for seven decades — equal distances along the
track are equal ratios, so the fine end gets as much of the track as the coarse
end. The track counts 0 to 1000 in whole steps rather than carrying the logarithm
directly, because a range input steps from its *minimum*: a step of 0.01 on a
track starting at −4.9365 never lands on the maximum, and dragging fully right
gave 99 d/s instead of 100.

The readout writes the rate in the largest unit that keeps the number under about
ninety — seconds, minutes, hours, days. Days per second is useless at the slow
end, where real time reads as "0.000 d/s" and a running clock appears stopped.
The seconds form is doing double duty and that is why it is chosen: sky seconds
per real second *is* the multiple of real time, so "1 s/s" reads as real time and
"10 s/s" as ten times it without a word of explanation. The arrow keys nudge a
minute, or a second with shift held — an eclipse is judged to a few seconds, and
a minute is a fifth of the whole quantity being argued about.

### 9.3 The ghost overlay

**The app's central device.** Solid markers are what Earth sees at the current
instant. Faint hollow ones are where the bodies actually are, with a thin link
line between the pair. Label them in the interface as **"where we see it"** and
**"where it really is"**; the word *ghost* is internal vocabulary and should not
appear on screen.

Measured on screen: Io's two markers sit 11 pixels apart at the default
magnification, and the caption says why — *light from Jupiter takes 50.4
minutes, and in that time Io moves 7.1° round its orbit*. Jumping to the nearest
approach drops that to 4.7°, which is the effect the whole app is about, visible
and quantified in one line.

**It belongs on the moons, not on Jupiter**, and the arithmetic is why. Jupiter
travels 0.0047 AU a day, so across even the longest light time — 52 minutes — it
moves 0.00017 AU. On a 300-pixel map spanning 5.6 AU that is **0.009 of a
pixel**: not small, invisible. Io in the same interval covers 5 to 7 **degrees**
of its own orbit, because it goes round in 1.77 days rather than twelve years.
So the Jovian inset is where the overlay lives and where it reads, and that is
not a workaround — it is the same fact the eclipse timing rests on. The eclipse
you are watching happened three quarters of an hour ago, and Io has since moved a
fourteenth of the way round.

Three rules:

- **The light-time gap is drawn to scale.** Never exaggerate it "so it can be
  seen" — an invented offset would be the one lie this app cannot afford, and a
  student who later learns the picture was faked loses the result along with it.
  Where it is too small to see, as on Jupiter itself, the honest answers are to
  magnify or to show it where it is legible. Not to inflate it.
- **The moons keep the orrery's linear exaggeration**, on the compressed scale
  only, for the same reason it exists there: at true scale Io sits a fraction of
  a pixel from Jupiter. This exaggeration is about the *system being legible*,
  not about the effect being visible, and the two must not be confused in either
  the code or the caption.
- **The telescope view is a separate panel**, not a zoom state of the map. It
  answers a different question — what an observer with an eyepiece sees — and it
  is where eclipses are timed (§7).

A running readout of the current light time, in minutes, and the current
Earth–Jupiter distance. These two numbers are the app, and they belong on screen
at all times. Phrase the first as **"light from Jupiter is 42 minutes old"**,
which is the whole idea in five words.

---

## 10. Czech and English

Both languages complete, **Czech the default**, English on a toggle, the
preference remembered in `localStorage` — the same arrangement as both sibling
projects.

Two things go beyond that arrangement, because of §2:

**Czech is the original, not a translation.** The walkthrough is six steps of
historical prose and the panels carry explanations; writing them in English and
translating produces Czech that reads like translated English, which a Czech
sixteen-year-old notices immediately and which quietly raises the reading level.
Write each string in Czech first, then render it into English. The English must
be good, but it is the second one written.

**The physics vocabulary is the Czech school vocabulary.** *Rychlost světla*,
*zatmění*, *měsíc Jupiteru*, *opozice*, *konjunkce* — the words a student has
already met in their own textbooks, not the words a translator would pick. Where
Czech and English idiom differ, follow each language rather than forcing
parallel structure; the two files hold the same *keys*, not the same sentences.

**Number formatting is a real trap and has bitten this family before.** Czech
writes `299 792,458` where English writes `299,792.458`, and this app is full of
numbers. Format in the view layer from raw values plus a unit tag, never in the
physics layer, and never build a formatted string by hand — the orrery's
calculation panel was written the wrong way round first and had to be redone.
Dates likewise: `9. listopadu 1676`, not `November 9, 1676` with the month
swapped out.

---

## 11. Layout

```
src/
  physics/
    constants.ts      # c, light time per AU, the shadow cone, the moons
    lightTime.ts      # retardation, iterative; the one new piece of physics
    shadow.ts         # the umbral cone; the continuous in/out function
    eclipses.ts       # bracket + bisect; jdTrue and jdSeen for each event
    configuration.ts  # nearest/furthest approach; the delay curve
    solve.ts          # route 1 (two eclipses) and route 2 (all of them) -> c
  state/
    store.ts          # clock, selection, overlay toggles, walkthrough step
    log.ts            # the observation log; localStorage persistence
  view/
    scene.ts          # one instant, computed once, shared by every view
    map.ts            # the plan view: Sun, Earth, Jupiter, the line between
    jovian.ts         # the inset — and the only place the ghosts are legible
    telescope.ts      # eyepiece strip; the timing surface
    readout.ts        # light time and distance
    comparison.ts     # observed against real, and the student's own number
    delayCurve.ts     # light time against date; the setup, not the answer
    controls.ts       # the left dock: time, zoom, moon, jumps
    format.ts         # locale-aware numbers, dates and units — see §10
    dom.ts            # three helpers, in place of a framework
  log/
    logPanel.ts       # the table
    solveView.ts      # the two routes, simple one first, and the plot
  walkthrough/
    steps.ts          # the six steps as data: prose key + model state
    walkthrough.ts    # driving the model from a step
  i18n/
    cs.json           # default, and the original
    en.json
    i18n.ts
  style.css
main.ts
index.html
```

`physics/` is pure — no DOM, no globals, no strings, unit-tested. It is the layer
that would be promoted to core if anything ever is.

`view/scene.ts` is the seam that keeps the three drawings honest: it computes one
instant once, so the plan view, the inset and the telescope can never disagree
about where Io is or which light they are showing.

**Draw from more than the animation frame.** A hidden tab, a projector that has
throttled rendering, or a browser honouring reduced motion can leave
`requestAnimationFrame` unfired indefinitely. The first version of `main.ts` drew
nowhere else and came up with a blank readout and an empty telescope until
something moved. Startup and every state change repaint too.

---

## 12. Tests that must exist

Not a wish list. These are the assertions the project's claims rest on, and each
one corresponds to a sentence above that would otherwise be unverified.

- Light time for 1 AU is 499.005 s; the iteration converges in three passes and
  is self-consistent — the light left where the body was at the emission date.
- `seenAt` is the inverse of the retardation, and accounts for the observer
  moving during the crossing.
- The umbra narrows 0.47% across Io's orbit, and taking it as a cylinder would
  have cost 19.5 s of timing (§5.4).
- The shadow function's sign and the eclipse predicate never disagree, sampled
  right round an orbit — which is what makes the value safe to bisect.
- Every revolution of Io produces an eclipse, and the solver catches both events
  of each, alternating and never repeating a phase.
- **Consecutive eclipses are separated by the *synodic* period, 1.769861 days —
  62 seconds longer than the sidereal 1.769138.** The shadow turns with Jupiter,
  so the moon must travel slightly past one revolution to meet it again. Over a
  year the two differ by three and a half hours, twelve times the whole signal.
  This was found by the suite failing, and it is asserted so it stays found.
- The same eclipses are **not** evenly spaced in *seen* time. That difference is
  the entire experiment and it gets its own assertion.
- Io takes 3–4 minutes to enter the shadow, which is §5.5.
- **The central one**: a synthetic log across two years, with a minute of reading
  scatter and **no true eclipse time consulted anywhere**, recovers *c* to within
  10% — and does so with Io's epoch longitude deliberately perturbed by 137°,
  which is what proves §6. Held at every campaign length the app offers, because
  the error does *not* fall monotonically with span and a student who changes the
  setting must never see the answer fall apart.
- **Both ways of misfitting the timetable are pinned** (§7.2a): a second slow
  term on a one-cycle run must return an absurd answer, and a single term on a
  nine-year run must too. These guard a boundary that was measured rather than
  reasoned, and neither failure announces itself in the arithmetic.
- **A short run is refused**, including the 402-day case that looks long enough
  and is not.
- The quoted uncertainty shrinks on cleaner readings.
- Route 1 lands within 45% — about Rømer's own 32% — and its two epochs cancel,
  so shifting the whole timetable by an hour must not move the answer at all. If
  that ever fails, a true time has crept back in.
- **A key press matches the eclipse nearest it in *seen* time**, gives a lateness
  of 30–55 minutes, and matching on *true* time instead fails **unless it is
  asked for explicitly**. A press with no eclipse near it returns nothing rather
  than an observation. This is the regression suite for the 2 800-minute bug in
  §7.1.
- **The control experiment is a genuine null** (§7.1a): the same eclipses, moon
  and reading scatter, timed against the events themselves, leave no lateness
  beyond the observer's own hand and a slope under three standard errors — while
  the same run read against arrival times stands above twenty. Both spans of
  Earth–Jupiter distance are asserted equal, so the null cannot be dismissed as a
  shorter campaign.
- **The log keeps the two experiments apart**: filtered, cleared and replaced by
  mode, and a stored row that does not say which experiment it belongs to — or
  which moon it is of — is discarded rather than assigned to one.
- **A log too thin to analyse returns nothing rather than throwing.** "Three
  observations" is not "three usable rows": the timetable drops any kind of
  event seen only once, so two disappearances and one reappearance leave two.
  Every panel guarded on the wrong count, so a log a student could build in a
  minute took the whole render down on the next page load. `analyse` is now the
  only door the views use; `solveFromAll` keeps throwing for the tests.
- **The game's universe still works.** With light twenty times slower the delay
  passes ten hours, and `nearestEclipse` must still match an arrival back to the
  event behind it. That window was widened for exactly this and the test is what
  stops it narrowing again.
- **The clock's readout never reads zero while the clock is running.** Real time
  is "1.0 s/s", not "0.000 d/s", and the scale climbs through minutes and hours
  to days as the number would run out of room. Czech writes the fraction with a
  comma, which is the third time in this family that a `toFixed` has had to be
  routed back through the formatter.
- The nearest approach is a real turning point rather than a low sample, lands
  near 4.2 AU, and the furthest near 6.2; the two alternate, and every nearest is
  closer than every furthest.
- The delay curve swings 16.6–20 minutes over three years and never leaves the
  32–54 minute band. The floor is set by Jupiter's own eccentricity: an
  opposition near its perihelion brings it inside 4 AU, which is 33.0 minutes of
  light — the first version of that assertion guessed 33 and was wrong.
- Newton's engine and the reference ephemeris give values of *c* that agree to
  within the measurement's own scatter. If they do not, the engine choice in §1
  needs revisiting rather than defending.
- **`cs.json` and `en.json` have identical key sets**, no empty strings, and the
  same placeholders in both. A missing Czech key that silently falls back to
  English is exactly the failure this project cannot ship.
- Numbers format with a comma in Czech and a point in English from the same raw
  value, and Czech months are named rather than swapped in from English. Two
  places bypassed the formatter with `toFixed` and printed `53.4 min` into a
  Czech interface — the confirmation after every recorded observation, and the
  zoom readouts. §10 exists precisely because this keeps happening.
- **Io and Europa are eclipsed on every revolution; Ganymede and Callisto are
  not.** Callisto manages 8 eclipses in 21 orbits, its widest gap running to
  five orbits — which is why the "next eclipse" search allows twenty rather than
  the ten it began with, and why the interface no longer claims otherwise.
- The log survives anything at all in `localStorage` — junk, an older version, a
  row that would reach the solver as a NaN — and works with no storage present.

Two limits worth knowing, both recorded in the suite rather than discovered
twice. A Julian Date near 2.4 million resolves about **40 microseconds** in a
double, so differencing two of them costs the last digits of a quantity as small
as an hour; assertions on light time are held to nine decimal places, not
twelve. And the light-time swing over a year exceeds 16.63 minutes — that figure
is the crossing of Earth's orbit alone, and Jupiter does not stand still while
Earth goes round.

Readability itself cannot be asserted by a test. Every new user-facing string
gets read back against §2.1 before it lands — that is the review step, and it is
not optional just because CI cannot do it.

---

## 13. Build and deployment

Mirrors `PtolemyReconstruction` exactly; copy its configuration rather than
inventing a new one.

- `npm run dev` on **port 5184** (5180 and 5183 are the orrery, 5181 and 5182
  the reconstruction). Add it to `C:\Users\richa\.claude\launch.json`.
- `npm run build` = `tsc --noEmit && vite build`. Vite with a **relative base
  path**, so the site works from any subdirectory.
- GitHub `richardLipka/roemer-light-speed`, Pages at
  `https://richardlipka.github.io/roemer-light-speed/`.
- The Pages workflow **checks out both repositories as siblings** inside the
  runner workspace, so the `file:` dependency resolves, and pins the orrery at a
  tag via `ORRERY_REF`. Start at **v0.6.0**, the current release. Core changes do
  not reach the published site until that line is bumped.
- No backend, no network at runtime, no writes beyond `localStorage`. The app
  must work correctly when `localStorage` is empty or unavailable.

---

## 14. Open, and to be decided when it is actually in the way

Listed so they are not silently resolved by whoever touches the code first.

- **Whether the other three Galilean moons are timeable**, or only Io. Rømer used
  Io; the others are eclipsed too but their events are harder to catch. Draw all
  four from the start — four moons circling something that is not the Earth is
  worth seeing on its own — and decide about logging them once the log works for
  one.
- **Whether observability is modelled**: Jupiter cannot be seen when it is near
  the Sun in the sky, and eclipses near opposition happen too close to Jupiter's
  disc to time. Real gaps in real observing runs, and honest, but they make the
  log harder to fill in a 45-minute lesson. Not decided.
- **Whether a teacher needs anything the student does not** — a way to reset a
  class's logs, or a link that opens the walkthrough at a given step. Wait until
  someone has taught with it.

---

## 15. The game — measuring an unknown speed of light

**The second tab, and the answer to the demonstration's one real weakness.** A
student who follows the demonstration has watched a measurement being explained,
and explanation is not doing. The answer is on the wall of every physics
classroom, so "you got 297 000" is checked against something already known — and
the part that made this hard in 1676, not knowing whether the number you have is
right, is exactly the part that has been removed.

So: light is slowed by a factor between five and twenty, **drawn at random and
not shown**. Same eclipses, same telescope, same timetable fitted from the same
kind of log. Measure, commit, then find out.

**Slower rather than faster**, deliberately. Faster light shrinks the effect
toward nothing and the exercise becomes one in patience; slower light makes the
effect *larger*, so the method is easier to carry out while the thing being
measured stays genuinely unknown. What is being tested is whether a student can
run the argument, not whether they can time a fade to the second. At fifteen
times, Io's ghost sits 136° round its orbit from where it is seen — the whole
device of the app, made unmissable.

The bounds are not arbitrary. Below five it is the demonstration again. Above
twenty the light time passes half of Io's 1.77-day period and the eyepiece stops
resembling anything an astronomer would recognise.

### 15.1 What the game required of the physics

**One value threaded everywhere, not a second copy of the app.** `store
.lightTimePerAuDays` is the only place the slowdown enters; `lightTimeDays`,
`retardedPosition`, `seenAt`, `findEclipses`, `nextEclipse`, `nearestEclipse`,
`delayCurve` and `buildScene` all take it as a parameter and default to the real
constant. A fork of the physics for the game would have rotted within a week.

Two things had to widen to survive it, and both are noted where they live:
`seenAt` iterates six times rather than four, because the observer moves much
further during a seventeen-hour crossing; and `nearestEclipse` searches two
periods either side rather than one and a half, because matching an arrival back
to its event now reaches much further into the past.

### 15.2 Rules the game must keep

- **Separate logs.** An observation made where light is fifteen times slower
  would drag a fit across two universes with nothing on screen to say why.
  `Logbook` holds both and hands views whichever the open tab is writing to.
- **A new universe clears the game's log.** Silently keeping it would fit across
  two different speeds of light and converge on neither.
- **The reveal is one-way**, and the manual slowdown control appears only after
  it. A game that let a student peek, adjust and re-measure would teach the one
  habit this whole app exists to argue against.
- **Until the reveal, the app states no truth at all** (`Store.truthVisible`).
  This was very nearly missed and the game was trivially spoilt without it: the
  headline read *"light from Jupiter is 962.6 minutes old"*, which against a
  known fifty minutes is the answer in one division. So are the ghost markers,
  the map's delay label, the Jovian caption, the telescope's second lane, the
  whole comparison panel, and — worst, because it looked like a result rather
  than a giveaway — the solve panel's *"you are out by 8.1%"*, which is the
  answer by one more division. All of it waits. What is left is the eyepiece,
  the clock and the log, which is precisely what Rømer had.
- **One error percentage on screen, not two.** The game once quoted its own,
  computed from the ratio of slowdown factors, beside the solve panel's,
  computed from the ratio of speeds: 7.5% against 8.1% for the same run. Both
  defensible, and having both is a bug.
- **The reference speed is the universe's own.** `solve.comparison` takes it as a
  parameter; hardcoded, it announced "the true value is 299 792 km/s" beside a
  percentage computed against something else entirely.
- **The verdict is in words, against the history.** Rømer was 32% out and right
  about everything that mattered, so inside that deserves to be told so; and the
  method's own systematic is a few percent, so nothing under five is skill.

---

## 16. Time and zoom are continuous

**Zoom with the wheel, over the thing being zoomed.** A slider in the left dock
is a fine way to *set* a magnification and a poor way to *find* one: the eye is
on the instrument and the hand is somewhere else, so every adjustment is a round
trip. `wheelZoom` is attached to the plan view, the Jovian inset and the
telescope — and because the wheel is over one of them, nobody has to remember
which slider belongs to which panel.

**Multiplicative everywhere.** A fixed step of 0.5 is a doubling at the bottom of
a zoom range and a rounding error at the top; a fixed *ratio* feels the same
everywhere, which is the whole of what "natural" means here. The zoom sliders are
therefore logarithmic too, so slider and wheel agree about what a nudge means.

**Any rate can be typed.** The log slider finds a pace; the number beside it
pins one. "Run at exactly four seconds of sky per second" is a reasonable thing
to want when setting up an observation and an unreasonable thing to ask of a
drag. The unit is sky-seconds per real second, which spans the whole range as a
number a person can read and, at the slow end, *is* the multiple of real time.

**And − / + halve and double it.** A stepper wants a step you can predict
without looking, and on a logarithmic quantity that is a *ratio*: "twice as
fast" is something a person can hold, where "0.5 d/s more" is not. Twenty-three
presses cross the whole seven decades, which is the right coarseness beside a
slider that already covers the range in one drag.

**The observing clock lives in the telescope panel**, to the second. That is
where eclipses are timed, and the only date on screen used to be three panels
away in the readout — a student pressing the button had to take on trust that
anything was being written down at all. Seconds, because the whole measurement
is a difference of minutes; tabular figures, because at ten times real time a
proportional font makes the line twitch as they run.

---

## 17. Credit line

An imprint, not a banner: `© <year> Richard Lipka · lipka@fav.zcu.cz ·
home.zcu.cz/~lipka`, with the FAV and KIV marks beside it, small, at the foot of
the page.

The two marks are **inlined SVG with every fill set to `currentColor`**, copied
from the orrery's own assets rather than fetched from the web. Two reasons, both
binding. The artwork the university publishes is flat white, meant for the dark
header it sits in there, and would be invisible on parchment; inlined, it takes
the footer's own ink. And §13 requires the app to work offline once loaded, so a
logo hotlinked from `kiv.zcu.cz` is not an option regardless of how it looks.

Full opacity is deliberate. The muted ink already reads as an imprint, and
dimming a mark that carries meaning on top of that drops it under the 3:1 a
graphic needs.
