import { describe, expect, it } from 'vite-plus/test';
import {
    applySessionToGamification,
    createInitialGamificationState,
    evaluatePresetAchievements,
    getDateKey,
    getEffectiveStreak,
    getYesterdayKey,
    mergeCustomAchievements,
    mergeGamificationState,
    updateDailyStreak,
} from './gamification';
import type { StudySessionResult, StudyStatistics } from 'shared/types';

const baseSession = (
    overrides: Partial<StudySessionResult> = {}
): StudySessionResult => ({
    sessionUUID: 'session-1',
    studysetUUID: 'set-1',
    mode: 'flashcards',
    totalCards: 5,
    correctAnswers: 5,
    score: 500,
    timeSpent: 120,
    accuracy: 100,
    streak: 5,
    completedAt: '2026-06-05T12:00:00.000Z',
    achievements: [],
    ...overrides,
});

const baseStatistics = (
    overrides: Partial<StudyStatistics> = {}
): StudyStatistics => ({
    totalSessions: 0,
    totalCardsStudied: 0,
    averageAccuracy: 0,
    totalTimeSpent: 0,
    achievements: [],
    progressByStudyset: new Map(),
    ...overrides,
});

describe('updateDailyStreak', () => {
    it('starts a streak on first study day', () => {
        const state = createInitialGamificationState();
        const today = new Date('2026-06-05T10:00:00.000Z');

        const result = updateDailyStreak(state, today);

        expect(result.currentStreak).toBe(1);
        expect(result.longestStreak).toBe(1);
        expect(result.lastStudyDate).toBe(getDateKey(today));
    });

    it('extends streak when studying on consecutive days', () => {
        const yesterday = new Date('2026-06-04T10:00:00.000Z');
        const today = new Date('2026-06-05T10:00:00.000Z');
        const state = {
            ...createInitialGamificationState(),
            currentStreak: 2,
            longestStreak: 2,
            lastStudyDate: getDateKey(yesterday),
        };

        const result = updateDailyStreak(state, today);

        expect(result.currentStreak).toBe(3);
        expect(result.longestStreak).toBe(3);
    });

    it('resets streak after a gap', () => {
        const today = new Date('2026-06-05T10:00:00.000Z');
        const state = {
            ...createInitialGamificationState(),
            currentStreak: 5,
            longestStreak: 5,
            lastStudyDate: '2026-06-01',
        };

        const result = updateDailyStreak(state, today);

        expect(result.currentStreak).toBe(1);
        expect(result.longestStreak).toBe(5);
    });

    it('does not increment streak twice on the same day', () => {
        const today = new Date('2026-06-05T10:00:00.000Z');
        const state = {
            ...createInitialGamificationState(),
            currentStreak: 3,
            longestStreak: 3,
            lastStudyDate: getDateKey(today),
        };

        const result = updateDailyStreak(state, today);

        expect(result.currentStreak).toBe(3);
    });
});

describe('evaluatePresetAchievements', () => {
    it('unlocks first study and perfect score on initial session', () => {
        const session = baseSession();
        const gamification = applySessionToGamification(
            createInitialGamificationState(),
            session
        );

        const unlocked = evaluatePresetAchievements({
            gamification,
            statistics: baseStatistics(),
            session,
        });

        expect(unlocked).toContain('first-study');
        expect(unlocked).toContain('perfect-score');
    });

    it('unlocks streak-7 when daily streak reaches 7', () => {
        const session = baseSession({ accuracy: 80, streak: 2 });
        const gamification = {
            ...createInitialGamificationState(),
            currentStreak: 7,
            longestStreak: 7,
            lastStudyDate: getDateKey(new Date('2026-06-05T10:00:00.000Z')),
        };

        const unlocked = evaluatePresetAchievements({
            gamification,
            statistics: baseStatistics({ totalSessions: 5 }),
            session,
        });

        expect(unlocked).toContain('streak-7');
    });
});

describe('getYesterdayKey', () => {
    it('returns previous calendar day', () => {
        const today = new Date('2026-06-05T10:00:00.000Z');
        expect(getYesterdayKey(today)).toBe('2026-06-04');
    });
});

describe('mergeGamificationState', () => {
    it('unions achievements and keeps earliest unlock timestamps', () => {
        const local = {
            ...createInitialGamificationState(),
            unlockedAchievementIds: ['first-study'],
            unlockedAtById: { 'first-study': '2026-06-01T10:00:00.000Z' },
            studysetSessionCounts: { 'set-1': 3 },
        };
        const remote = {
            ...createInitialGamificationState(),
            unlockedAchievementIds: ['perfect-score'],
            unlockedAtById: { 'perfect-score': '2026-06-02T10:00:00.000Z' },
            studysetSessionCounts: { 'set-1': 5 },
        };

        const merged = mergeGamificationState(local, remote);

        expect(merged.unlockedAchievementIds).toEqual(
            expect.arrayContaining(['first-study', 'perfect-score'])
        );
        expect(merged.studysetSessionCounts['set-1']).toBe(5);
    });
});

describe('mergeCustomAchievements', () => {
    it('merges custom goals by id and keeps earliest unlock', () => {
        const local = [
            {
                id: 'goal-1',
                title: 'Local goal',
                description: '',
                icon: '🎯',
                metric: 'total_sessions' as const,
                threshold: 5,
                createdAt: '2026-06-01T00:00:00.000Z',
                unlockedAt: '2026-06-03T00:00:00.000Z',
            },
        ];
        const remote = [
            {
                id: 'goal-1',
                title: 'Remote goal',
                description: '',
                icon: '🎯',
                metric: 'total_sessions' as const,
                threshold: 5,
                createdAt: '2026-06-02T00:00:00.000Z',
                unlockedAt: '2026-06-02T00:00:00.000Z',
            },
        ];

        const merged = mergeCustomAchievements(local, remote);

        expect(merged).toHaveLength(1);
        expect(merged[0]?.unlockedAt).toBe('2026-06-02T00:00:00.000Z');
    });
});

describe('getEffectiveStreak', () => {
    const today = new Date('2026-10-18T12:00:00.000Z');
    const studied = (lastStudyDate: string | null, currentStreak = 5) => ({
        currentStreak,
        lastStudyDate,
    });

    it('keeps the streak when the last study day is today', () => {
        expect(getEffectiveStreak(studied('2026-10-18'), today)).toEqual({
            days: 5,
            atRisk: false,
        });
    });

    it('marks the streak at risk when the last study day was yesterday', () => {
        expect(getEffectiveStreak(studied('2026-10-17'), today)).toEqual({
            days: 5,
            atRisk: true,
        });
    });

    it.each(['2026-10-16', '2026-09-01'])(
        'treats a gap of 2+ days (%s) as a broken streak',
        (lastStudyDate) => {
            expect(getEffectiveStreak(studied(lastStudyDate), today)).toEqual({
                days: 0,
                atRisk: false,
            });
        }
    );

    it('returns no streak without any study history', () => {
        expect(
            getEffectiveStreak(createInitialGamificationState(), today)
        ).toEqual({ days: 0, atRisk: false });
    });

    it('returns no streak when the stored streak is zero', () => {
        expect(getEffectiveStreak(studied('2026-10-18', 0), today)).toEqual({
            days: 0,
            atRisk: false,
        });
    });

    it('treats a study day after today as broken, as updateDailyStreak does', () => {
        expect(getEffectiveStreak(studied('2026-10-19'), today)).toEqual({
            days: 0,
            atRisk: false,
        });
    });
});
