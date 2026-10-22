import { describe, it, expect } from 'vite-plus/test';
import {
    reviewCard,
    projectInterval,
    newProgress,
    gradeFromQuality,
    migrateProgressToFsrs,
    isDue,
    sortByNextReview,
    GRADE_QUALITY,
    type Grade,
} from './srs';
import type { CardProgress } from 'shared/types';

const NOW = new Date('2026-01-01T00:00:00.000Z');
const DAY_MS = 1000 * 60 * 60 * 24;
const GRADES: Grade[] = ['again', 'hard', 'good', 'easy'];

const base = (over: Partial<CardProgress> = {}): CardProgress => ({
    cardUUID: 'c1',
    lastStudied: '2026-01-01T00:00:00.000Z',
    nextReview: '2026-01-01T00:00:00.000Z',
    stability: 0,
    difficulty: 0,
    state: 'New',
    reps: 0,
    lapses: 0,
    scheduledDays: 0,
    learningSteps: 0,
    masteryLevel: 'new',
    ...over,
});

const converted = (easeFactor: number, interval: number, repetitions = 2) =>
    migrateProgressToFsrs({
        cardUUID: 'c1',
        lastStudied: '2026-01-01T00:00:00.000Z',
        nextReview: new Date(NOW.getTime() + interval * DAY_MS).toISOString(),
        easeFactor,
        interval,
        repetitions,
        masteryLevel: 'learning',
    });

describe('GRADE_QUALITY', () => {
    it('maps grades to quality', () => {
        expect(GRADE_QUALITY).toEqual({ again: 1, hard: 3, good: 4, easy: 5 });
    });
});

describe('gradeFromQuality', () => {
    it('maps quality scores to grades', () => {
        expect([0, 1, 2, 3, 4, 5].map(gradeFromQuality)).toEqual([
            'again',
            'again',
            'again',
            'hard',
            'good',
            'easy',
        ]);
    });
});

describe('newProgress', () => {
    it('creates a New FSRS card due now', () => {
        const p = newProgress('abc', NOW);
        expect(p).toMatchObject({
            cardUUID: 'abc',
            state: 'New',
            reps: 0,
            lapses: 0,
            stability: 0,
            scheduledDays: 0,
            masteryLevel: 'new',
            lastStudied: NOW.toISOString(),
            nextReview: NOW.toISOString(),
        });
    });
});

describe('reviewCard', () => {
    it('schedules a new card 1/2/3/8 days out by grade', () => {
        const results = GRADES.map((g) =>
            reviewCard(newProgress('abc', NOW), g, NOW)
        );
        expect(results.map((r) => r.scheduledDays)).toEqual([1, 2, 3, 8]);
        for (const r of results) {
            expect(r.state).toBe('Review');
            expect(r.reps).toBe(1);
            expect(r.lastStudied).toBe(NOW.toISOString());
            expect(r.nextReview).toBe(
                new Date(NOW.getTime() + r.scheduledDays * DAY_MS).toISOString()
            );
        }
        const stabilities = results.map((r) => r.stability);
        expect([...stabilities].sort((a, b) => a - b)).toEqual(stabilities);
        expect(new Set(stabilities).size).toBe(4);
    });

    it('does not mutate prev', () => {
        const prev = newProgress('abc', NOW);
        const snapshot = structuredClone(prev);
        reviewCard(prev, 'good', NOW);
        expect(prev).toEqual(snapshot);
    });

    it('reviews a converted SM-2 card on its due date', () => {
        const prev = converted(2.5, 6);
        const due = new Date('2026-01-07T00:00:00.000Z');
        const [again, hard, good, easy] = GRADES.map((g) =>
            reviewCard(prev, g, due)
        );
        expect(again!.lapses).toBe(1);
        expect(again!.scheduledDays).toBe(1);
        expect(good!.lapses).toBe(0);
        expect(good!.scheduledDays).toBeGreaterThan(6);
        expect(again!.scheduledDays).toBeLessThan(hard!.scheduledDays);
        expect(hard!.scheduledDays).toBeLessThan(good!.scheduledDays);
        expect(good!.scheduledDays).toBeLessThan(easy!.scheduledDays);
        expect(good!.reps).toBe(3);
    });

    it('derives masteryLevel from state and stability', () => {
        const due = new Date('2026-01-07T00:00:00.000Z');
        expect(reviewCard(converted(2.5, 6), 'again', due).masteryLevel).toBe(
            'review'
        );
        const mature = converted(2.5, 100);
        expect(
            reviewCard(mature, 'good', new Date(mature.nextReview)).masteryLevel
        ).toBe('mastered');
    });

    it('normalises a raw SM-2 row instead of throwing', () => {
        const row = {
            cardUUID: 'c1',
            lastStudied: '2026-01-01T00:00:00.000Z',
            nextReview: '2026-01-02T00:00:00.000Z',
            easeFactor: 2.5,
            interval: 1,
            repetitions: 1,
            masteryLevel: 'learning',
        } as unknown as CardProgress;
        const r = reviewCard(row, 'good', NOW);
        expect(r.state).toBe('Review');
        expect(Number.isInteger(r.scheduledDays)).toBe(true);
        expect(r.scheduledDays).toBeGreaterThanOrEqual(1);
        expect(r).not.toHaveProperty('easeFactor');
        for (const g of GRADES) {
            expect(Number.isInteger(projectInterval(row, g))).toBe(true);
        }
    });

    it('does not throw when lastStudied is after now (clock rollback)', () => {
        const row = {
            ...converted(2.5, 6),
            lastStudied: '2026-10-14T00:00:00.000Z',
        };
        for (const g of GRADES) {
            expect(() => reviewCard(row, g, NOW)).not.toThrow();
            const days = reviewCard(row, g, NOW).scheduledDays;
            expect(Number.isInteger(days)).toBe(true);
            expect(days).toBeGreaterThanOrEqual(1);
        }
    });

    it('does not throw on missing or unparseable timestamps', () => {
        const corrupt = [undefined, null, 'garbage'];
        const rows = [
            ...corrupt.map((lastStudied) => ({ lastStudied })),
            ...corrupt.map((nextReview) => ({ nextReview })),
        ].map(
            (over) =>
                ({ ...converted(2.5, 6), ...over }) as unknown as CardProgress
        );
        // The fixture's lastStudied is NOW, so falling back to `now` must
        // schedule exactly like the clean row (and not like a 1970 review).
        const clean = converted(2.5, 6);
        for (const row of rows) {
            for (const g of GRADES) {
                const r = reviewCard(row, g, NOW);
                expect(r.scheduledDays).toBe(
                    reviewCard(clean, g, NOW).scheduledDays
                );
                expect(Number.isNaN(new Date(r.nextReview).getTime())).toBe(
                    false
                );
            }
        }
    });
});

describe('projectInterval', () => {
    it('returns 1/2/3/8 days for a new card', () => {
        const prev = newProgress('abc', NOW);
        expect(GRADES.map((g) => projectInterval(prev, g))).toEqual([
            1, 2, 3, 8,
        ]);
    });

    it('matches reviewCard for a Review card without mutating it', () => {
        const prev = converted(2.5, 6);
        const snapshot = structuredClone(prev);
        for (const g of GRADES) {
            const days = projectInterval(prev, g);
            expect(Number.isInteger(days)).toBe(true);
            expect(days).toBe(reviewCard(prev, g).scheduledDays);
        }
        expect(prev).toEqual(snapshot);
    });
});

describe('migrateProgressToFsrs', () => {
    const legacy = {
        cardUUID: 'c1',
        lastStudied: '2026-01-01T00:00:00.000Z',
        nextReview: '2026-01-07T00:00:00.000Z',
        masteryLevel: 'review' as const,
    };

    it('converts a studied SM-2 card to Review with the same due date', () => {
        const r = migrateProgressToFsrs({
            ...legacy,
            easeFactor: 2.5,
            interval: 6,
            repetitions: 2,
        });
        expect(r).toMatchObject({
            state: 'Review',
            stability: 6,
            reps: 2,
            lapses: 0,
            scheduledDays: 6,
            lastStudied: legacy.lastStudied,
            nextReview: legacy.nextReview,
        });
        expect(r.difficulty).toBeCloseTo(7.2474, 3);
        expect(r).not.toHaveProperty('easeFactor');
        expect(r).not.toHaveProperty('interval');
        expect(r).not.toHaveProperty('repetitions');
    });

    it('clamps difficulty and keeps a lapsed card scheduled', () => {
        const r = migrateProgressToFsrs({
            ...legacy,
            easeFactor: 1.3,
            interval: 1,
            repetitions: 0,
        });
        expect(r.difficulty).toBe(10);
        expect(r.state).toBe('Review');
    });

    it('treats a never-graded card as New', () => {
        const r = migrateProgressToFsrs({
            ...legacy,
            easeFactor: 2.5,
            interval: 0,
            repetitions: 0,
        });
        expect(r.state).toBe('New');
        expect(r.masteryLevel).toBe('new');
    });

    it('defaults a missing easeFactor instead of producing NaN', () => {
        const r = migrateProgressToFsrs({
            ...legacy,
            interval: 6,
            repetitions: 2,
        });
        for (const v of Object.values(r)) {
            expect(Number.isNaN(v)).toBe(false);
        }
    });

    it('preserves extra keys', () => {
        const r = migrateProgressToFsrs({
            ...legacy,
            easeFactor: 2.5,
            interval: 6,
            repetitions: 2,
            studysetUUID: 's1',
            _syncStatus: 'pending',
            _lastModified: 1,
        });
        expect(r).toMatchObject({
            studysetUUID: 's1',
            _syncStatus: 'pending',
            _lastModified: 1,
        });
    });

    it('returns an FSRS row unchanged', () => {
        const row = reviewCard(newProgress('abc', NOW), 'good', NOW);
        expect(migrateProgressToFsrs(row)).toEqual(row);
    });

    it('strips legacy keys from a hybrid row without recomputing it', () => {
        const fsrsRow = reviewCard(
            converted(2.5, 6),
            'good',
            new Date('2026-01-07T00:00:00.000Z')
        );
        const r = migrateProgressToFsrs({
            ...fsrsRow,
            easeFactor: NaN,
            interval: 1,
            repetitions: 0,
        });
        expect(r).not.toHaveProperty('easeFactor');
        expect(r).not.toHaveProperty('interval');
        expect(r).not.toHaveProperty('repetitions');
        expect(r.stability).toBe(fsrsRow.stability);
    });
});

describe('isDue / sortByNextReview', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');

    it('isDue is true when nextReview <= now', () => {
        expect(
            isDue(base({ nextReview: '2026-05-31T00:00:00.000Z' }), now)
        ).toBe(true);
        expect(
            isDue(base({ nextReview: '2026-06-02T00:00:00.000Z' }), now)
        ).toBe(false);
    });

    it('sorts ascending by nextReview', () => {
        const a = base({
            cardUUID: 'a',
            nextReview: '2026-06-03T00:00:00.000Z',
        });
        const b = base({
            cardUUID: 'b',
            nextReview: '2026-06-01T00:00:00.000Z',
        });
        expect(sortByNextReview([a, b]).map((p) => p.cardUUID)).toEqual([
            'b',
            'a',
        ]);
    });
});
