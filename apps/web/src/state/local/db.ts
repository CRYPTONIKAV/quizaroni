import Dexie, { type EntityTable } from 'dexie';
import type {
    Studyset,
    User,
    StudySessionResult,
    CardProgress,
    CustomAchievement,
    GamificationState,
} from 'shared/types';
import type { AIMessage } from 'shared/ai/providers';
import { migrateProgressToFsrs } from 'shared/utilities/srs';

// Local-first versions of types with sync metadata
export interface LocalStudyset extends Studyset {
    // Sync metadata
    _syncStatus: 'synced' | 'pending' | 'conflict';
    _lastModified: number; // timestamp for sync
    _localOnly?: boolean; // true if created while offline
}

export interface LocalUser extends User {
    _syncStatus: 'synced' | 'pending' | 'conflict';
    _lastModified: number;
}

export interface LocalStudySession extends StudySessionResult {
    _syncStatus: 'synced' | 'pending';
    _lastModified: number;
}

export interface LocalCardProgress extends CardProgress {
    _syncStatus: 'synced' | 'pending';
    _lastModified: number;
    studysetUUID: string;
}

export interface LocalGamificationRecord extends GamificationState {
    id: string;
    _lastModified: number;
}

export interface LocalCustomAchievement extends CustomAchievement {
    _lastModified: number;
}

// One persisted AI conversation per study set
export interface LocalAIChatHistory {
    studysetUUID: string;
    messages: AIMessage[];
    updatedAt: number;
}

// Database tables interface
interface QuizaroniDatabase extends Dexie {
    studysets: EntityTable<LocalStudyset, 'studysetUUID'>;
    users: EntityTable<LocalUser, 'userUUID'>;
    sessions: EntityTable<LocalStudySession, 'sessionUUID'>;
    cardProgress: EntityTable<LocalCardProgress, 'cardUUID'>;
    gamification: EntityTable<LocalGamificationRecord, 'id'>;
    customAchievements: EntityTable<LocalCustomAchievement, 'id'>;
    aiChatHistory: EntityTable<LocalAIChatHistory, 'studysetUUID'>;
    syncQueue: EntityTable<
        {
            id: number;
            operation: 'create' | 'update' | 'delete';
            entityType: 'studyset' | 'user';
            entityId: string;
            payload: unknown;
            retryCount: number;
            createdAt: number;
        },
        'id'
    >;
}

const DB_NAME = 'quizaroni_v1';
const DB_VERSION = 5;

let dbInstance: QuizaroniDatabase | null = null;

export function getDatabase(): QuizaroniDatabase {
    if (dbInstance) {
        return dbInstance;
    }

    const db = new Dexie(DB_NAME) as QuizaroniDatabase;

    db.version(2).stores({
        studysets:
            'studysetUUID, userUUID, _syncStatus, _lastModified, labels, lastViewed',
        users: 'userUUID, _syncStatus, _lastModified',
        sessions: 'sessionUUID, studysetUUID, completedAt, _syncStatus',
        cardProgress:
            'cardUUID, studysetUUID, nextReview, _syncStatus, [studysetUUID+nextReview]',
        syncQueue: '++id, entityType, entityId, createdAt',
    });

    db.version(3).stores({
        studysets:
            'studysetUUID, userUUID, _syncStatus, _lastModified, labels, lastViewed',
        users: 'userUUID, _syncStatus, _lastModified',
        sessions: 'sessionUUID, studysetUUID, completedAt, _syncStatus',
        cardProgress:
            'cardUUID, studysetUUID, nextReview, _syncStatus, [studysetUUID+nextReview]',
        gamification: 'id',
        customAchievements: 'id, unlockedAt',
        syncQueue: '++id, entityType, entityId, createdAt',
    });

    db.version(4).stores({
        studysets:
            'studysetUUID, userUUID, _syncStatus, _lastModified, labels, lastViewed',
        users: 'userUUID, _syncStatus, _lastModified',
        sessions: 'sessionUUID, studysetUUID, completedAt, _syncStatus',
        cardProgress:
            'cardUUID, studysetUUID, nextReview, _syncStatus, [studysetUUID+nextReview]',
        gamification: 'id',
        customAchievements: 'id, unlockedAt',
        aiChatHistory: 'studysetUUID, updatedAt',
        syncQueue: '++id, entityType, entityId, createdAt',
    });

    // v5: card progress moves from SM-2 to FSRS state; indexes are unchanged.
    db.version(DB_VERSION)
        .stores({
            studysets:
                'studysetUUID, userUUID, _syncStatus, _lastModified, labels, lastViewed',
            users: 'userUUID, _syncStatus, _lastModified',
            sessions: 'sessionUUID, studysetUUID, completedAt, _syncStatus',
            cardProgress:
                'cardUUID, studysetUUID, nextReview, _syncStatus, [studysetUUID+nextReview]',
            gamification: 'id',
            customAchievements: 'id, unlockedAt',
            aiChatHistory: 'studysetUUID, updatedAt',
            syncQueue: '++id, entityType, entityId, createdAt',
        })
        .upgrade((tx) =>
            tx
                .table('cardProgress')
                .toCollection()
                .modify((row, ctx) => {
                    ctx.value = migrateProgressToFsrs(row);
                })
        );

    dbInstance = db;
    return db;
}

// Reset database (useful for logout or data reset)
export async function resetDatabase(): Promise<void> {
    const db = getDatabase();
    await db.delete();
    dbInstance = null;
}

// Export all data (for migration/backup)
export async function exportAllData(): Promise<{
    studysets: LocalStudyset[];
    users: LocalUser[];
    sessions: LocalStudySession[];
    cardProgress: LocalCardProgress[];
    gamification: LocalGamificationRecord[];
    customAchievements: LocalCustomAchievement[];
}> {
    const db = getDatabase();

    const [
        studysets,
        users,
        sessions,
        cardProgress,
        gamification,
        customAchievements,
    ] = await Promise.all([
        db.studysets.toArray(),
        db.users.toArray(),
        db.sessions.toArray(),
        db.cardProgress.toArray(),
        db.gamification.toArray(),
        db.customAchievements.toArray(),
    ]);

    return {
        studysets,
        users,
        sessions,
        cardProgress,
        gamification,
        customAchievements,
    };
}

// Import data (for migration/restore)
export async function importAllData(data: {
    studysets?: LocalStudyset[];
    users?: LocalUser[];
    sessions?: LocalStudySession[];
    cardProgress?: LocalCardProgress[];
    gamification?: LocalGamificationRecord[];
    customAchievements?: LocalCustomAchievement[];
}): Promise<void> {
    const db = getDatabase();

    await db.transaction(
        'rw',
        [
            db.studysets,
            db.users,
            db.sessions,
            db.cardProgress,
            db.gamification,
            db.customAchievements,
        ],
        async () => {
            if (data.studysets?.length) {
                await db.studysets.bulkPut(data.studysets);
            }
            if (data.users?.length) {
                await db.users.bulkPut(data.users);
            }
            if (data.sessions?.length) {
                await db.sessions.bulkPut(data.sessions);
            }
            if (data.cardProgress?.length) {
                await db.cardProgress.bulkPut(
                    data.cardProgress.map(migrateProgressToFsrs)
                );
            }
            if (data.gamification?.length) {
                await db.gamification.bulkPut(data.gamification);
            }
            if (data.customAchievements?.length) {
                await db.customAchievements.bulkPut(data.customAchievements);
            }
        }
    );
}

// Utility: Get pending sync count
export async function getPendingSyncCount(): Promise<number> {
    const db = getDatabase();
    return await db.syncQueue.count();
}

// Utility: Check if any data needs sync
export async function hasPendingSync(): Promise<boolean> {
    const db = getDatabase();
    const [pendingStudysets, pendingUsers, queueCount] = await Promise.all([
        db.studysets.where('_syncStatus').equals('pending').count(),
        db.users.where('_syncStatus').equals('pending').count(),
        db.syncQueue.count(),
    ]);
    return pendingStudysets > 0 || pendingUsers > 0 || queueCount > 0;
}
