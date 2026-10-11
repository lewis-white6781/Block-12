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
import Review from '../Review';
import Decisions from '../Decisions';
import CaseStudyCard from '../../components/CaseStudyCard';
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
    expect(text).toContain('BUILD 2'); // weeks 3–4
  });

  it('shows the daily handstand + mobility tick box every day', () => {
    const text = screen(<Today />);
    expect(text).toContain('Handstand + mobility');
  });

  it('renders a card per prescribed session, and names each one', () => {
    const text = screen(<Today />);
    const blocks = (['am', 'main', 'later'] as const).filter(
      (block) => exercisesFor(program, TODAY_DAY, block, WEEK).length > 0,
    );
    for (const block of blocks) {
      expect(text, `${TODAY_DAY}/${block} title`).toContain(sessionTitles[TODAY_DAY][block]!);
    }
    if (blocks.length === 0) expect(text).toContain('No gym session today');
  });

  it('lists every prescribed exercise of the day by name', () => {
    const text = screen(<Today />);
    for (const block of ['am', 'main', 'later'] as const) {
      for (const exercise of exercisesFor(program, TODAY_DAY, block, WEEK)) {
        expect(text, exercise.id).toContain(exercise.name);
      }
    }
  });

  it("shows the day's nutrition targets next to what was eaten", () => {
    const text = screen(<Today />);
    expect(text).toContain('Weight & food');
    expect(text).toMatch(/of \d{4}/); // "of 2075" under calories
  });
});

// Pinned weekdays rather than whatever weekday the suite happens to run on.
describe('Today on fixed weekdays', () => {
  const BLOCK_START = '2026-01-05'; // a Monday

  beforeEach(() => {
    useStore.getState().updateSettings({ blockStartDate: BLOCK_START });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders Monday as Upper A', () => {
    vi.setSystemTime(new Date(2026, 0, 5)); // Monday of week 1
    const text = screen(<Today />);
    expect(text).toContain('WEEK 01');
    expect(text).toContain('BUILD 1');
    expect(text).toContain('Upper A — push-led');
    expect(text).toContain('Dragon flag');
    expect(text).not.toContain('Football');
  });

  it('renders Wednesday as a football tick with no gym session', () => {
    vi.setSystemTime(new Date(2026, 0, 7)); // Wednesday of week 1
    const text = screen(<Today />);
    expect(text).toContain('Football');
    expect(text).toContain('Handstand + mobility');
    expect(text).toContain('No gym session today');
    expect(text).not.toContain('Main ·');
  });

  it('renders the week-5 deload at 2 sets', () => {
    vi.setSystemTime(new Date(2026, 1, 2)); // Monday of week 5
    const text = screen(<Today />);
    expect(text).toContain('WEEK 05');
    expect(text).toContain('DELOAD');
    expect(text).toContain('2×4–6 RPE6–7');
  });

  it('renders the Christmas weeks as floor sessions only', () => {
    vi.setSystemTime(new Date(2026, 2, 16)); // Monday of week 11
    const text = screen(<Today />);
    expect(text).toContain('CHRISTMAS');
    expect(text).toContain('floor session');
    expect(text).toContain('Weighted pull-up');
    expect(text).not.toContain('Dragon flag');
  });

  it("ticks a box into the day's entry", () => {
    useStore.getState().toggleDailyCheck('2026-01-07', 'football');
    expect(useStore.getState().dailyEntries['2026-01-07'].checks?.football).toBe(true);
    useStore.getState().toggleDailyCheck('2026-01-07', 'football');
    expect(useStore.getState().dailyEntries['2026-01-07'].checks?.football).toBe(false);
  });
});

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

  it('opens Lower on its 8-minute warm-up, with eight slots', () => {
    const { text, cleanup } = openSession('2026-01-11', 'sun', 1, 'main');
    cleanups.push(cleanup);
    expect(text).toContain('Warm-up — Cossacks, lunges with reach, A-skips, leg swings');
    expect(text).toContain('1/8');
    expect(text).toContain('8 min');
  });

  it('opens Upper A on the primary HSPU', () => {
    const { text, cleanup } = openSession('2026-01-05', 'mon', 1, 'main');
    cleanups.push(cleanup);
    expect(text).toContain('1/7');
    expect(text).toContain('Primary HSPU (deficit pike → wall HSPU)');
  });

  it('opens Upper B on the hard front lever hold', () => {
    const { text, cleanup } = openSession('2026-01-08', 'thu', 1, 'main');
    cleanups.push(cleanup);
    expect(text).toContain('1/7');
    expect(text).toContain('Hard front lever hold');
  });

  it('opens Mobility + Core on the loaded Cossack, with twelve slots', () => {
    const { text, cleanup } = openSession('2026-01-10', 'sat', 1, 'main');
    cleanups.push(cleanup);
    expect(text).toContain('1/12');
    expect(text).toContain('Loaded Cossack squat');
  });
});

describe('Program', () => {
  it('mounts on Monday of week 1 with Upper A at the ★ table', () => {
    const text = screen(<Program />);
    expect(text).toContain('Upper A — push-led');
    // ★ lifts open at 3 sets at RPE 8–8.5.
    expect(text).toContain('3×4–6 RPE8–8.5');
    expect(text).toContain('Handstand + mobility');
  });

  it('renders the Sets by phase table and both RPE scales', () => {
    const text = screen(<Program />);
    expect(text).toContain('Sets by phase');
    expect(text).toContain('Peak + test');
    expect(text).toContain('RPE — Resistance training');
    expect(text).toContain('RPE — Stretching');
  });

  it('labels week 1 as Build 1', () => {
    const text = screen(<Program />);
    expect(text).toContain('Week 1');
    expect(text).toContain('BUILD 1');
  });
});

// v5.1 analytics screens. These mount behind the auth gate in the real app, so
// a headless browser cannot reach them — this is the only runtime check that
// they do not blank the screen.
describe('Review (v5.1 cards)', () => {
  it('mounts with the data-coverage and decisions cards', () => {
    const text = screen(<Review />);
    expect(text).toContain('Data coverage');
    expect(text).toContain('/7 days');
    expect(text).toContain('Decisions');
    expect(text).toContain('No decisions recorded this week.');
  });
});

describe('Decisions', () => {
  it('mounts empty with the record action', () => {
    const text = screen(<Decisions />);
    expect(text).toContain('Decision journal');
    expect(text).toContain('Record a decision');
    expect(text).toContain('No decisions recorded yet.');
  });

  it('renders a stored entry with its follow-up state', () => {
    useStore.getState().addDecisionEntry({
      id: 'render-test-d1',
      eventDate: BLOCK_START,
      createdAt: `${BLOCK_START}T12:00:00.000Z`,
      source: 'stagnation',
      exerciseId: 'ring-dip',
      evidence: 'flat 3 sessions at 8 reps',
      recommendation: 'Change one variable: greater ROM.',
      ruleVersion: '5.1.0',
      decision: 'accepted',
      action: 'added 2.5 kg',
      followUpSessions: 3,
    });
    const text = screen(<Decisions />);
    expect(text).toContain('Weighted ring dip');
    expect(text).toContain('Stagnation alert');
    expect(text).toContain('Action: added 2.5 kg');
    expect(text).toContain('Waiting — 0/3 comparable sessions');
  });
});

describe('CaseStudyCard', () => {
  it('mounts with no protocol and offers to create one', () => {
    const text = screen(<CaseStudyCard />);
    expect(text).toContain('Case study');
    expect(text).toContain('No protocol recorded yet.');
    expect(text).toContain('Create protocol');
  });
});
