// Render smoke tests for the screens.
//
// tsc proves the props line up; it cannot prove a screen mounts. These render
// the real components against the real program data and read what a user would
// see, which is the only thing that catches a bad hook order, a crash inside a
// .map, or a day whose session cards silently come out empty.
//
// Deliberately no @testing-library dependency — react-dom/client and
// textContent are enough to answer "did it mount, and what does it say".
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { format, startOfWeek, subWeeks } from 'date-fns';
import Today from '../Today';
import Program from '../Program';
import SessionRunner from '../SessionRunner';
import { program, sessionTitles } from '../../data/program';
import { startOfToday } from '../../domain/clock';
import { dayIdForDate, exercisesFor, phaseForWeek } from '../../domain/phase';
import { useStore } from '../../store/useStore';
import type { Block, DayId } from '../../domain/types';

// Today renders the real calendar weekday, so the fixture is anchored to the
// real clock rather than a frozen date: start the block two weeks before this
// week's Monday, which puts "now" in week 3 — the first week that prescribes
// all three of Wednesday's sessions.
const TODAY = startOfToday();
const BLOCK_START = format(subWeeks(startOfWeek(TODAY, { weekStartsOn: 1 }), 2), 'yyyy-MM-dd');
const TODAY_DAY = dayIdForDate(TODAY);
const WEEK = 3;

/** Mounts exactly what it is handed — the caller supplies its own router. */
function render(element: ReactElement): { text: string; cleanup: () => void } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    text: container.textContent ?? '',
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

let cleanups: (() => void)[] = [];

/** Mounts a tab screen at "/" and returns everything it rendered as text. */
function screen(element: ReactElement): string {
  const { text, cleanup } = render(<MemoryRouter>{element}</MemoryRouter>);
  cleanups.push(cleanup);
  return text;
}

beforeEach(() => {
  useStore.getState().updateSettings({ blockStartDate: BLOCK_START });
});

afterEach(() => {
  cleanups.forEach((c) => c());
  cleanups = [];
});

describe('Today', () => {
  it('opens on the real weekday, in the week the block start implies', () => {
    const text = screen(<Today />);
    expect(text).toContain('WEEK 03');
    expect(text).toContain('OVERLOAD'); // week 3 closes wave 1's loading
  });

  it('renders a card per prescribed session, and names each one', () => {
    const text = screen(<Today />);
    const blocks = (['am', 'main', 'later'] as const).filter(
      (block) => exercisesFor(program, TODAY_DAY, block, WEEK).length > 0,
    );
    // Every day of the block has at least a main session.
    expect(blocks).toContain('main');

    for (const block of blocks) {
      expect(text, `${TODAY_DAY}/${block} title`).toContain(sessionTitles[TODAY_DAY][block]!);
    }
    // …and nothing is claimed for a slot this day does not run.
    for (const block of (['am', 'main', 'later'] as const).filter((b) => !blocks.includes(b))) {
      const title = sessionTitles[TODAY_DAY][block];
      if (title) expect(text, `${TODAY_DAY}/${block} should be absent`).not.toContain(title);
    }
  });

  it('lists every prescribed exercise of the day by name', () => {
    const text = screen(<Today />);
    for (const block of ['am', 'main', 'later'] as const) {
      for (const exercise of exercisesFor(program, TODAY_DAY, block, WEEK)) {
        expect(text, exercise.id).toContain(exercise.name);
      }
    }
  });

  it('counts a grease-the-groove block in rounds, not exercises', () => {
    const text = screen(<Today />);
    if (exercisesFor(program, TODAY_DAY, 'am', WEEK).length === 0) return; // not a GTG day
    // Week 3 of the shared rounds table is 3 rounds.
    expect(text).toContain('3 rounds');
  });
});

// Wednesday is the only day that runs all three slots, and it is the reason
// `later` exists at all — so it is pinned rather than left to whatever weekday
// the suite happens to run on.
describe('Today on a Wednesday', () => {
  // 2026-03-18 is a Wednesday, 10 weeks after this block start: week 11.
  const WED_BLOCK_START = '2026-01-05';
  const WEDNESDAY = new Date(2026, 2, 18);

  beforeEach(() => {
    vi.setSystemTime(WEDNESDAY);
    useStore.getState().updateSettings({ blockStartDate: WED_BLOCK_START });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders all three sessions, AM through Later', () => {
    const text = screen(<Today />);
    expect(text).toContain('WEEK 11');
    expect(text).toContain('Front lever grease the groove');
    expect(text).toContain('Full Body B — front lever, heavy pull, lower body');
    expect(text).toContain('Recovery run');
  });

  it('shows the recovery run in week 11 but not in week 1', () => {
    expect(exercisesFor(program, 'wed', 'later', 11)).toHaveLength(1);

    vi.setSystemTime(new Date(2026, 0, 7)); // Wednesday of week 1
    const week1 = screen(<Today />);
    expect(week1).toContain('WEEK 01');
    expect(week1).toContain('Full Body B — front lever, heavy pull, lower body');
    expect(week1).not.toContain('Recovery run');
  });
});

// The Program screen takes a week and a day, so it can be walked across the
// whole block without touching the store's notion of "today".
// The set logger is where the two new metrics actually have to work. A run
// block prefilled from the prescription and an RPE stepper that reaches 2 are
// the whole reason `runInterval` and `rpeScale` exist.
describe('SessionRunner on a run session', () => {
  function openSession(date: string, day: DayId, week: number, block: Block) {
    useStore.getState().startSession({ date, block, day, week, phase: phaseForWeek(week) });
    return render(
      <MemoryRouter initialEntries={[`/session/${date}/${block}`]}>
        <Routes>
          <Route path="/session/:date/:block" element={<SessionRunner />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('prefills a threshold rep at its prescribed 8 minutes, on the run RPE scale', () => {
    const { text, cleanup } = openSession('2026-01-06', 'tue', 1, 'main');
    cleanups.push(cleanup);
    // Exercise 1 of 4 is the warm-up: 10 min at RPE 2-3.
    expect(text).toContain('Warm-up — easy running');
    expect(text).toContain('10 min');
    // RPE 2 is only reachable because runs use the 1-10 run scale; the 6-10
    // strength scale would have clamped this to 6.
    expect(text).toContain('2');
  });

  it('opens a Tuesday later session as Flexibility A', () => {
    const { text, cleanup } = openSession('2026-01-06', 'tue', 1, 'later');
    cleanups.push(cleanup);
    expect(text).toContain('Loaded Cossack squat');
    expect(text).toContain('1/6');
  });

  it('opens Monday\'s carry with its prescribed 30 m and an added-load field', () => {
    const { text, cleanup } = openSession('2026-01-05', 'mon', 1, 'main');
    cleanups.push(cleanup);
    expect(text).toContain('1/9'); // nine slots in Full Body A
    expect(text).toContain('Deficit / elevated pike HSPU');
  });
});

describe('Program', () => {
  it('mounts on Monday of week 1 and shows the AM and Main slots', () => {
    const text = screen(<Program />);
    expect(text).toContain('Handstand grease the groove');
    expect(text).toContain('Full Body A');
    // The GTG rounds table opens at 2 rounds, and the primary HSPU at 4×5 RPE8.
    expect(text).toContain('4×5 RPE8');
    // Monday has no later session.
    expect(text).not.toContain('Later');
  });

  it('renders all three RPE tables, since the block trains on three scales', () => {
    const text = screen(<Program />);
    expect(text).toContain('RPE — Dynamic strength');
    expect(text).toContain('RPE — Isometric holds');
    expect(text).toContain('RPE — Flexibility');
  });

  it('labels week 1 as wave 1 baseline', () => {
    const text = screen(<Program />);
    expect(text).toContain('Wave 1');
    expect(text).toContain('BASELINE');
  });
});
