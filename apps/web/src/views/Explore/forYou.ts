import { Studyset } from 'shared/types';
import { isCompleteStudyset } from 'state/api/studysetsAPI';

export type ForYouKind = 'due' | 'jumpBackIn' | 'favorite' | 'revisit';

export const FOR_YOU_PRIORITY: readonly ForYouKind[] = [
    'due',
    'jumpBackIn',
    'favorite',
    'revisit',
];

export const FOR_YOU_CAP = { default: 6, xs: 3 } as const;

// Leaves room for favorite and revisit tiles, which rank below jump back in.
export const JUMP_BACK_IN_LIMIT = 3;

// The most tiles the current sources can produce. Raise it when a source is
// added, so loading skeletons match what loads.
export const FOR_YOU_MAX_TILES = JUMP_BACK_IN_LIMIT;

export type ForYouTileData = { kind: ForYouKind; studyset: Studyset };

export type ForYouSources = Partial<Record<ForYouKind, readonly Studyset[]>>;

export const composeForYou = (
    sources: ForYouSources,
    cap: number
): ForYouTileData[] => {
    const tiles: ForYouTileData[] = [];
    const seen = new Set<string>();
    for (const kind of FOR_YOU_PRIORITY) {
        for (const studyset of sources[kind] ?? []) {
            if (tiles.length >= cap) return tiles;
            if (seen.has(studyset.studysetUUID)) continue;
            seen.add(studyset.studysetUUID);
            tiles.push({ kind, studyset });
        }
    }
    return tiles;
};

const viewedAt = (studyset: Studyset) => {
    const time =
        typeof studyset.lastViewed === 'string'
            ? Date.parse(studyset.lastViewed)
            : NaN;
    return Number.isFinite(time) ? time : -Infinity;
};

// Sets with no usable lastViewed sort last instead of being dropped, so a
// library with sets always yields a tile. Compares instead of subtracting,
// because -Infinity - -Infinity is NaN.
export const selectJumpBackIn = (
    studysets: unknown,
    limit = JUMP_BACK_IN_LIMIT
): Studyset[] => {
    if (!Array.isArray(studysets)) return [];
    return studysets
        .filter(isCompleteStudyset)
        .sort((a, b) => {
            const ta = viewedAt(a);
            const tb = viewedAt(b);
            if (ta === tb) return 0;
            return tb > ta ? 1 : -1;
        })
        .slice(0, limit);
};

export const hasCompleteStudysets = (studysets: unknown): boolean =>
    Array.isArray(studysets) && studysets.some(isCompleteStudyset);
