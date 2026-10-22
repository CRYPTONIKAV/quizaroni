import { describe, it, expect } from 'vite-plus/test';
import { Studyset } from 'shared/types';
import {
    composeForYou,
    DueSummary,
    forYouTileKey,
    hasCompleteStudysets,
    REVISIT_AFTER_DAYS,
    selectFavorites,
    selectJumpBackIn,
    selectRevisit,
    summarizeDue,
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
    const due: DueSummary = { cardCount: 4, setCount: 2, studysetUUID: 'a' };
    const streak = { days: 3, atRisk: false };

    it('orders tiles by priority regardless of source order', () => {
        const tiles = composeForYou(
            {
                favorite: [makeSet('f')],
                jumpBackIn: [makeSet('j')],
                streak,
                due,
            },
            6
        );
        expect(tiles.map((t) => t.kind)).toEqual([
            'due',
            'streak',
            'jumpBackIn',
            'favorite',
        ]);
    });

    it('shows each set once, under its highest-priority source', () => {
        const shared = makeSet('a');
        const tiles = composeForYou(
            { favorite: [shared], jumpBackIn: [shared] },
            6
        );
        expect(tiles).toEqual([{ kind: 'jumpBackIn', studyset: shared }]);
    });

    it("doesn't let the due tile claim the set it reviews", () => {
        const tiles = composeForYou({ due, jumpBackIn: [makeSet('a')] }, 6);
        expect(tiles.map(forYouTileKey)).toEqual(['due', 'a']);
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
                due,
                streak,
                jumpBackIn: ['j1', 'j2', 'j3', 'j4', 'j5'].map((id) =>
                    makeSet(id)
                ),
            },
            6
        );
        expect(tiles.map(forYouTileKey)).toEqual([
            'due',
            'streak',
            'j1',
            'j2',
            'j3',
            'j4',
        ]);
    });

    it('skips a missing due summary and a missing or 0-day streak', () => {
        const j = makeSet('j');
        expect(
            composeForYou({ due: null, streak: null, jumpBackIn: [j] }, 6)
        ).toEqual([{ kind: 'jumpBackIn', studyset: j }]);
        expect(
            composeForYou(
                { streak: { days: 0, atRisk: false }, jumpBackIn: [j] },
                6
            )
        ).toEqual([{ kind: 'jumpBackIn', studyset: j }]);
    });

    it("keeps each source's own order", () => {
        const tiles = composeForYou(
            { jumpBackIn: [makeSet('z'), makeSet('a'), makeSet('m')] },
            6
        );
        expect(tiles.map(forYouTileKey)).toEqual(['z', 'a', 'm']);
    });

    it('returns [] for empty sources or cap 0', () => {
        expect(composeForYou({}, 6)).toEqual([]);
        expect(composeForYou({ jumpBackIn: [] }, 6)).toEqual([]);
        expect(composeForYou({ jumpBackIn: [makeSet('a')] }, 0)).toEqual([]);
        expect(composeForYou({ due, streak }, 0)).toEqual([]);
    });

    it('orders all five sources by priority', () => {
        const tiles = composeForYou(
            {
                revisit: [makeSet('r')],
                favorite: [makeSet('f')],
                jumpBackIn: [makeSet('j')],
                streak,
                due,
            },
            6
        );
        expect(tiles.map((t) => t.kind)).toEqual([
            'due',
            'streak',
            'jumpBackIn',
            'favorite',
            'revisit',
        ]);
    });

    it('shows each set once across jump back in, favorite and revisit', () => {
        const a = makeSet('a');
        const b = makeSet('b');
        const tiles = composeForYou(
            { jumpBackIn: [a], favorite: [a, b], revisit: [a, b] },
            6
        );
        expect(tiles).toEqual([
            { kind: 'jumpBackIn', studyset: a },
            { kind: 'favorite', studyset: b },
        ]);
    });

    it('counts the favorite limit after the each-set-once rule', () => {
        const tiles = composeForYou(
            {
                jumpBackIn: [makeSet('j1')],
                favorite: ['j1', 'f1', 'f2', 'f3'].map((id) => makeSet(id)),
                revisit: [makeSet('r1')],
            },
            6
        );
        expect(tiles.map(forYouTileKey)).toEqual(['j1', 'f1', 'f2', 'r1']);
    });

    it('holds the cap across all sources', () => {
        const sources = {
            due,
            streak,
            jumpBackIn: ['j1', 'j2', 'j3'].map((id) => makeSet(id)),
            favorite: ['f1', 'f2'].map((id) => makeSet(id)),
            revisit: ['r1', 'r2'].map((id) => makeSet(id)),
        };
        expect(composeForYou(sources, 6).map(forYouTileKey)).toEqual([
            'due',
            'streak',
            'j1',
            'j2',
            'j3',
            'f1',
        ]);
        expect(composeForYou(sources, 3).map(forYouTileKey)).toEqual([
            'due',
            'streak',
            'j1',
        ]);
        expect(
            composeForYou({ ...sources, due: null, streak: null }, 6).map(
                forYouTileKey
            )
        ).toEqual(['j1', 'j2', 'j3', 'f1', 'f2', 'r1']);
    });
});

describe('summarizeDue', () => {
    it('returns null when nothing is due', () => {
        expect(summarizeDue(new Map())).toBeNull();
        expect(summarizeDue(new Map([['A', 0]]))).toBeNull();
    });

    it('totals cards and sets and targets the set with the most due', () => {
        expect(
            summarizeDue(
                new Map([
                    ['A', 2],
                    ['B', 5],
                ])
            )
        ).toEqual({ cardCount: 7, setCount: 2, studysetUUID: 'B' });
    });

    it('breaks ties in favour of the earlier set', () => {
        expect(
            summarizeDue(
                new Map([
                    ['A', 3],
                    ['B', 3],
                ])
            )?.studysetUUID
        ).toBe('A');
    });
});

describe('forYouTileKey', () => {
    it('keys aggregate tiles by kind and set tiles by set', () => {
        expect(
            forYouTileKey({
                kind: 'due',
                due: { cardCount: 1, setCount: 1, studysetUUID: 'a' },
            })
        ).toBe('due');
        expect(
            forYouTileKey({
                kind: 'streak',
                streak: { days: 2, atRisk: true },
            })
        ).toBe('streak');
        expect(
            forYouTileKey({ kind: 'jumpBackIn', studyset: makeSet('a') })
        ).toBe('a');
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

describe('selectFavorites', () => {
    it('keeps only favorited sets, most recently viewed first', () => {
        const sets = [
            makeSet('old', {
                favorited: true,
                lastViewed: '2026-01-01T00:00:00.000Z',
            }),
            makeSet('plain'),
            makeSet('unset', { favorited: undefined }),
            makeSet('truthy', { favorited: 'yes' as unknown as boolean }),
            makeSet('new', {
                favorited: true,
                lastViewed: '2026-10-01T00:00:00.000Z',
            }),
        ];
        expect(ids(selectFavorites(sets))).toEqual(['new', 'old']);
    });

    it('skips stubs and returns [] for non-array input', () => {
        expect(selectFavorites([{ ...stub, favorited: true }, null])).toEqual(
            []
        );
        expect(selectFavorites(undefined)).toEqual([]);
    });
});

describe('selectRevisit', () => {
    const NOW = new Date('2026-10-18T12:00:00.000Z');
    const DAY = 86_400_000;
    const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
    const studied = (entries: [string, number][]) =>
        new Map(entries.map(([id, ms]) => [id, NOW.getTime() - ms]));
    const viewed = (id: string, ms: number) =>
        makeSet(id, { lastViewed: ago(ms) });

    it('includes a set viewed 31 days ago and never studied', () => {
        expect(
            ids(selectRevisit([viewed('a', 31 * DAY)], new Map(), NOW))
        ).toEqual(['a']);
    });

    it('leaves out a set viewed long ago but studied recently', () => {
        const sets = [viewed('a', 31 * DAY)];
        expect(selectRevisit(sets, studied([['a', 2 * DAY]]), NOW)).toEqual([]);
    });

    it('leaves out a set studied long ago but viewed recently', () => {
        const sets = [viewed('a', 2 * DAY)];
        expect(selectRevisit(sets, studied([['a', 40 * DAY]]), NOW)).toEqual(
            []
        );
    });

    it('needs strictly more than 30 days', () => {
        const days = REVISIT_AFTER_DAYS * DAY;
        const sets = [viewed('exact', days), viewed('past', days + 1)];
        expect(ids(selectRevisit(sets, new Map(), NOW))).toEqual(['past']);
    });

    it('leaves out sets with no usable activity', () => {
        const sets = [
            makeSet('none', { lastViewed: undefined }),
            makeSet('bad', { lastViewed: 'not-a-date' }),
            makeSet('studied', { lastViewed: undefined }),
        ];
        expect(
            ids(selectRevisit(sets, studied([['studied', 40 * DAY]]), NOW))
        ).toEqual(['studied']);
    });

    it('orders by most recent activity first', () => {
        const sets = [
            viewed('d35', 35 * DAY),
            viewed('d60', 60 * DAY),
            viewed('d45', 45 * DAY),
        ];
        expect(ids(selectRevisit(sets, new Map(), NOW))).toEqual([
            'd35',
            'd45',
            'd60',
        ]);
    });

    it('ignores progress for sets not in the list', () => {
        expect(selectRevisit([], studied([['gone', 40 * DAY]]), NOW)).toEqual(
            []
        );
    });

    it('skips stubs and returns [] for non-array input', () => {
        expect(
            selectRevisit(
                [{ ...stub, lastViewed: ago(40 * DAY) }],
                new Map(),
                NOW
            )
        ).toEqual([]);
        expect(selectRevisit(undefined, new Map(), NOW)).toEqual([]);
    });
});
