# BUILD SPEC — "BLOCK 12" Training & Cut Tracker

**Deliverable:** a local-first, mobile-first single-page web app that runs a fixed 12-week calisthenics + cut block, logs every set, and detects stagnation before it costs weeks.

**Build budget:** one day (8–10 focused hours), one developer + Claude Code.

**Read this whole file before writing code.** Sections 1–8 are the product and engineering spec. Section 11 is the prompt pack to actually drive the build.

---

## 0. Decision: build the app, not the spreadsheet

A spreadsheet can hold this data. It cannot solve the actual problem.

The stated failure mode is *"progress stagnates or regresses because I have no means of tracking all exercises."* That is only half true. The deeper causes, visible in the program itself, are:

| Root cause | Why a spreadsheet fails | What the app does |
|---|---|---|
| Prescriptions change by week/phase (7 different phase blocks × 30 exercises) | You must look up the right row mid-session, on a phone, with chalky hands | Serves *today's* prescription automatically from the block start date |
| Progression is not "add weight" — it is band tier, ROM, elevation, leverage, variant | A weight column can't represent "one-leg lever, no band" vs "banded straddle" | Difficulty Index: an ordered variant ladder per skill → one comparable number |
| Bodyweight is falling 4–5 kg, so raw numbers understate progress | Manual normalisation never happens | Relative-strength metrics computed automatically |
| The plan has explicit stop rules (15% drop, hips sag, elbows unlock) | Nobody checks a rules tab mid-set | Live stop-rule banner comparing the current set to rolling best |
| The plan says change **one** progression variable at a time | Impossible to enforce | Progression events are logged per axis; two axes in one week triggers a warning |
| Stagnation is only visible in hindsight | Charts require manual upkeep | Stagnation detector fires after 3 flat sessions and names the next lever to pull |

Time cost is comparable (a genuinely good spreadsheet with this logic is also a full day), and the app wins on the one thing that decides adherence: **entry friction during a session**. Two taps per set, on a phone, offline.

**Build the app.** Appendix C contains a 45-minute spreadsheet fallback if the day gets eaten — do not start there.

---

## 1. Product brief

**Name:** BLOCK 12
**User:** one person (the owner). No auth, no accounts, no multi-user.
**Primary device:** phone, in a home gym, possibly offline. Desktop is secondary (used for review, not logging).

**The one job:** open the app → it says exactly what to do today → log it in seconds → it tells you honestly whether you are progressing.

**Three questions the app must answer in under five seconds:**
1. What am I doing right now, and what are the numbers?
2. Is this set better or worse than last time?
3. Am I actually progressing this block, or standing still?

**Non-goals (do not build):** social features, exercise video library, AI coach chat, backend/API, login, food database/barcode scanning (calories are typed in as a number), Apple Health / Strava sync, notifications beyond an optional local reminder.

---

## 2. Tech stack and hard constraints

```
Vite + React 18 + TypeScript (strict)
Tailwind CSS v3
React Router v6 (hash router — makes static hosting trivial)
Recharts (charts)
Zustand + persist middleware (state + localStorage)
date-fns (date math)
```

**Constraints:**
- **No backend. No network calls at runtime.** Everything in `localStorage` under a single versioned key.
- **All data user-owned:** JSON export/import must exist and must round-trip losslessly. This is the backup strategy.
- `tsc --noEmit` must pass with `strict: true`. No `any` in `src/domain/`.
- Every derived metric lives in `src/domain/` as a **pure function** with unit tests. No metric maths inside components.
- Program content lives in `src/data/program.ts` as typed data. **No prescriptions hardcoded in JSX.**
- Mobile-first: everything must work one-handed at 380px wide. Primary tap targets ≥ 44px.
- PWA-installable (manifest + minimal service worker) so it opens from the home screen and works offline.

**Storage key:** `block12:v1`. Include `schemaVersion` in the payload and a `migrate()` stub so a schema change never wipes a block mid-flight.

---

## 3. Repository layout

```
src/
  main.tsx
  App.tsx                    # hash routes + bottom tab bar
  domain/                    # pure, tested, no React
    types.ts                 # all interfaces (Section 4)
    phase.ts                 # date -> week -> phase, prescription resolution
    difficulty.ts            # variant ladders, Difficulty Index, effective level
    scoring.ts               # set score, session load, exercise progress index
    analysis.ts              # stagnation detector, stop-rule check, PR gating
    body.ts                  # rolling weight avg, weekly rate, cut-corridor status
    readiness.ts             # autoregulation + optional-second-run gate
    review.ts                # weekly review assembly
    __tests__/               # vitest
  data/
    program.ts               # THE 12-WEEK PROGRAM (Section 5)
    ladders.ts               # variant ladders per skill
    mobility.ts              # benchmark definitions + weekly progression variable
    targets.ts               # end-of-block targets checklist
  store/
    useStore.ts              # zustand slice: entries, logs, settings, actions
    persist.ts               # versioned localStorage + export/import
  screens/
    Today.tsx
    SessionRunner.tsx
    Progress.tsx
    Body.tsx
    Program.tsx
    Review.tsx
    Settings.tsx
  components/
    SetLogger.tsx  HoldTimer.tsx  RestTimer.tsx  ExerciseCard.tsx
    StopRuleBanner.tsx  ReadinessCheckIn.tsx  PhaseBadge.tsx
    ProgressChart.tsx  WeightChart.tsx  Stat.tsx  Sheet.tsx  NumberPad.tsx
  styles/tokens.css
```

---

## 4. Data model

Write this file first. Everything else is downstream of it.

```ts
// ---------- program (static, seeded) ----------
export type Phase =
  | 'calibration'    // weeks 1–2
  | 'accumulation'   // weeks 3–5
  | 'deload'         // week 6
  | 'intensification'// weeks 7–9
  | 'peak'           // week 10
  | 'taper'          // week 11
  | 'test';          // week 12

export type DayId = 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun';
export type Block = 'am' | 'main';

export type MetricType =
  | 'reps'            // bodyweight or skill reps
  | 'weightedReps'    // reps + added kg
  | 'hold'            // seconds
  | 'attempts'        // handstand: attempts per set, each with a hold time
  | 'timeOnly'        // mobility hold, no scoring
  | 'sprint'          // distance + intensity %
  | 'distanceTime';   // easy run: minutes

export interface Prescription {
  weeks: number[];            // e.g. [1,2]
  sets: number;               // target sets
  repsLow?: number; repsHigh?: number;
  secLow?: number;  secHigh?: number;
  rpeLow?: number;  rpeHigh?: number;
  note?: string;              // e.g. "test reps or increased ROM"
  perSide?: boolean;
}

export interface Exercise {
  id: string;                 // stable slug, e.g. 'fl-hard-iso'
  name: string;
  day: DayId;
  block: Block;
  order: number;
  metric: MetricType;
  ladderId?: string;          // links to a variant ladder in ladders.ts
  tracked: boolean;           // false => AM mobility items: completion checkbox only
  coreFunction?: string;      // 'anti-extension' etc.
  cues: string[];             // shown collapsed on the card
  progressionLadder: string[];// ORDERED axes to advance, e.g. ['cleaner line','greater ROM',...]
  stopRules: string[];        // exercise-specific technique failures
  prescriptions: Prescription[];
}

// ---------- ladders ----------
export interface Variant { id: string; label: string; level: number } // level = difficulty index
export interface Ladder  { id: string; variants: Variant[]; assistanceTiers: string[] }
// assistanceTiers: ['none','light band','medium band','heavy band'] -> index 0..3

// ---------- logging ----------
export interface SetLog {
  id: string;
  reps?: number;
  seconds?: number;           // for holds; for 'attempts' this is the best attempt
  attempts?: number[];        // seconds per attempt
  addedKg?: number;
  rpe?: number;               // 6..10 in 0.5 steps
  variantId?: string;         // snapshot of variant used
  assistanceTier?: number;    // 0..3
  romNote?: string;           // e.g. "feet on 40cm box", "lean 12cm"
  techniqueFlags: TechniqueFlag[];
  score: number;              // computed at write time AND recomputed on read
}

export type TechniqueFlag =
  | 'hipsSagged' | 'elbowsUnlocked' | 'lineChanged'
  | 'usedMomentum' | 'partialROM' | 'collapsed' | 'assistedExtra';

export interface ExerciseLog {
  exerciseId: string;
  sets: SetLog[];
  skipped?: boolean;
  note?: string;
}

export interface SessionLog {
  id: string;                 // `${date}:${block}`
  date: string;               // ISO yyyy-mm-dd
  week: number;
  phase: Phase;
  day: DayId;
  block: Block;
  startedAt: string; completedAt?: string;
  readiness?: Readiness;
  exercises: ExerciseLog[];
  sessionRpe?: number;
  note?: string;
}

export interface Readiness {
  sleepHours: number;         // 0–12, 0.5 steps
  soreness: 0|1|2|3;
  elbowIrritation: 0|1|2|3;
  shoulderIrritation: 0|1|2|3;
  motivation: 0|1|2|3;
}

// ---------- body & nutrition ----------
export interface DailyEntry {
  date: string;               // ISO, primary key
  weightKg?: number;          // morning, fasted
  calories?: number;
  proteinG?: number;
  steps?: number;             // optional
  note?: string;
}

// ---------- mobility benchmarks (weeks 1, 6, 12) ----------
export interface BenchmarkEntry {
  date: string; week: number;
  values: Record<string, number>;   // benchmarkId -> value (cm or degrees)
  photoNote?: string;
}

// ---------- progression events (the one-variable rule) ----------
export interface ProgressionEvent {
  id: string; date: string; exerciseId: string;
  axis: string;               // must be one of exercise.progressionLadder
  from: string; to: string;
  note?: string;
}

export interface Settings {
  blockStartDate: string;     // ISO Monday of week 1
  startWeightKg: number;      // 77
  targetWeightKg: number;     // 72.5
  proteinTargetLow: number;   // 170
  proteinTargetHigh: number;  // 190
  units: 'metric';
  reminderTime?: string;
}
```

---

## 5. Program seed data

Transcribe **exactly** as below into `src/data/program.ts`. Do not invent, round, or "improve" any prescription. Where a phase is not listed for an exercise, it inherits the nearest earlier listed phase and the UI shows the inherited note.

Week→phase map (used everywhere):
`1–2 calibration · 3–5 accumulation · 6 deload · 7–9 intensification · 10 peak · 11 taper · 12 test`

### 5.1 Monday — Primary HSPU & bent-arm push

**AM — overhead mobility and handstand line (RPE 5–6, `tracked: false` except toe pulls)**

| Exercise | Prescription | Cue |
|---|---|---|
| Wrist-extension lean | 3 × 20–30 s | progress shoulder travel beyond the wrist |
| Wall shoulder-flexion lift-off | 3 × 6–10 | 2 s hold, ribs down |
| Ring lat stretch, active pull-out | 2 × 30–40 s | alternate 5 s relaxed / 5 s active |
| Thoracic-extension prayer stretch | 2 × 8 slow |  |
| Chest-to-wall handstand line | 3 × 20–35 s | elbows locked, shoulders elevated, ribs controlled |
| Toe pulls *(tracked)* | 3 sets × 2–3 attempts | stop each attempt while the shape is still good |

**Main**

| # | Exercise | id | metric | Prescriptions |
|---|---|---|---|---|
| 1 | Handstand balance attempts (1 set = 2 attempts) | `hs-balance-primary` | attempts | W1–2 4×2 att @3–6 s RPE6–7 · W3–5 5×2 @4–8 s RPE7 · W6 3×2 easy · W7–9 5×2 @5–10 s RPE7–8 · W10 4×2 high-quality · W11 3×2 · W12 3–5 rested test attempts |
| 2 | Elevated or deficit pike HSPU | `pike-hspu` | weightedReps | W1–2 4×4–6 RPE7 · W3–5 5×4–7 RPE7.5–8 · W6 3×4 RPE6 · W7–9 6×3–5 RPE8 · W10 5×2–4 RPE8–8.5 · W11 3×3 RPE7 · W12 test reps or increased ROM |
| 3 | Band-assisted bent-arm press to handstand | `press-to-hs` | reps | W1–5 3×2–4 RPE6–7 · W6 2×2 easy · W7–10 4×1–3 RPE7–8 · W11 2×2 · W12 test unassisted press & lockout |
| 4 | Weighted ring dip | `ring-dip` | weightedReps | W1–2 3×6–8 RPE7 · W3–5 4×6–10 RPE8 · W6 2×6 · W7–9 5×3–6 RPE8 · W10 4×3–5 RPE8.5 · W11 2×5 · W12 2 light maintenance sets |
| 5 | Seated pike compression lift | `pike-compression` | reps | W1–5 4×8–15 · W6 2×8 · W7–10 5×5–10 harder leverage · W11 3×6 · W12 mobility quality only |

- `pike-hspu.progressionLadder`: `['cleaner line','greater ROM','higher feet','more forward shoulder','added plate load']`
- `press-to-hs.cues`: pause 2 s in lockout before lowering.
- `pike-compression.progressionLadder`: `['hands closer to feet','straighter knees','light ankle load']` · coreFunction: active compression.
- `pike-hspu.stopRules`: `['line changed substantially','elbows flared out of position','needed momentum']`

### 5.2 Tuesday — Primary front lever

> Main hold must be a variation holdable **cleanly for only 5–8 s**: open advanced tuck · one-leg · assisted straddle · band-assisted full. Advanced tuck is back-off work only, never the main strength attempt.

**AM — straight-arm pulling mobility:** passive ring hang 2×30–40 s · passive-to-active hang 3×6–8 · feet-assisted skin-the-cat eccentric 2×3–5 · band straight-arm pulldown 3×10 easy · hollow-to-arch transition 2×8–10 · easy assisted front-lever position 2×8 s RPE4–5.

**Main**

| # | Exercise | id | metric | Prescriptions |
|---|---|---|---|---|
| 1 | Hard front-lever isometric | `fl-hard-iso` | hold | W1–2 4×5–8 s RPE7 · W3–5 5×5–8 s RPE7.5–8 · W6 3×5 s easy progression · W7–9 6×4–6 s RPE8 · W10 5×4–6 s RPE8–8.5 · W11 3×4–5 s · W12 2–3 rested test attempts |
| 2 | Band-assisted full-shape front-lever row/pull | `fl-row` | reps | W1–2 3×5–8 RPE7 · W3–5 4×5–8 RPE7.5–8 · W6 2×5 · W7–9 5×3–6 RPE8 · W10 4×3–5 · W11 3×3 · W12 2 easy sets after testing |
| 3 | Advanced-tuck front-lever raise | `fl-raise` | reps | W1–2 3×5–8 RPE7 · W3–5 4×5–8 RPE8 · W6 2×5 · W7–9 4×3–5 harder leverage · W10 4×3–4 RPE8.5 · W11 2×3 · W12 2 easy sets |
| 4 | Ring face pull to external rotation | `face-pull` | reps | All weeks 3×10–15 RPE7–9 |
| 5 | Ring rollout | `ring-rollout` | reps | W1–5 4×6–12 · W6 2×6 · W7–10 4×5–10 longer lever · W11 2×6 · W12 light only |

- `fl-hard-iso.stopRules`: `['hips sagged','elbows unlocked','hold time fell >15% vs best']`
- `fl-raise.cues`: straight elbows throughout.
- `face-pull.progressionLadder`: `['more horizontal body angle','more reps']` — angle first, always.
- `ring-rollout` coreFunction: anti-extension.

### 5.3 Wednesday — Sprints & pistol-squat legs

**AM — lower-body mobility:** knee-to-wall dorsiflexion 2×8 + 20 s hold · 90/90 hip switches 2×6 each way · couch stretch with glute contraction 2×30 s/side · Cossack squat 3×5/side · single-leg RDL reach 2×6/side · assisted deep pistol position 2×20 s/side.

**Main**

**1. Sprints (`sprints`, metric `sprint`, full dynamic warm-up first, rest 3–5 min):**

| Wk | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| | 6×15 m @85–90% | 6×20 m @88–90% | 6×20 m @90–92% | 6×25 m @90–93% | 6×30 m @92–95% | 4×15 m @85% | 6×25 m @92–95% | 6×30 m @~95% | 4×30 m + 2 flying 10 m | 4×30 m + 3 flying 10 m | 4×20 m @90% | optional timed 20 m & 30 m |

| # | Exercise | id | metric | Prescriptions |
|---|---|---|---|---|
| 2 | Pistol squat progression | `pistol` | weightedReps, perSide | W1–2 4×4–6/leg RPE7 · W3–5 5×5–8 RPE8 · W6 3×4 · W7–9 6×3–5 harder progression · W10 5×3–4 RPE8.5 · W11 3×3 · W12 test clean reps or added load |
| 3 | Plate-loaded single-leg RDL | `sl-rdl` | weightedReps, perSide | W1–5 4×6–10/leg · W6 2×6 · W7–10 4×5–8 heavier · W11 2×6 · W12 light |
| 4 | Ring hamstring curl | `ring-ham-curl` | reps | W1–5 4×8–15 · W6 2×8 · W7–10 4×6–10 progressing toward single-leg · W11 2×8 |
| 5 | Weighted single-leg calf raise | `sl-calf` | weightedReps, perSide | All weeks 4×8–15/side — 2 s stretch pause, 1 s top |

- `pistol.cues`: 3-second eccentric until both legs are symmetrical.
- `pistol.ladderId`: `pistol` (see 5.8).

### 5.4 Thursday — Deep mobility and recovery (AM only, no main session)

Jefferson curl 3×6 (5 s eccentric) · plate-loaded pancake good morning 3×8 · 90/90 active lift-off 3×6/side · bridge shoulder-opening hold 3×20–30 s · ring-assisted pistol squat 3×3/side RPE5 *(technical practice only, `tracked: false`)* · deep squat ankle shifts 2×45 s.

Screen note: Thursday's Today screen shows a **"No hard training today"** state — mobility checklist + a nudge to log weight and calories. Do not offer a main-session start button.

### 5.5 Friday — Bent-arm pull & secondary front lever

**AM — elbow and pulling preparation:** passive-to-active ring hang 2×6 · assisted ring-curl eccentric 2×5 (4 s lowering) · plate wrist extension 2×12–15 · plate pronation/supination 2×10 each · scapular circles 2×5 each way · gentle ring biceps stretch 2×20 s.

**Main**

| # | Exercise | id | metric | Prescriptions |
|---|---|---|---|---|
| 1 | Secondary front-lever hold (easier banded full or open adv tuck) | `fl-secondary` | hold | W1–5 3–4×6–10 s RPE6–7 · W6 2×6 s · W7–10 4×5–8 s RPE7 · W11 2–3×5 s · W12 2 easy holds |
| 2 | Weighted ring pull-up | `ring-pullup` | weightedReps | W1–2 4×5–7 RPE7 · W3–5 5×4–7 RPE8 · W6 2×5 · W7–9 6×3–5 RPE8 · W10 5×2–4 RPE8.5 · W11 3×3 · W12 optional bodyweight-adjusted test |
| 3 | Feet-elevated ring row | `ring-row` | reps | W1–5 4×8–15 · W6 2×8 · W7–10 4×6–10 · W11 2×8 |
| 4 | Ring hammer curl | `ring-curl` | reps | W1–5 3–4×8–15 · W7–10 3×6–10 |
| 5 | Weighted hanging knee raise with posterior pelvic tilt | `hanging-ppt` | weightedReps | W1–5 4×8–15 · W6 2×8 · W7–10 4×6–12 with plate · W11 2×8 |

- `fl-secondary.note`: **must never reduce weighted pull-up performance** — the app surfaces this as a rule on the card, and flags it in Review if pull-up score drops in a week where `fl-secondary` volume rose.
- `ring-curl`: only the final set may approach failure, and only if the elbows are completely comfortable.
- `hanging-ppt.cues`: do not simply flex the hips — curl the pelvis upward.

### 5.6 Saturday — Secondary HSPU & straight-arm push

**AM — handstand control:** wrist lean 2×20 s · fingertip pressure pulses 2×12 · wall shoulder-flexion lift-off 2×8 · chest-to-wall handstand line 2×25 s · handstand shrug 2×6–8 · toe-pull or heel-pull attempts 3×2 *(tracked)*.

**Main**

| # | Exercise | id | metric | Prescriptions |
|---|---|---|---|---|
| 1 | Secondary handstand balance attempts | `hs-balance-secondary` | attempts | W1–5 3×2 RPE6 · W6 2×2 easy · W7–10 4×2 RPE6–7 · W11 2×2 · W12 technique only after testing |
| 2 | Band-assisted or partial-ROM wall HSPU | `wall-hspu` | reps | W1–5 3×4–6 RPE6–7 · W6 2×4 · W7–10 4×3–5 RPE7 · W11 2×3 · W12 2 easy sets — **practice exposure, not a second hard HSPU day**; keep ≥3 clean reps in reserve |
| 3 | Planche lean on parallettes | `planche-lean` | hold | W1–5 4×8–15 s RPE7 · W6 2×8 s · W7–10 5×6–10 s RPE8 · W11 3×6 s |
| 4 | Deep ring push-up or ring fly | `ring-pushup` | reps | W1–5 4×8–15 · W6 2×8 · W7–10 3–4×6–12 · W11 2×8 |
| 5 | Ring-supported Copenhagen side-plank rotation | `copenhagen` | reps, perSide | All weeks 3×8–12/side |

- `planche-lean.progressionLadder`: `['lean distance','hold duration']` — distance first. Log lean distance in cm as `romNote`.
- `copenhagen.progressionLadder`: `['bent-knee support','straight-leg support','slower rotation','plate loading']` · coreFunction: lateral trunk, anti-rotation, controlled rotation, adductors.

### 5.7 Sunday — Endurance & restoration

**AM mobility benchmarks:** pike position 2×30–45 s · pancake position 2×30–45 s · knee-to-wall 2×8/side · wall shoulder-flexion lift-off 2×8 · 90/90 hip rotation 2×6/side.
**Formal measurement weeks: 1, 6, 12** — in those weeks the Sunday screen opens the Benchmark form instead of the checklist.

**Easy endurance run (`easy-run`, RPE 2–3, full sentences):**

| Wk | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| min | 35 | 40 | 40 | 45 | 50 | 30–35 | 45 | 45–50 | 50 | 50–55 | 35–40 | 25–35 |

**Optional second easy run** (`optional-run`, 20–30 min, Monday, after the strength session or ≥6 h later, from week 3 only). See the gate in §6.9.

### 5.8 Variant ladders (`src/data/ladders.ts`)

Levels are the Difficulty Index. Assistance tiers: `['none','light band','medium band','heavy band']` → index 0–3.

```ts
frontLever:  0 tuck · 1 advanced tuck · 2 open advanced tuck · 3 one-leg
             · 4 straddle · 5 half-lay · 6 full
hspu:        0 floor pike · 1 elevated pike (low) · 2 elevated pike (high)
             · 3 deficit pike · 4 wall HSPU partial ROM · 5 wall HSPU full ROM
             · 6 wall HSPU deficit · 7 freestanding HSPU
pistol:      0 box pistol (high) · 1 box pistol (low) · 2 ring-assisted
             · 3 counterweighted · 4 bodyweight · 5 weighted
handstandEntry: 0 wall toe pull · 1 wall heel pull · 2 wall-supported kick-up
             · 3 freestanding kick-up
press:       0 band-assisted bent-arm · 1 unassisted bent-arm
             · 2 band-assisted straight-arm · 3 unassisted straight-arm
```

### 5.9 Mobility benchmarks (`src/data/mobility.ts`)

| id | Label | Unit | Direction |
|---|---|---|---|
| `kneeToWall` | Knee-to-wall dorsiflexion | cm | higher better (target +2 to +4) |
| `pikeReach` | Standardised pike reach | cm | higher better (target +5 to +10) |
| `pancakeTorso` | Pancake torso height off floor | cm | lower better |
| `shoulderLiftOff` | Wall shoulder-flexion lift-off | cm | higher better |
| `hip9090` | Active 90/90 internal rotation | degrees | higher better |
| `wristLean` | Wrist lean distance, no discomfort | cm | higher better |

**Weekly mobility progression variable** — the app displays exactly one per week and blocks logging a second axis:

`1` establish baseline · `2` add 1–2 reps or 5 s · `3` increase ROM slightly · `4` add 2–3 s active end-range pauses · `5` add small load or harder leverage · `6` half volume, re-test · `7` resume from improved baseline · `8` add active repetitions · `9` increase ROM · `10` increase leverage or load · `11` reduce volume 30–40% · `12` final testing.

**Do-not-progress conditions** (shown as a checklist under the variable): spine compensates excessively · joint feels pinched · active control disappears · soreness affects the main strength session.

### 5.10 End-of-block targets (`src/data/targets.ts`, rendered as a week-12 checklist)

- **Body:** 72–73 kg · most muscle retained · clearly reduced waist · dip and pull-up performance broadly maintained.
- **Front lever:** open advanced tuck 10–15 clean s **or** one-leg 5–8 s/side **or** noticeably less band assistance on full shape; harder rows with correct hip height; slower, cleaner raises.
- **Handstand/HSPU:** consistent 8–15 s freestanding balances; 2 s stable lockout after the press; 8–10 elevated pike HSPU at current setup **or** 4–6 at meaningfully greater ROM; first controlled full or near-full wall HSPU.
- **Pistol:** 5–8 clean bodyweight reps/side **or** 3–5 weighted; improved symmetry; better bottom-position dorsiflexion.
- **Mobility:** per §5.9 targets.
- **Cardio:** comfortable 50–55 min conversational run; faster, cleaner 20–30 m acceleration; no decline in pistol or sprint performance.

---

## 6. Engine specifications

All of this is pure TypeScript in `src/domain/`. Each subsection is one file, each gets tests.

### 6.1 Week and phase resolution (`phase.ts`)

```
currentWeek(today, blockStartDate) = floor(daysBetween / 7) + 1, clamped to 1..12
phaseForWeek(w): 1–2 calibration | 3–5 accumulation | 6 deload
                 | 7–9 intensification | 10 peak | 11 taper | 12 test
resolvePrescription(exercise, week): exact match on prescription.weeks,
                                     else nearest earlier, else null
```
If today is past week 12, show a **Block complete** state with a link to Review. Never crash on out-of-range weeks.

### 6.2 Difficulty Index (`difficulty.ts`)

```
effectiveLevel(variantLevel, assistanceTier, romBonus) =
    variantLevel − 0.6 × assistanceTier + romBonus
```
- `romBonus` is 0 by default; `+0.5` when the user marks the set as **extended ROM**, `−0.5` for **partial ROM**.
- Put the constants (`0.6`, `0.5`) in one exported `TUNING` object so they can be adjusted without hunting through files.
- Clamp effective level to ≥ 0.

### 6.3 Set score and session load (`scoring.ts`)

```
intensityFactor(effLevel) = 1 + 0.2 × effLevel

hold:          score = seconds × intensityFactor
reps:          score = reps × intensityFactor
attempts:      score = sum(attemptSeconds) × intensityFactor
weightedReps:  score = reps × (bodyweightKg + addedKg) / bodyweightKg × intensityFactor
sprint:        score = totalMetres × (avgIntensityPct / 100)²
timeOnly:      score = 0 (completion only)
```
- `bodyweightKg` = most recent 7-day rolling average weight, falling back to `settings.startWeightKg`. **This is what makes the cut count**: same reps at lower bodyweight produces a lower raw volume-load but the app also reports relative strength separately (§6.4), and the Progress screen shows both.
- `sessionLoad` = Σ set scores. `exerciseSessionBest` = max set score in that session, **excluding any set with a technique flag or RPE 10**.

### 6.4 Relative strength (`scoring.ts`)

For every `weightedReps` exercise:
```
relativeLoad = (bodyweightKg + addedKg) / bodyweightKg
est1RMrelative = relativeLoad × (1 + reps / 30)          // Epley, bodyweight-normalised
```
Chart `est1RMrelative` over the block for `ring-pullup`, `ring-dip`, `pike-hspu`, `pistol`. **This is the primary "am I keeping strength while cutting" chart.** Expect it to rise even when added kg is flat.

### 6.5 Exercise Progress Index (`scoring.ts`)

```
baseline = best qualifying set score across weeks 1–2
current  = best qualifying set score across the last 3 sessions of that exercise
progressIndex = current / baseline × 100     // week 1–2 = 100
```
Show as a single number per exercise on Progress, plus a sparkline. Deload and taper weeks are marked on the chart so the dips read as planned, not as failure.

### 6.6 Stop-rule check (`analysis.ts`) — **live, during the session**

After each logged set, compare to `rollingBest` (best qualifying set of that exercise in the last 3 sessions):

| Condition | Banner |
|---|---|
| reps or seconds ≥15% below rolling best | **amber** — "Quality drop. Plan says end this exercise." + End exercise button |
| any technique flag ticked | **amber** — name the flag, quote the rule |
| two consecutive `collapsed` flags on a handstand exercise | **red** — "Two collapses. Stop balance work today." |
| RPE 10 logged outside week 10/12 | **amber** — "Failure adds fatigue you can't afford at this frequency." |
| phase is deload/taper and RPE > phase cap | **amber** — "Week 6 caps at RPE 6." |

Phase RPE caps: calibration 7.5 · accumulation 9 (accessories only) · deload 6 · intensification 8.5 · peak 8.5 · taper 7.5 · test — uncapped for the four test lifts, capped 7 for everything else.

### 6.7 Stagnation detector (`analysis.ts`) — **the headline feature**

For each tracked main exercise, after each session:

```
flat = progressIndex has not improved ≥3% across the last 3 sessions of this exercise
healthy = last 3 readiness check-ins had soreness ≤2, relevant joint irritation ≤1,
          and ≥5 of the last 7 days have a logged weight
notDeload = phase is not 'deload' and not 'taper'
```
If `flat && healthy && notDeload` → surface a **Stagnation card** on Today and Progress:

> `pike-hspu` has been flat for 3 sessions. Next lever on your ladder: **greater ROM** (you last changed *cleaner line* in week 3). Change one variable only.

The suggestion is the next unused axis in `exercise.progressionLadder`, in order, based on logged `ProgressionEvent`s. Tapping **Apply** opens the progression-event form pre-filled.

If `flat && !healthy` → different card: **"Flat, but recovery is the likely cause"** listing which readiness inputs are out of range. Do not suggest adding difficulty.

### 6.8 One-variable rule (`analysis.ts`)

When saving a `ProgressionEvent`, if another event exists for the same `exerciseId` within the current week → block with:

> You already changed *higher feet* on this exercise this week. Changing two variables at once makes the result uninterpretable. Log it anyway?

Allow override (with a recorded `note`), but the Review screen counts overrides.

### 6.9 Body, cut corridor, and the optional-run gate (`body.ts`, `readiness.ts`)

```
rolling7 = mean of the last 7 available weightKg (needs ≥4 points)
weeklyRateKg = rolling7(today) − rolling7(today − 7d)
weeklyRatePct = weeklyRateKg / rolling7(today) × 100
```
Corridor status against the plan's targets (0.33–0.42 kg/wk ≈ 0.4–0.55 %/wk):

| Status | Rule | Copy |
|---|---|---|
| On track | −0.30 to −0.50 kg/wk | "On track — 0.38 kg/wk" |
| Too slow | > −0.30 | "Slower than planned. 12-week finish projects at 74.1 kg." |
| Too fast | < −0.60 | "Faster than planned. Risk to lean mass and skill output." |

Also show: projected week-12 weight from current rate; total change from start; protein 7-day mean vs 170–190 g; calorie 7-day mean.

**Optional second run gate** — all four must be true (from week 3 onward):
1. Wednesday sprint session logged and its score is within 5% of the best of the last 3 sprint sessions;
2. calf/Achilles soreness ≤ 1 in the last two readiness check-ins;
3. `|weeklyRatePct| ≤ 0.6`;
4. mean sleep of last 3 nights ≥ 7 h **and** motivation ≥ 2.

Render as a green/red pill on Monday's Today screen with each condition ticked or crossed. Never auto-add the run — it stays a suggestion.

### 6.10 Autoregulation (`readiness.ts`)

From the pre-session check-in:
- sleep < 6 h **or** soreness = 3 → subtract 0.5 from every target RPE, show "Adjusted for recovery" on the session header.
- `elbowIrritation ≥ 2` in two consecutive sessions → banner on Tuesday/Friday: **"Reduce lever and curl volume this session."** Suggest dropping one set from `fl-hard-iso`, `fl-row`, `ring-curl`.
- `shoulderIrritation ≥ 2` → same for `ring-dip`, `planche-lean`, `ring-pushup`.
- Never auto-modify the logged prescription; show the adjustment as a suggestion the user accepts with one tap (which writes `sessionRpe` adjustment into the log for honest history).

### 6.11 Tendon guardrails (`analysis.ts`)

Encode the plan's rules as passive checks surfaced in Review:
- **Exercise churn:** if a tracked main exercise changed variant more than twice in 3 weeks → "You're changing exercises too often for tendon adaptation."
- **Leverage jump:** a `ProgressionEvent` moving effective level by > 1.0 in one step → "Sudden leverage jump. Step back half a level."
- **Collapse training:** ≥2 `collapsed` flags on lever holds in one week → "Lever holds are being trained to collapse."

---

## 7. Screens

Bottom tab bar: **Today · Progress · Body · Program · More**. Session Runner is full-screen (no tab bar).

### 7.1 Today (default route)

```
┌──────────────────────────────────────┐
│ WEEK 07  INTENSIFICATION   Fri 30 Jul│  ← phase badge, colour-coded
│ Bent-arm pull + secondary lever      │
├──────────────────────────────────────┤
│ ⚠ pike-hspu flat 3 sessions          │  ← stagnation card (only when firing)
│   Next lever: greater ROM   [Apply]  │
├──────────────────────────────────────┤
│ AM · Elbow and pulling prep     6/6 ✓│  ← tappable checklist, collapses when done
├──────────────────────────────────────┤
│ MAIN · 5 exercises  ~52 min          │
│  1 Secondary FL hold   4×5–8s RPE7   │
│  2 Weighted ring pull  6×3–5 RPE8    │
│  3 Feet-elev ring row  4×6–10        │
│  4 Ring hammer curl    3×6–10        │
│  5 Hanging PPT raise   4×6–12        │
│           [ Start session ]          │
├──────────────────────────────────────┤
│ Weight  [ 74.8 kg ]  Calories [2350] │  ← inline daily entry, always visible
│ Protein [  182 g  ]                  │
│ 7-day avg 75.1 · −0.38 kg/wk ✓       │
└──────────────────────────────────────┘
```
- Tapping **Start session** first shows the **Readiness check-in** (5 sliders, ~8 seconds), then enters the Runner.
- Thursday: no main card. Sunday: run duration card + benchmark form in weeks 1/6/12.
- Monday from week 3: optional-run gate pill.

### 7.2 Session Runner

One exercise at a time, swipe or arrow between them. Per exercise:

```
┌──────────────────────────────────────┐
│ ← 2/5  Weighted ring pull-up         │
│ TARGET 6 × 3–5 @ RPE 8               │
│ Last time (Wk6): 5,5,4,4,3 @ +12 kg  │  ← the number that drives progress
│ Best set: 5 @ +12 kg  ·  index 118   │
├──────────────────────────────────────┤
│ Variant: — · Assistance: none        │
│ Added kg [ 12 ]                      │
│                                      │
│  SET 1   reps [ 5 ]   RPE [ 8 ]  ✓   │
│  SET 2   reps [ 4 ]   RPE [ 8 ]  ✓   │
│  SET 3   reps [ _ ]   RPE [ _ ]      │
│                                      │
│  flags: ⚑hips ⚑elbows ⚑line ⚑momentum│
│                                      │
│  [ Log set ]        rest 2:30 ▶      │
└──────────────────────────────────────┘
```
Requirements:
- Numbers entered via a **custom number pad sheet**, not the OS keyboard. Reps and RPE are steppers with ± buttons; RPE steps by 0.5 from 6 to 10 with the reserve description shown ("RPE 8 ≈ 2 reps or 2–3 hold seconds left").
- Hold exercises replace reps with a **HoldTimer**: big start/stop, counts up, auto-fills seconds on stop. Handstand `attempts` metric logs 2–3 timed attempts per set.
- **Rest timer** auto-starts on Log set, uses the prescribed rest (3–5 min for sprints, 2–3 min for main strength, 90 s for accessories). Audible + vibration at zero. Runs in a persistent bar even while scrolling.
- The **StopRuleBanner** appears immediately below the target row when triggered (§6.6).
- Sprint exercise gets its own layout: distance, intensity %, and an optional stopwatch per rep.
- Session end: session RPE, free-text note, and a summary of load vs last week's same session.
- **Autosave every set.** Killing the app mid-session must lose nothing. Re-opening resumes the in-progress session.

### 7.3 Progress

- **Skill headlines** at the top: four big cards — Front lever, HSPU/handstand, Pistol, Pull-up — each with current variant, best clean hold/reps, and Progress Index with a delta vs 4 weeks ago.
- **Per-exercise chart** (picker): toggle between *Best set score*, *Total volume*, *Relative est. 1RM*, *Difficulty level*. Phase bands shaded behind the line; deload/taper labelled.
- **Difficulty timeline:** a stepped line of effective level per skill over 12 weeks, with `ProgressionEvent` markers you can tap to read what changed.
- **Consistency heatmap:** 12 weeks × 7 days, coloured by sessions completed; streak counter.
- **Flag frequency:** small bar chart of technique flags per exercise — reveals which skill is degrading under fatigue.

### 7.4 Body

- Weight chart: daily dots + 7-day rolling line + shaded target corridor from 77 kg to 72.5 kg (a straight line between start and target, ±1 kg band). Projected finish line dashed.
- Calories and protein: 7-day bars, target band for protein.
- Weekly table: week, mean weight, change, rate %, mean kcal, mean protein, sessions completed.
- One-tap entry for today at the top; back-fill any date.

### 7.5 Program

Read-only browser of the whole block: week selector → day → exercises with all prescriptions and cues. Includes the RPE table, stop rules, phase descriptions, and the progressive-overload definition ("losing assistance · increasing ROM · improving line · harder lever · same reps at lower bodyweight · more work at the same RPE · less band · less technique variability"). This is the reference you currently keep in a document — it must live in the app.

### 7.6 Review (weekly, unlocks Sunday)

Auto-generated, one screen, no input required:
- Sessions completed vs planned (5 main + 7 AM).
- Weight: mean, rate, corridor status, projection.
- Nutrition: protein adherence days, mean kcal.
- Per-skill Progress Index deltas for the week.
- Fired flags: stagnation, tendon guardrails, stop rules, one-variable overrides.
- **Next week's focus:** the phase note for week N+1, the mobility progression variable for week N+1, and any suggested progression from the stagnation detector.
- Week 6 and 12: prompts the benchmark form and, in week 12, renders the **end-of-block target checklist** with each item auto-marked from logged data where possible.

### 7.7 Settings / More

Block start date · start & target weight · protein targets · export JSON · import JSON · download CSV of all sets · reset block · about. **Export must be reachable in two taps.**

---

## 8. Design system

The brief is a gym instrument, not a lifestyle app: it is read at arm's length, upside down after a handstand, in bad light. Legibility and hierarchy over decoration. Spend the boldness on **one** thing: the phase identity.

**Direction — "instrument panel".** Dark by default (a home gym at 6am, phone brightness low), high-contrast numerals, each phase carries its own accent so you always know where you are in the block without reading.

**Tokens** (`src/styles/tokens.css`, mirrored into `tailwind.config.js`):

```css
--bg:        #0E1116;   /* near-black, slightly blue */
--surface:   #171B22;
--surface-2: #1F252E;
--line:      #2A323D;
--text:      #E8EDF2;
--muted:     #8A96A6;

/* phase accents — the signature */
--calibration:     #6E8BA8;  /* cool slate  */
--accumulation:    #4FA88B;  /* green       */
--deload:          #7E7BB5;  /* violet      */
--intensification: #C9A227;  /* amber       */
--peak:            #D4553B;  /* red-orange  */
--taper:           #4F8FC0;  /* blue        */
--test:            #E8EDF2;  /* white       */

--warn: #E0A030;  --bad: #D4553B;  --good: #4FA88B;
```

**Type:** display/numerals in a condensed grotesque with tabular figures (e.g. **Archivo** or **Oswald** via Fontsource, `font-variant-numeric: tabular-nums` everywhere numbers change). Body/UI in **Inter**. Set numbers at 32–44px — they are the content. Labels are small, uppercase, letterspaced, muted.

**Signature element:** a persistent 12-segment **block bar** across the top of every screen — one segment per week, filled by completion, tinted by phase accent, current week marked. It is the app's identity and its orientation device: you always see where you are in twelve weeks.

**Rules:** no card shadows (flat surfaces + 1px lines) · radius 10px, consistently · one accent per screen, from the current phase · motion only for state change (set logged, timer zero), respecting `prefers-reduced-motion` · visible focus rings · everything usable one-handed.

**Copy rules:** active voice, sentence case, name the action ("Log set" → toast "Set logged"). Empty states instruct rather than apologise: "No sets yet. Log your first set to see a comparison." Warnings quote the plan's own rule rather than inventing coaching.

---

## 9. One-day build schedule

Nine hours, seven commits. Each block ends with a working app — never leave the tree broken.

| # | Time | Goal | Done when |
|---|---|---|---|
| 0 | 0:00–0:40 | Scaffold: Vite+TS+Tailwind+router+tabs+tokens; `domain/types.ts` complete | Empty tabbed shell renders on phone via LAN; `tsc` clean |
| 1 | 0:40–2:10 | **`data/program.ts` fully seeded** + `phase.ts` + Program screen | Every week/day shows correct prescriptions; a test asserts all 12 weeks × 7 days resolve without `null` |
| 2 | 2:10–4:10 | Store + persistence + Session Runner + SetLogger + timers + Today | A full Friday session can be logged and survives a refresh |
| 3 | 4:10–5:00 | Body & nutrition: daily entry, rolling averages, corridor, weight chart | Entering 10 days of weights produces a correct 7-day line and rate |
| 4 | 5:00–6:40 | `difficulty.ts` + `scoring.ts` + `analysis.ts` with tests; Progress screen | Seeded fake data produces sane Progress Indexes; stagnation fires on flat data |
| 5 | 6:40–7:30 | Mobility benchmarks, progression events + one-variable rule, Review screen | Week-6 flow works end to end |
| 6 | 7:30–8:15 | Export/import, CSV, PWA manifest + service worker, deploy | Installed on the phone home screen; works in airplane mode |
| 7 | 8:15–9:00 | Acceptance pass (§10), polish, fix | Every acceptance item ticked |

**If time runs short, cut in this order:** flag-frequency chart → difficulty timeline → CSV export → Review auto-copy → heatmap. **Never cut:** Session Runner, persistence, export, stop rules, weight corridor.

---

## 10. Acceptance tests

Run these by hand at 8:15. The build is not done until every line passes.

**Program & phase**
1. Setting block start to a past Monday shows the correct current week and phase.
2. Every one of the 84 week/day combinations renders without an empty state or crash.
3. Week 6 shows deload prescriptions and caps RPE at 6.
4. Week 12 Sunday shows the target checklist and the benchmark form.

**Logging**
5. A weighted set logs reps + kg + RPE in ≤4 taps from the exercise card.
6. A hold set can be timed with the built-in timer and auto-fills the seconds.
7. A handstand set logs 2 attempts with independent times.
8. Refreshing mid-session restores every logged set and the current exercise.
9. Rest timer survives navigation within the app and fires at zero.
10. Sprint exercise logs distance + intensity for each rep.

**Rules & analysis**
11. Logging a set 20% below rolling best raises the amber stop banner.
12. Ticking "hips sagged" excludes that set from PR/baseline calculation.
13. Three flat sessions on `pike-hspu` with healthy readiness fires the stagnation card naming *greater ROM*.
14. The same flat data with soreness 3 fires the recovery card instead.
15. A second progression event on one exercise in one week triggers the one-variable warning.
16. Elbow irritation 2 logged twice in a row surfaces the lever-volume reduction banner on Tuesday.

**Body**
17. Ten days of weights produce a correct 7-day rolling average and weekly rate to 2 dp.
18. A −0.8 kg/wk rate shows the "too fast" status.
19. The optional-run gate shows all four conditions individually and turns green only when all pass.

**Data safety**
20. Export produces a JSON file; wiping localStorage and importing it restores every session, entry, and setting byte-identically.
21. Bumping `schemaVersion` runs `migrate()` rather than discarding data.

**Platform**
22. Whole app is usable one-handed at 380px with no horizontal scroll.
23. Installs to the iOS/Android home screen and loads with no network.
24. `tsc --noEmit` and `vitest run` both pass clean.
25. Lighthouse performance ≥ 90 on mobile.

---

## 11. Claude Code prompt pack

### 11.1 `CLAUDE.md` — put this in the repo root before anything else

```md
# BLOCK 12 — project rules

Single-user, offline-first PWA that runs a fixed 12-week calisthenics + cut block.
The full specification is in ./SPEC.md. It is authoritative. If code and spec
disagree, the spec wins; if the spec is ambiguous, ask before inventing.

## Rules
- No backend, no auth, no network calls at runtime. localStorage only, key `block12:v1`.
- TypeScript strict. No `any` in src/domain/.
- All metric maths lives in src/domain/ as pure functions with vitest tests.
  Components read results, never compute them.
- All program content lives in src/data/program.ts. Never hardcode a prescription in JSX.
- Mobile-first, 380px, one-handed, tap targets >= 44px. Dark theme from src/styles/tokens.css.
- Never invent training prescriptions, exercise names, or RPE targets. Copy SPEC.md exactly.
- Run `npx tsc --noEmit` and `npx vitest run` before saying a step is done.
- Commit after each numbered step with a conventional-commit message.

## Commands
npm run dev · npm run build · npm run test · npm run typecheck
```

### 11.2 Prompt sequence

Paste `SPEC.md` (this file) into the repo first. Then run these in order, one per step, checking the acceptance line before moving on.

**Prompt 1 — scaffold**
> Read SPEC.md sections 2, 3, 4 and 8. Scaffold the Vite + React + TS + Tailwind project exactly as the repo layout specifies, including hash routing, the five-tab bottom bar, the design tokens from section 8, Fontsource fonts, and the complete `src/domain/types.ts` transcribed from section 4. Add vitest. No screens yet beyond empty placeholders. Then run typecheck and show me the tree.

**Prompt 2 — program data (highest risk step)**
> Read SPEC.md section 5 in full. Create `src/data/program.ts`, `src/data/ladders.ts`, `src/data/mobility.ts`, and `src/data/targets.ts`, transcribing **every** exercise, prescription, cue, progression ladder, and stop rule exactly as written. Do not paraphrase names, do not round numbers, do not fill gaps with your own programming knowledge. Then write `src/domain/phase.ts` per section 6.1 and a vitest suite that asserts: all 12 weeks resolve to the right phase; every tracked exercise resolves a non-null prescription for all 12 weeks; the totals match (5 main sessions, 7 AM sessions, 30 tracked exercises). Print any exercise that fails to resolve.

**Prompt 3 — store and Session Runner**
> Read SPEC.md sections 4, 7.1 and 7.2. Build the zustand store with versioned localStorage persistence and a `migrate()` stub, then the Today screen and the full Session Runner: exercise pager, SetLogger with custom number pad and RPE stepper, HoldTimer, attempt logging, sprint layout, persistent RestTimer, technique flag chips, autosave on every set, and resume-in-progress-session. Log-set flow must be four taps or fewer. Do not implement analysis yet — leave `StopRuleBanner` as a component with a stubbed predicate.

**Prompt 4 — body and nutrition**
> Read SPEC.md sections 6.9 and 7.4. Implement `src/domain/body.ts` with rolling averages, weekly rate, corridor status, and week-12 projection, with tests covering sparse data (fewer than 4 weigh-ins returns null, not NaN). Build the Body screen with the weight chart, target corridor band, projection line, calorie/protein bars, and the weekly table. Add the inline daily entry to Today.

**Prompt 5 — the analysis engine**
> Read SPEC.md sections 6.2 through 6.8, 6.10 and 6.11. Implement `difficulty.ts`, `scoring.ts`, `analysis.ts` and `readiness.ts` as pure functions with a `TUNING` constants object. Write tests for: set scoring per metric type, flagged sets excluded from baselines, Progress Index against a hand-computed fixture, stagnation firing on flat data and staying silent on deload weeks, the recovery-cause variant, the one-variable rule, and each tendon guardrail. Then wire the real predicate into StopRuleBanner and add the stagnation card to Today.

**Prompt 6 — Progress and Review**
> Read SPEC.md sections 7.3 and 7.6. Build the Progress screen (four skill headline cards, per-exercise chart with metric picker and shaded phase bands, difficulty timeline with progression-event markers, consistency heatmap, flag frequency) and the Review screen generating the weekly summary from logged data only. Add the mobility benchmark form for weeks 1, 6 and 12, and the week-12 target checklist auto-marked where the data allows.

**Prompt 7 — durability and ship**
> Read SPEC.md section 7.7 and constraints in section 2. Add JSON export/import with lossless round-trip, CSV export of all sets, block reset with confirmation, PWA manifest and a minimal offline service worker, and an app icon. Then work through the 25 acceptance tests in section 10 one by one, fix what fails, and report the results as a checklist. Do not mark an item passing without actually exercising it.

**Prompt 8 — seed and sanity check**
> Add a dev-only "load demo block" action that seeds 6 weeks of plausible logs, weights and calories so I can see every chart populated. Confirm the stagnation detector, corridor statuses and Progress Indexes all behave on that data, then remove nothing — leave it behind a flag in Settings.

### 11.3 Working rules for the day

- **Verify prompt 2 by hand.** Open the Program screen and spot-check five random week/day combinations against section 5. Data errors here silently corrupt twelve weeks of decisions.
- After each prompt, ask Claude Code: *"What did you implement that the spec didn't ask for, and what did the spec ask for that you skipped?"* — it catches drift cheaply.
- If a step overruns by 30 minutes, cut per the section 9 cut list rather than extending the day.
- Keep a `NOTES.md` of tuning constants you change once you start using it for real (§6.2 and §6.3 will want adjusting after week 2).

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| Program data transcribed wrong | Prompt 2 is isolated, tested, and hand-verified before anything is built on it |
| Difficulty Index is a heuristic, not physics | Constants centralised in `TUNING`; the app always shows raw reps/seconds/kg alongside any score |
| Scope creep kills the day | Section 9 cut list; non-goals in section 1 are binding |
| Data loss from a browser wiping localStorage | Export is two taps; Review prompts a weekly export; consider a monthly manual copy to cloud storage |
| Logging friction beats good intentions in week 5 | Four-tap rule for a set is an acceptance test, not a preference |

---

## Appendix A — RPE reference (render in-app on the RPE stepper)

| RPE | Reserve |
|---|---|
| 6 | at least 4 clean reps or 5+ hold seconds left |
| 7 | about 3 reps or 4 hold seconds left |
| 8 | about 2 reps or 2–3 hold seconds left |
| 9 | about 1 rep or 1 hold second left |
| 10 | technical failure |

Most skill work stays at RPE 6–8.5.

## Appendix B — universal stop rules (render on every session header)

Stop a skill exercise when: hold time or reps drop more than ~15% · hips sag during front lever · elbows unlock · HSPU line changes substantially · you need momentum · two consecutive handstand attempts collapse immediately.

## Appendix C — 45-minute spreadsheet fallback

Only if the build day is lost. Google Sheets, six tabs:

1. **Log** — `date | week | phase | day | exercise | set | reps | seconds | addedKg | variant | assistTier | rpe | flags | note`. One row per set. Everything else is a pivot off this.
2. **Program** — the section 5 tables, with `INDEX/MATCH` from week+day to prescription.
3. **Today** — a one-cell week formula plus a `FILTER` of Program for today's date, and yesterday's numbers for the same exercise via `FILTER` on Log.
4. **Body** — `date | weight | kcal | protein`, with a 7-day `AVERAGE` and a weekly-rate column.
5. **Benchmarks** — six mobility rows × weeks 1/6/12.
6. **Charts** — best set per exercise per week, bodyweight rolling average, relative pull-up load.

It will work. It will also be entered on a phone, in a browser, between sets — which is exactly why the app is the better use of the day.
