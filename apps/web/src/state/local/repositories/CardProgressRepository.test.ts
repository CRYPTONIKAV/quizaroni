import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import { getDatabase, resetDatabase, type LocalCardProgress } from '../db';
import { CardProgressRepository } from './CardProgressRepository';
import { newProgress } from 'shared/utilities/srs';

type LibrarySet = Parameters<
    CardProgressRepository['getDueCountsBySet']
>[0][number];

const now = new Date('2026-10-18T12:00:00.000Z');
const PAST = '2026-10-10T00:00:00.000Z';
const OLDER = '2026-10-01T00:00:00.000Z';
const FUTURE = '2026-10-25T00:00:00.000Z';

const row = (
    cardUUID: string,
    studysetUUID: string,
    nextReview: string
): LocalCardProgress => ({
    ...newProgress(cardUUID),
    nextReview,
    studysetUUID,
    _syncStatus: 'pending',
    _lastModified: 1,
});

const set = (studysetUUID: string, cards: unknown[]): LibrarySet =>
    ({ studysetUUID, cards }) as unknown as LibrarySet;

const cardsOf = (...ids: string[]) => ids.map((cardUUID) => ({ cardUUID }));

const seed = (rows: LocalCardProgress[]) =>
    getDatabase().cardProgress.bulkPut(rows);

describe('CardProgressRepository.getDueCountsBySet', () => {
    let repo: CardProgressRepository;

    beforeEach(() => {
        repo = new CardProgressRepository();
    });

    afterEach(async () => {
        await resetDatabase();
    });

    it('counts due cards per set, including cards due exactly now', async () => {
        await seed([
            row('a1', 'A', PAST),
            row('a2', 'A', now.toISOString()),
            row('a3', 'A', FUTURE),
            row('b1', 'B', PAST),
        ]);
        const counts = await repo.getDueCountsBySet(
            [set('A', cardsOf('a1', 'a2', 'a3')), set('B', cardsOf('b1'))],
            now
        );
        expect(Object.fromEntries(counts)).toEqual({ A: 2, B: 1 });
    });

    it('ignores progress rows for sets that are no longer in the library', async () => {
        await seed([
            row('a1', 'A', PAST),
            row('g1', 'gone', PAST),
            row('l1', '', PAST),
        ]);
        const counts = await repo.getDueCountsBySet(
            [set('A', cardsOf('a1'))],
            now
        );
        expect(Object.fromEntries(counts)).toEqual({ A: 1 });
    });

    it('ignores progress rows for cards deleted from a set', async () => {
        await seed([row('a1', 'A', PAST), row('x9', 'A', PAST)]);
        const counts = await repo.getDueCountsBySet(
            [set('A', cardsOf('a1'))],
            now
        );
        expect(Object.fromEntries(counts)).toEqual({ A: 1 });
    });

    it('orders sets by their most overdue card', async () => {
        await seed([row('a1', 'A', PAST), row('b1', 'B', OLDER)]);
        const counts = await repo.getDueCountsBySet(
            [set('A', cardsOf('a1')), set('B', cardsOf('b1'))],
            now
        );
        expect([...counts.keys()]).toEqual(['B', 'A']);
    });

    it('returns an empty map when nothing is due or there are no sets', async () => {
        await seed([row('a1', 'A', FUTURE)]);
        expect(
            (await repo.getDueCountsBySet([set('A', cardsOf('a1'))], now)).size
        ).toBe(0);
        await seed([row('a2', 'A', PAST)]);
        expect((await repo.getDueCountsBySet([], now)).size).toBe(0);
    });

    it('skips malformed cards instead of throwing', async () => {
        await seed([row('a1', 'A', PAST)]);
        const counts = await repo.getDueCountsBySet(
            [set('A', [null, { cardUUID: 'a1' }, {}])],
            now
        );
        expect(Object.fromEntries(counts)).toEqual({ A: 1 });
    });
});

describe('CardProgressRepository.getLastStudiedBySet', () => {
    let repo: CardProgressRepository;

    beforeEach(() => {
        repo = new CardProgressRepository();
    });

    afterEach(async () => {
        await resetDatabase();
    });

    const studied = (
        cardUUID: string,
        studysetUUID: string,
        lastStudied: string
    ): LocalCardProgress => ({
        ...row(cardUUID, studysetUUID, PAST),
        lastStudied,
    });

    it('returns the latest study time per set', async () => {
        await seed([
            studied('a1', 'A', OLDER),
            studied('a2', 'A', PAST),
            studied('b1', 'B', OLDER),
        ]);
        expect(Object.fromEntries(await repo.getLastStudiedBySet())).toEqual({
            A: Date.parse(PAST),
            B: Date.parse(OLDER),
        });
    });

    it('skips legacy rows with no set and unparsable times', async () => {
        await seed([
            studied('l1', '', PAST),
            studied('a1', 'A', 'not-a-date'),
            studied('b1', 'B', 'not-a-date'),
            studied('b2', 'B', OLDER),
        ]);
        expect(Object.fromEntries(await repo.getLastStudiedBySet())).toEqual({
            B: Date.parse(OLDER),
        });
    });

    it('returns an empty map when nothing has been studied', async () => {
        expect((await repo.getLastStudiedBySet()).size).toBe(0);
    });
});
