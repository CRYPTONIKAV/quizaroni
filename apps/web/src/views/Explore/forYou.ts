import { Studyset } from 'shared/types';
import type { EffectiveStreak } from 'shared/utilities/gamification';
import { isCompleteStudyset } from 'state/api/studysetsAPI';

export type SetTileKind = 'jumpBackIn' | 'favorite' | 'revisit';
export type ForYouKind = 'due' | 'streak' | SetTileKind;

export const FOR_YOU_PRIORITY: readonly ForYouKind[] = [
    'due',
    'streak',
    'jumpBackIn',
    'favorite',
    'revisit',
];

export const FOR_YOU_CAP = { default: 6, xs: 3 } as const;

// Leaves room for favorite and revisit tiles, which rank below jump back in.
export const JUMP_BACK_IN_LIMIT = 3;

// The most tiles the current sources can produce: one due tile, one streak
// tile and the jump-back-in sets. Raise it when a source is added, so loading
// skeletons match what loads.
export const FOR_YOU_MAX_TILES = 2 + JUMP_BACK_IN_LIMIT;

// studysetUUID is the set the Review button opens.
export type DueSummary = {
    cardCount: number;
    setCount: number;
    studysetUUID: string;
};

export type ForYouTileData =
    | { kind: 'due'; due: DueSummary }
    | { kind: 'streak'; streak: EffectiveStreak }
    | { kind: SetTileKind; studyset: Studyset };

export type ForYouSources = Partial<
    Record<SetTileKind, readonly Studyset[]>
> & {
    due?: DueSummary | null;
    streak?: EffectiveStreak | null;
};

// The due and streak tiles aren't about one set, so they don't take part in
// the each-set-once rule, but they do count toward the cap.
export const composeForYou = (
    sources: ForYouSources,
    cap: number
): ForYouTileData[] => {
    const tiles: ForYouTileData[] = [];
    const seen = new Set<string>();
    for (const kind of FOR_YOU_PRIORITY) {
        if (tiles.length >= cap) return tiles;
        if (kind === 'due') {
            if (sources.due) tiles.push({ kind, due: sources.due });
            continue;
        }
        if (kind === 'streak') {
            if (sources.streak && sources.streak.days > 0) {
                tiles.push({ kind, streak: sources.streak });
            }
            continue;
        }
        for (const studyset of sources[kind] ?? []) {
            if (tiles.length >= cap) return tiles;
            if (seen.has(studyset.studysetUUID)) continue;
            seen.add(studyset.studysetUUID);
            tiles.push({ kind, studyset });
        }
    }
    return tiles;
};

// Ties go to the earlier set, which getDueCountsBySet orders by most overdue.
export const summarizeDue = (
    counts: ReadonlyMap<string, number>
): DueSummary | null => {
    let cardCount = 0;
    let setCount = 0;
    let studysetUUID = '';
    let most = 0;
    for (const [uuid, count] of counts) {
        if (count <= 0) continue;
        cardCount += count;
        setCount += 1;
        if (count > most) {
            most = count;
            studysetUUID = uuid;
        }
    }
    return cardCount > 0 ? { cardCount, setCount, studysetUUID } : null;
};

export const forYouTileKey = (tile: ForYouTileData): string =>
    tile.kind === 'due' || tile.kind === 'streak'
        ? tile.kind
        : tile.studyset.studysetUUID;

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
