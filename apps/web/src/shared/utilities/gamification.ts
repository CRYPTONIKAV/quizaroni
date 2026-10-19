import { PRESET_ACHIEVEMENTS } from 'shared/constants';
import type {
    AchievementMetric,
    CustomAchievement,
    GamificationState,
    PresetAchievementDef,
    StudySessionResult,
    StudyStatistics,
} from 'shared/types';

export const getDateKey = (date: Date = new Date()): string => {
    return date.toISOString().slice(0, 10);
};

export const getYesterdayKey = (date: Date = new Date()): string => {
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    return getDateKey(yesterday);
};

export const updateDailyStreak = (
    state: GamificationState,
    today: Date = new Date()
): Pick<
    GamificationState,
    'currentStreak' | 'longestStreak' | 'lastStudyDate'
> => {
    const todayKey = getDateKey(today);

    if (state.lastStudyDate === todayKey) {
        return {
            currentStreak: state.currentStreak,
            longestStreak: state.longestStreak,
            lastStudyDate: todayKey,
        };
    }

    const yesterdayKey = getYesterdayKey(today);
    const continued =
        state.lastStudyDate === yesterdayKey && state.currentStreak > 0;
    const currentStreak = continued ? state.currentStreak + 1 : 1;

    return {
        currentStreak,
        longestStreak: Math.max(state.longestStreak, currentStreak),
        lastStudyDate: todayKey,
    };
};

export type EffectiveStreak = { days: number; atRisk: boolean };

// The stored streak only updates when a session ends, so a missed day leaves
// it stale. Uses the same day keys as updateDailyStreak, so a streak shown
// here is one the next session would continue.
export const getEffectiveStreak = (
    state: Pick<GamificationState, 'currentStreak' | 'lastStudyDate'>,
    today: Date = new Date()
): EffectiveStreak => {
    const { currentStreak, lastStudyDate } = state;
    if (!lastStudyDate || currentStreak <= 0) {
        return { days: 0, atRisk: false };
    }
    if (lastStudyDate === getDateKey(today)) {
        return { days: currentStreak, atRisk: false };
    }
    if (lastStudyDate === getYesterdayKey(today)) {
        return { days: currentStreak, atRisk: true };
    }
    return { days: 0, atRisk: false };
};

type EvaluationContext = {
    gamification: GamificationState;
    statistics: StudyStatistics;
    session: StudySessionResult;
};

const getMetricValue = (
    metric: AchievementMetric,
    context: EvaluationContext,
    studysetUUID?: string
): number => {
    const { gamification, statistics, session } = context;
    const projectedSessions = statistics.totalSessions + 1;
    const projectedCards = statistics.totalCardsStudied + session.totalCards;

    switch (metric) {
        case 'daily_streak':
            return gamification.currentStreak;
        case 'total_sessions':
            return projectedSessions;
        case 'total_cards':
            return projectedCards;
        case 'session_streak':
            return session.streak;
        case 'perfect_session':
            return session.accuracy >= 100 && session.totalCards > 0 ? 1 : 0;
        case 'studyset_sessions':
            if (!studysetUUID) return 0;
            return (gamification.studysetSessionCounts[studysetUUID] ?? 0) + 1;
        default:
            return 0;
    }
};

const isAchievementMet = (
    metric: AchievementMetric,
    threshold: number,
    context: EvaluationContext,
    studysetUUID?: string
): boolean => {
    const value = getMetricValue(metric, context, studysetUUID);
    if (metric === 'perfect_session') {
        return value >= threshold;
    }
    return value >= threshold;
};

export const evaluatePresetAchievements = (
    context: EvaluationContext,
    presets: PresetAchievementDef[] = Object.values(PRESET_ACHIEVEMENTS)
): string[] => {
    const unlocked = new Set(context.gamification.unlockedAchievementIds);

    for (const preset of presets) {
        if (unlocked.has(preset.id)) continue;
        if (isAchievementMet(preset.metric, preset.threshold, context)) {
            unlocked.add(preset.id);
        }
    }

    return [...unlocked].filter(
        (id) => !context.gamification.unlockedAchievementIds.includes(id)
    );
};

export const evaluateCustomAchievements = (
    context: EvaluationContext,
    customAchievements: CustomAchievement[]
): { unlockedIds: string[]; updated: CustomAchievement[] } => {
    const newlyUnlocked: string[] = [];
    const updated = customAchievements.map((achievement) => {
        if (achievement.unlockedAt) return achievement;

        const met = isAchievementMet(
            achievement.metric,
            achievement.threshold,
            context,
            achievement.studysetUUID
        );

        if (!met) return achievement;

        newlyUnlocked.push(achievement.id);
        return {
            ...achievement,
            unlockedAt: new Date().toISOString(),
        };
    });

    return { unlockedIds: newlyUnlocked, updated };
};

export const createInitialGamificationState = (): GamificationState => ({
    currentStreak: 0,
    longestStreak: 0,
    lastStudyDate: null,
    unlockedAchievementIds: [],
    unlockedAtById: {},
    studiedStudysetUUIDs: [],
    studysetSessionCounts: {},
});

export const mergeGamificationState = (
    local: GamificationState,
    remote: GamificationState
): GamificationState => {
    const longestStreak = Math.max(local.longestStreak, remote.longestStreak);

    const streak = mergeStreakFields(local, remote);

    const unlockedAchievementIds = [
        ...new Set([
            ...local.unlockedAchievementIds,
            ...remote.unlockedAchievementIds,
        ]),
    ];

    const unlockedAtById = {
        ...remote.unlockedAtById,
        ...local.unlockedAtById,
    };
    for (const id of unlockedAchievementIds) {
        const localAt = local.unlockedAtById[id];
        const remoteAt = remote.unlockedAtById[id];
        if (localAt && remoteAt) {
            unlockedAtById[id] = localAt < remoteAt ? localAt : remoteAt;
        }
    }

    const studiedStudysetUUIDs = [
        ...new Set([
            ...local.studiedStudysetUUIDs,
            ...remote.studiedStudysetUUIDs,
        ]),
    ];

    const studysetSessionCounts = { ...remote.studysetSessionCounts };
    for (const [uuid, count] of Object.entries(local.studysetSessionCounts)) {
        studysetSessionCounts[uuid] = Math.max(
            count,
            studysetSessionCounts[uuid] ?? 0
        );
    }

    return {
        ...streak,
        longestStreak,
        unlockedAchievementIds,
        unlockedAtById,
        studiedStudysetUUIDs,
        studysetSessionCounts,
    };
};

const mergeStreakFields = (
    local: GamificationState,
    remote: GamificationState
): Pick<GamificationState, 'currentStreak' | 'lastStudyDate'> => {
    if (!local.lastStudyDate && !remote.lastStudyDate) {
        return { currentStreak: 0, lastStudyDate: null };
    }
    if (!local.lastStudyDate) {
        return {
            currentStreak: remote.currentStreak,
            lastStudyDate: remote.lastStudyDate,
        };
    }
    if (!remote.lastStudyDate) {
        return {
            currentStreak: local.currentStreak,
            lastStudyDate: local.lastStudyDate,
        };
    }

    if (local.lastStudyDate > remote.lastStudyDate) {
        return {
            currentStreak: local.currentStreak,
            lastStudyDate: local.lastStudyDate,
        };
    }
    if (remote.lastStudyDate > local.lastStudyDate) {
        return {
            currentStreak: remote.currentStreak,
            lastStudyDate: remote.lastStudyDate,
        };
    }

    return {
        currentStreak: Math.max(local.currentStreak, remote.currentStreak),
        lastStudyDate: local.lastStudyDate,
    };
};

export const mergeCustomAchievements = (
    local: CustomAchievement[],
    remote: CustomAchievement[]
): CustomAchievement[] => {
    const byId = new Map<string, CustomAchievement>();

    for (const achievement of [...remote, ...local]) {
        const existing = byId.get(achievement.id);
        if (!existing) {
            byId.set(achievement.id, achievement);
            continue;
        }

        const unlockedAt =
            existing.unlockedAt && achievement.unlockedAt
                ? existing.unlockedAt < achievement.unlockedAt
                    ? existing.unlockedAt
                    : achievement.unlockedAt
                : (existing.unlockedAt ?? achievement.unlockedAt);

        byId.set(achievement.id, {
            ...existing,
            ...achievement,
            unlockedAt,
            createdAt:
                existing.createdAt < achievement.createdAt
                    ? existing.createdAt
                    : achievement.createdAt,
        });
    }

    return [...byId.values()];
};

export const applySessionToGamification = (
    state: GamificationState,
    session: StudySessionResult,
    today: Date = new Date()
): GamificationState => {
    const streakUpdate = updateDailyStreak(state, today);
    const studiedStudysetUUIDs = state.studiedStudysetUUIDs.includes(
        session.studysetUUID
    )
        ? state.studiedStudysetUUIDs
        : [...state.studiedStudysetUUIDs, session.studysetUUID];

    const prevCount = state.studysetSessionCounts[session.studysetUUID] ?? 0;

    return {
        ...state,
        ...streakUpdate,
        studiedStudysetUUIDs,
        studysetSessionCounts: {
            ...state.studysetSessionCounts,
            [session.studysetUUID]: prevCount + 1,
        },
    };
};
