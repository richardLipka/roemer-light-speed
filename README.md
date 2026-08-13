# Rømer — the first measurement of the speed of light

An interactive reconstruction of **Ole Rømer's 1676 discovery that light travels
at a finite speed**, built for a high-school physics lesson. Czech and English.

Io goes round Jupiter every 1.77 days and disappears into its shadow once every
orbit — a clock in the sky. Rømer found that it ran late when Earth was far from
Jupiter and early when it was near. The clock was fine; the light carrying the
news had further to travel. That was the first time anyone put a number on the
speed of light.

The app lets a student do the measurement rather than read about it: watch the
eclipses through a telescope view, time them by hand, and work the speed out from
their own log — first the way Rømer did it, with two eclipses and one division,
then properly, using every observation they took.

**The comparison is always against the student's own timetable, never against
the model's true eclipse time.** No observer in 1676 had access to the latter —
the light *is* the event, as far as anyone watching is concerned — so the app
fits a timetable from the student's own readings, the way Cassini's tables were
actually built, and measures every eclipse against that. Accuracy drops to about
Rømer's own ballpark (roughly ±10%) as the honest cost, and a run shorter than
about one and a half of Jupiter's cycles is refused outright rather than given a
falsely confident number.

A second tab turns the same instrument into a game: light is slowed by an
unknown factor between five and twenty, and the student measures it — using the
same method — before finding out whether they were right.

## Running it

This repository depends on `@orrery/core` from the
[orrery](https://github.com/richardLipka/ptolemy_copernicus_newton) repository,
consumed as a **built** package over a relative path. Both checkouts must sit
side by side:

```
Vyvoj/AI/
  ClaudePtolemy/        <- the orrery, provides @orrery/core
  RoemerLightSpeed/     <- this repository
```

Core ships compiled output, so it has to be built before anything here can
import it — and after any edit to it, or the change never arrives:

```bash
npm --prefix ../ClaudePtolemy install && npm --prefix ../ClaudePtolemy run build:core
```

Then:

```bash
npm install && npm run dev -- --port 5184
```

`npm test` runs the suite, `npm run build` produces static files in `dist/`.

## What it is honest about

The eclipses in this model happen at the **right rate** but not on the exact
dates they happened in history — the underlying satellite ephemeris is
approximate in phase. The pattern a student measures is real; the calendar dates
on screen are not, and the app says so on screen. See `CLAUDE.md` §6 for why the
measurement survives this intact, and §12 for the test that proves it does.

## Licence

MIT.
