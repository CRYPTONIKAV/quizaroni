import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
    StudySessionState,
    StudyAnswer,
    StudySessionResult,
    StudyStatistics,
    Achievement,
} from 'shared/types';
import {
    gradeFromQuality,
    newProgress,
    reviewCard,
} from 'shared/utilities/srs';
import { cardProgressRepository } from 'state/local/repositories';
import { useGamificationStore } from './gamification';

type StudySessionStore = {
    // Active session
    activeSession: StudySessionState | null;

    // Statistics
    statistics: StudyStatistics;

    // Actions
    startSession: (config: Partial<StudySessionState>) => void;
    endSession: () => StudySessionResult | null;
    updateCurrentCard: (index: number) => void;
    recordAnswer: (answer: StudyAnswer) => void;
    incrementScore: (points: number) => void;
    updateStreak: (correct: boolean) => void;
    resetSession: () => void;

    // Progress management (FSRS algorithm)
    updateCardProgress: (cardUUID: string, quality: number) => void;

    // Statistics
    recordSessionResult: (result: StudySessionResult) => void;
    unlockAchievement: (achievement: Achievement) => void;
};

export const useStudySessionStore = create<StudySessionStore>()(
    persist(
        (set, get) => ({
            activeSession: null,
            statistics: {
                totalSessions: 0,
                totalCardsStudied: 0,
                averageAccuracy: 0,
                totalTimeSpent: 0,
                achievements: [],
                progressByStudyset: new Map(),
            },

            startSession: (config) =>
                set({
                    activeSession: {
                        currentCardIndex: 0,
                        answers: [],
                        score: 0,
                        streak: 0,
                        maxStreak: 0,
                        startTime: new Date().toISOString(),
                        ...config,
                    } as StudySessionState,
                }),

            endSession: () => {
                const session = get().activeSession;
                if (!session) return null;

                const endTime = new Date();
                const startTime = new Date(session.startTime);
                const timeSpent =
                    (endTime.getTime() - startTime.getTime()) / 1000;

                const correctAnswers = session.answers.filter(
                    (a) => a.correct
                ).length;
                const accuracy =
                    session.answers.length > 0
                        ? (correctAnswers / session.answers.length) * 100
                        : 0;

                let result: StudySessionResult = {
                    sessionUUID: crypto.randomUUID(),
                    studysetUUID: session.studysetUUID,
                    mode: session.mode,
                    totalCards: session.cards.length,
                    correctAnswers,
                    score: session.score,
                    timeSpent,
                    accuracy,
                    streak: session.maxStreak,
                    completedAt: endTime.toISOString(),
                    achievements: [],
                };

                const statistics = get().statistics;
                result = useGamificationStore
                    .getState()
                    .processSessionEnd(result, statistics);

                get().recordSessionResult(result);

                for (const achievementId of result.achievements) {
                    const achievement =
                        useGamificationStore
                            .getState()
                            .getAchievementById(achievementId);
                    if (achievement) {
                        get().unlockAchievement(achievement);
                    }
                }

                set({ activeSession: null });
                return result;
            },

            updateCurrentCard: (index) =>
                set((state) => ({
                    activeSession: state.activeSession
                        ? { ...state.activeSession, currentCardIndex: index }
                        : null,
                })),

            recordAnswer: (answer) =>
                set((state) => ({
                    activeSession: state.activeSession
                        ? {
                              ...state.activeSession,
                              answers: [...state.activeSession.answers, answer],
                          }
                        : null,
                })),

            incrementScore: (points) =>
                set((state) => ({
                    activeSession: state.activeSession
                        ? {
                              ...state.activeSession,
                              score: state.activeSession.score + points,
                          }
                        : null,
                })),

            updateStreak: (correct) =>
                set((state) => {
                    if (!state.activeSession) return {};
                    const newStreak = correct
                        ? state.activeSession.streak + 1
                        : 0;
                    return {
                        activeSession: {
                            ...state.activeSession,
                            streak: newStreak,
                            maxStreak: Math.max(
                                state.activeSession.maxStreak,
                                newStreak
                            ),
                        },
                    };
                }),

            resetSession: () => set({ activeSession: null }),

            // FSRS spaced repetition — pure math in shared/utilities/srs,
            // persisted to Dexie via cardProgressRepository (local-first).
            updateCardProgress: (cardUUID, quality) => {
                const studysetUUID = get().activeSession?.studysetUUID;
                if (!studysetUUID) return;

                void (async () => {
                    const existing =
                        await cardProgressRepository.getByCard(cardUUID);
                    const prev = existing ?? newProgress(cardUUID);
                    const updated = reviewCard(prev, gradeFromQuality(quality));
                    await cardProgressRepository.upsert(updated, studysetUUID);
                })();
            },

            recordSessionResult: (result) => {
                set((state) => {
                    const newTotalSessions = state.statistics.totalSessions + 1;
                    const newAverageAccuracy =
                        (state.statistics.averageAccuracy *
                            state.statistics.totalSessions +
                            result.accuracy) /
                        newTotalSessions;

                    return {
                        statistics: {
                            ...state.statistics,
                            totalSessions: newTotalSessions,
                            totalCardsStudied:
                                state.statistics.totalCardsStudied +
                                result.totalCards,
                            totalTimeSpent:
                                state.statistics.totalTimeSpent +
                                result.timeSpent,
                            averageAccuracy: newAverageAccuracy,
                        },
                    };
                });
            },

            unlockAchievement: (achievement) => {
                const existing = get().statistics.achievements.find(
                    (a) => a.id === achievement.id
                );
                if (existing) return;

                const newAchievement = achievement;

                set((state) => ({
                    statistics: {
                        ...state.statistics,
                        achievements: [
                            ...state.statistics.achievements,
                            newAchievement,
                        ],
                    },
                }));
            },
        }),
        {
            name: 'study-session-storage',
            partialize: (state) => ({
                statistics: {
                    ...state.statistics,
                    progressByStudyset: Array.from(
                        state.statistics.progressByStudyset.entries()
                    ),
                },
            }),
            merge: (persistedState, currentState) => {
                const persisted = persistedState as any;
                return {
                    ...currentState,
                    statistics: {
                        ...currentState.statistics,
                        ...persisted.statistics,
                        progressByStudyset: new Map(
                            persisted.statistics?.progressByStudyset || []
                        ),
                    },
                };
            },
        }
    )
);
