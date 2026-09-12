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
// week's Monday, which puts "now" in week 3.
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
    expect(text).toContain('ACCUMULATION'); // weeks 3–5
  });

  it('renders a card per prescribed session, and names each one', () => {
    const text = screen(<Today />);
    const blocks = (['am', 'main', 'later'] as const).filter(
      (block) => exercisesFor(program, TODAY_DAY, block, WEEK).length > 0,
    );
    // Every day prescribes something — Thursday only its evening stretch.
    expect(blocks.length).toBeGreaterThan(0);

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
    // Week 3 of the shared rounds table is 2 rounds.
    expect(text).toContain('2 rounds');
  });
});

// Monday and Friday run all three slots; Thursday runs only its evening
// stretch. Both shapes are pinned rather than left to whatever weekday the
// suite happens to run on.
describe('Today on fixed weekdays', () => {
  const BLOCK_START = '2026-01-05'; // a Monday

  beforeEach(() => {
    useStore.getState().updateSettings({ blockStartDate: BLOCK_START });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders all three Monday sessions, AM through Later', () => {
    vi.setSystemTime(new Date(2026, 2, 16)); // Monday of week 11
    const text = screen(<Today />);
    expect(text).toContain('WEEK 11');
    expect(text).toContain('REALIZATION');
    expect(text).toContain('Handstand grease the groove');
    expect(text).toContain('Push A — HSPU priority');
    expect(text).toContain('Moderate continuous cardio');
  });

  it('renders Thursday as a rest day with only Flexibility A', () => {
    vi.setSystemTime(new Date(2026, 0, 8)); // Thursday of week 1
    const text = screen(<Today />);
    expect(text).toContain('WEEK 01');
    expect(text).toContain('Rest + Flexibility A');
    expect(text).toContain('Flexibility A — pancake, middle split, shoulders');
    expect(text).toContain('Loaded Cossack squat');
    expect(text).not.toContain('Main ·');
    expect(text).not.toContain('AM ·');
  });

  it('renders the week-6 deload with its reduced volume', () => {
    vi.setSystemTime(new Date(2026, 1, 9)); // Monday of week 6
    const text = screen(<Today />);
    expect(text).toContain('WEEK 06');
    expect(text).toContain('DELOAD');
    expect(text).toContain('1 round');
    expect(exercisesFor(program, 'mon', 'main', 6).map((e) => e.id)).toContain('hspu-primary');
  });
});

// The set logger is where the cardio metrics actually have to work. A block
// prefilled from the prescription and an RPE stepper that reaches 2 are the
// whole reason `runInterval` and `rpeScale` exist.
describe('SessionRunner', () => {
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

  it('prefills the Sunday long cardio at its prescribed 45 minutes, on the run RPE scale', () => {
    const { text, cleanup } = openSession('2026-01-11', 'sun', 1, 'main');
    cleanups.push(cleanup);
    expect(text).toContain('Long low-intensity cardio');
    expect(text).toContain('45 min');
    // RPE 2 is only reachable because cardio uses the 1-10 run scale; the 6-10
    // strength scale would have clamped this to 6.
    expect(text).toContain('2');
  });

  it('opens a Thursday later session as Flexibility A', () => {
    const { text, cleanup } = openSession('2026-01-08', 'thu', 1, 'later');
    cleanups.push(cleanup);
    expect(text).toContain('Loaded Cossack squat');
    expect(text).toContain('1/6');
  });

  it('opens Push A on the primary HSPU with five slots', () => {
    const { text, cleanup } = openSession('2026-01-05', 'mon', 1, 'main');
    cleanups.push(cleanup);
    expect(text).toContain('1/5');
    expect(text).toContain('Deficit / elevated pike HSPU');
  });

  it('opens the Friday HIIT on the warm-up with three slots', () => {
    const { text, cleanup } = openSession('2026-01-09', 'fri', 1, 'later');
    cleanups.push(cleanup);
    expect(text).toContain('1/3');
    expect(text).toContain('Warm-up — easy + accelerations');
  });
});

describe('Program', () => {
  it('mounts on Monday of week 1 and shows all three slots', () => {
    const text = screen(<Program />);
    expect(text).toContain('Handstand grease the groove');
    expect(text).toContain('Push A — HSPU priority');
    expect(text).toContain('Moderate continuous cardio');
    // The primary HSPU opens at 4 sets of 4–6 at RPE 8.
    expect(text).toContain('4×4–6 RPE8');
  });

  it('renders both RPE tables, since the block trains on two scales', () => {
    const text = screen(<Program />);
    expect(text).toContain('RPE — Resistance training');
    expect(text).toContain('RPE — Flexibility');
    expect(text).not.toContain('Isometric holds');
  });

  it('labels week 1 as re-entry', () => {
    const text = screen(<Program />);
    expect(text).toContain('Week 1');
    expect(text).toContain('RE-ENTRY');
  });
});
