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

// Leaves room for revisit tiles. Counted after the each-set-once rule, so a
// favorite already shown under jump back in doesn't use up a slot.
export const FAVORITE_LIMIT = 2;

// Jump back in is limited by its selector instead, before the each-set-once
// rule. As the first set kind it only loses a slot to a set listed twice in
// the library.
export const FOR_YOU_KIND_LIMIT: Partial<Record<SetTileKind, number>> = {
    favorite: FAVORITE_LIMIT,
};

export const REVISIT_AFTER_DAYS = 30;
export const REVISIT_PREVIEW_COUNT = 2;
export const REVISIT_PREVIEW_CHARS = 80;

// Revisit, the last source, has no limit and fills whatever the others leave,
// so a full grid can load. Loading skeletons use this.
export const FOR_YOU_MAX_TILES = FOR_YOU_CAP.default;

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
        const limit = FOR_YOU_KIND_LIMIT[kind] ?? Infinity;
        let taken = 0;
        for (const studyset of sources[kind] ?? []) {
            if (tiles.length >= cap) return tiles;
            if (taken >= limit) break;
            if (seen.has(studyset.studysetUUID)) continue;
            seen.add(studyset.studysetUUID);
            tiles.push({ kind, studyset });
            taken += 1;
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

// Compares instead of subtracting, because -Infinity - -Infinity is NaN.
const newestFirst = (ta: number, tb: number) => {
    if (ta === tb) return 0;
    return tb > ta ? 1 : -1;
};

const byRecentlyViewed = (a: Studyset, b: Studyset) =>
    newestFirst(viewedAt(a), viewedAt(b));

// Sets with no usable lastViewed sort last instead of being dropped, so a
// library with sets always yields a tile.
export const selectJumpBackIn = (
    studysets: unknown,
    limit = JUMP_BACK_IN_LIMIT
): Studyset[] => {
    if (!Array.isArray(studysets)) return [];
    return studysets
        .filter(isCompleteStudyset)
        .sort(byRecentlyViewed)
        .slice(0, limit);
};

export const selectFavorites = (studysets: unknown): Studyset[] => {
    if (!Array.isArray(studysets)) return [];
    return studysets
        .filter(isCompleteStudyset)
        .filter((studyset) => studyset.favorited === true)
        .sort(byRecentlyViewed);
};

// Study modes don't update lastViewed, so a set's last activity is the later
// of the two. Sets with no usable activity are left out rather than called
// stale on no evidence.
export const selectRevisit = (
    studysets: unknown,
    lastStudiedBySet: ReadonlyMap<string, number>,
    now: Date = new Date()
): Studyset[] => {
    if (!Array.isArray(studysets)) return [];
    const cutoff = now.getTime() - REVISIT_AFTER_DAYS * 86_400_000;
    return studysets
        .filter(isCompleteStudyset)
        .map((studyset) => ({
            studyset,
            activity: Math.max(
                viewedAt(studyset),
                lastStudiedBySet.get(studyset.studysetUUID) ?? -Infinity
            ),
        }))
        .filter(({ activity }) => activity !== -Infinity && activity < cutoff)
        .sort((a, b) => newestFirst(a.activity, b.activity))
        .map(({ studyset }) => studyset);
};

export const hasCompleteStudysets = (studysets: unknown): boolean =>
    Array.isArray(studysets) && studysets.some(isCompleteStudyset);
