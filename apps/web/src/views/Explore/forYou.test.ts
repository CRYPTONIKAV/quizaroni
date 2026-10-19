import { describe, it, expect } from 'vite-plus/test';
import { Studyset } from 'shared/types';
import {
    composeForYou,
    hasCompleteStudysets,
    selectJumpBackIn,
} from './forYou';

const makeSet = (id: string, overrides: Partial<Studyset> = {}): Studyset =>
    ({
        studysetUUID: id,
        uuid: id,
        title: `Set ${id}`,
        description: '',
        cards: [],
        lastViewed: '2026-10-01T12:00:00.000Z',
        ...overrides,
    }) as Studyset;

const stub = {
    lastViewed: '2026-10-02T12:00:00.000Z',
    updatedAt: '2026-10-02T12:00:00.000Z',
    updatedBy: 'owner',
};

const ids = (sets: { studysetUUID: string }[]) =>
    sets.map((s) => s.studysetUUID);

describe('composeForYou', () => {
    it('orders tiles by priority regardless of source order', () => {
        const tiles = composeForYou(
            {
                favorite: [makeSet('f')],
                jumpBackIn: [makeSet('j')],
                due: [makeSet('d')],
            },
            6
        );
        expect(tiles.map((t) => t.kind)).toEqual([
            'due',
            'jumpBackIn',
            'favorite',
        ]);
    });

    it('shows each set once, under its highest-priority source', () => {
        const shared = makeSet('a');
        const tiles = composeForYou({ jumpBackIn: [shared], due: [shared] }, 6);
        expect(tiles).toEqual([{ kind: 'due', studyset: shared }]);
    });

    it('caps the total at 6 and at 3', () => {
        const many = ['1', '2', '3', '4', '5', '6', '7'].map((id) =>
            makeSet(id)
        );
        expect(composeForYou({ jumpBackIn: many }, 6)).toHaveLength(6);
        expect(composeForYou({ jumpBackIn: many }, 3)).toHaveLength(3);
    });

    it('fills the cap across sources', () => {
        const tiles = composeForYou(
            {
                due: [makeSet('d1'), makeSet('d2')],
                jumpBackIn: ['j1', 'j2', 'j3', 'j4', 'j5'].map((id) =>
                    makeSet(id)
                ),
            },
            6
        );
        expect(tiles.map((t) => t.studyset.studysetUUID)).toEqual([
            'd1',
            'd2',
            'j1',
            'j2',
            'j3',
            'j4',
        ]);
    });

    it("keeps each source's own order", () => {
        const tiles = composeForYou(
            { jumpBackIn: [makeSet('z'), makeSet('a'), makeSet('m')] },
            6
        );
        expect(tiles.map((t) => t.studyset.studysetUUID)).toEqual([
            'z',
            'a',
            'm',
        ]);
    });

    it('returns [] for empty sources or cap 0', () => {
        expect(composeForYou({}, 6)).toEqual([]);
        expect(composeForYou({ jumpBackIn: [] }, 6)).toEqual([]);
        expect(composeForYou({ jumpBackIn: [makeSet('a')] }, 0)).toEqual([]);
    });
});

describe('selectJumpBackIn', () => {
    it('sorts by most recent lastViewed', () => {
        const sets = [
            makeSet('old', { lastViewed: '2026-01-01T00:00:00.000Z' }),
            makeSet('new', { lastViewed: '2026-10-01T00:00:00.000Z' }),
            makeSet('mid', { lastViewed: '2026-05-01T00:00:00.000Z' }),
        ];
        expect(ids(selectJumpBackIn(sets))).toEqual(['new', 'mid', 'old']);
    });

    it('skips items without cards', () => {
        const sets = [stub, null, 'not a set', makeSet('ok')];
        expect(ids(selectJumpBackIn(sets))).toEqual(['ok']);
    });

    it('sorts sets whose lastViewed is not a date last, keeping them', () => {
        const sets = [
            makeSet('bad', { lastViewed: 'not-a-date' }),
            makeSet('older', { lastViewed: '2026-01-01T00:00:00.000Z' }),
            makeSet('missing', { lastViewed: undefined }),
            makeSet('newer', { lastViewed: '2026-10-01T00:00:00.000Z' }),
        ];
        expect(ids(selectJumpBackIn(sets, 10))).toEqual([
            'newer',
            'older',
            'bad',
            'missing',
        ]);
    });

    it('does not mutate its input', () => {
        const sets = [
            makeSet('old', { lastViewed: '2026-01-01T00:00:00.000Z' }),
            makeSet('new', { lastViewed: '2026-10-01T00:00:00.000Z' }),
        ];
        selectJumpBackIn(sets);
        expect(ids(sets)).toEqual(['old', 'new']);
    });

    it('returns at most `limit` sets', () => {
        const sets = ['1', '2', '3', '4', '5'].map((id) => makeSet(id));
        expect(selectJumpBackIn(sets)).toHaveLength(3);
        expect(selectJumpBackIn(sets, 2)).toHaveLength(2);
    });

    it('returns [] for non-array input', () => {
        expect(selectJumpBackIn(undefined)).toEqual([]);
        expect(selectJumpBackIn({})).toEqual([]);
    });
});

describe('hasCompleteStudysets', () => {
    it('is true when one valid set sits among stubs', () => {
        expect(hasCompleteStudysets([stub, makeSet('a'), null])).toBe(true);
    });

    it('is false for empty lists, stubs only, or no data', () => {
        expect(hasCompleteStudysets([])).toBe(false);
        expect(hasCompleteStudysets([stub, null])).toBe(false);
        expect(hasCompleteStudysets(undefined)).toBe(false);
    });
});
