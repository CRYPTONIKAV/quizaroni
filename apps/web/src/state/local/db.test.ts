import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { getDatabase, resetDatabase } from './db';
import { newProgress } from 'shared/utilities/srs';

// Schema and SM-2 rows as stored before the FSRS migration.
async function seedV4(): Promise<void> {
    const v4 = new Dexie('quizaroni_v1');
    v4.version(4).stores({
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
    await v4.table('cardProgress').bulkPut([
        {
            cardUUID: 'c1',
            studysetUUID: 's1',
            easeFactor: 2.5,
            interval: 6,
            repetitions: 2,
            lastStudied: '2026-01-01T00:00:00.000Z',
            nextReview: '2026-01-07T00:00:00.000Z',
            masteryLevel: 'learning',
            _syncStatus: 'pending',
            _lastModified: 1,
        },
        {
            cardUUID: 'c2',
            studysetUUID: 's2',
            easeFactor: 1.3,
            interval: 1,
            repetitions: 0,
            lastStudied: '2026-01-01T00:00:00.000Z',
            nextReview: '2026-01-02T00:00:00.000Z',
            masteryLevel: 'learning',
            _syncStatus: 'pending',
            _lastModified: 1,
        },
    ]);
    v4.close();
}

afterEach(resetDatabase);

describe('Dexie v5 FSRS migration', () => {
    it('converts SM-2 card progress from a v4 database', async () => {
        await seedV4();
        const db = getDatabase();
        await db.open();
        expect(db.verno).toBe(5);

        const c1 = await db.cardProgress.get('c1');
        const c2 = await db.cardProgress.get('c2');
        expect(c1).toMatchObject({
            state: 'Review',
            stability: 6,
            nextReview: '2026-01-07T00:00:00.000Z',
            studysetUUID: 's1',
            _syncStatus: 'pending',
        });
        expect(c1!.difficulty).toBeCloseTo(7.2474, 3);
        expect(c1).not.toHaveProperty('easeFactor');
        expect(c2).toMatchObject({
            state: 'Review',
            stability: 1,
            difficulty: 10,
            nextReview: '2026-01-02T00:00:00.000Z',
        });
    });

    it('keeps the studyset due-date index working', async () => {
        await seedV4();
        const db = getDatabase();
        await db.open();
        const due = await db.cardProgress
            .where('[studysetUUID+nextReview]')
            .between(['s1', ''], ['s1', '2026-01-08T00:00:00.000Z'], true, true)
            .toArray();
        expect(due.map((p) => p.cardUUID)).toEqual(['c1']);
    });

    it('opens a fresh install at v5', async () => {
        const db = getDatabase();
        await db.open();
        expect(db.verno).toBe(5);
        expect(await db.cardProgress.count()).toBe(0);

        const row = {
            ...newProgress('x'),
            studysetUUID: 's1',
            _syncStatus: 'pending' as const,
            _lastModified: 1,
        };
        await db.cardProgress.put(row);
        expect(await db.cardProgress.get('x')).toEqual(row);
    });
});
