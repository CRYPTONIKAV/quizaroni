import {
    fsrs,
    Rating,
    State,
    S_MIN,
    type Card,
    type CardInput,
    type Grade as FsrsGrade,
} from 'ts-fsrs';
import type { CardProgress, SrsState, UUID } from 'shared/types';

export type Grade = 'again' | 'hard' | 'good' | 'easy';

// Grade -> quality (0-5). >=3 is a passing recall.
export const GRADE_QUALITY: Record<Grade, number> = {
    again: 1,
    hard: 3,
    good: 4,
    easy: 5,
};

const GRADE_RATING: Record<Grade, FsrsGrade> = {
    again: Rating.Again,
    hard: Rating.Hard,
    good: Rating.Good,
    easy: Rating.Easy,
};

// Anki's "mature" threshold.
const MASTERED_STABILITY_DAYS = 21;

// No short-term learning steps: the app never re-shows a card in the same
// session, so every grade schedules in whole days.
const scheduler = fsrs({ enable_short_term: false });

const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

const finiteOr = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;

function weight(i: number): number {
    const v = scheduler.parameters.w[i];
    if (v === undefined) throw new Error(`FSRS weight w[${i}] missing`);
    return v;
}

export function gradeFromQuality(quality: number): Grade {
    if (quality < 3) return 'again';
    if (quality === 3) return 'hard';
    if (quality === 4) return 'good';
    return 'easy';
}

export function newProgress(
    cardUUID: UUID,
    now: Date = new Date()
): CardProgress {
    const iso = now.toISOString();
    return {
        cardUUID,
        lastStudied: iso,
        nextReview: iso,
        stability: 0,
        difficulty: 0,
        state: 'New',
        reps: 0,
        lapses: 0,
        scheduledDays: 0,
        learningSteps: 0,
        masteryLevel: 'new',
    };
}

function masteryFor(
    state: SrsState,
    stability: number
): CardProgress['masteryLevel'] {
    if (state === 'New') return 'new';
    if (state === 'Learning' || state === 'Relearning') return 'learning';
    return stability >= MASTERED_STABILITY_DAYS ? 'mastered' : 'review';
}

// Stored rows can hold missing or corrupt timestamps; new Date(null) would
// silently be 1970, so only strings that parse are accepted.
function parseTimestamp(value: unknown): Date | undefined {
    if (typeof value !== 'string') return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

function toFsrsCard(p: CardProgress, now: Date): CardInput {
    const lastStudied = parseTimestamp(p.lastStudied);
    return {
        due: parseTimestamp(p.nextReview) ?? now,
        stability: p.stability,
        difficulty: p.difficulty,
        elapsed_days: 0,
        scheduled_days: p.scheduledDays,
        learning_steps: p.learningSteps,
        reps: p.reps,
        lapses: p.lapses,
        state: p.state,
        // ts-fsrs throws on a negative elapsed time (e.g. after a device
        // clock rollback) and on invalid dates; projectInterval runs during
        // render.
        last_review:
            p.state === 'New'
                ? undefined
                : !lastStudied || lastStudied > now
                  ? now
                  : lastStudied,
    };
}

function fromFsrsCard(prev: CardProgress, card: Card, now: Date): CardProgress {
    const state = State[card.state] as SrsState;
    return {
        ...prev,
        lastStudied: now.toISOString(),
        nextReview: card.due.toISOString(),
        stability: card.stability,
        difficulty: card.difficulty,
        state,
        reps: card.reps,
        lapses: card.lapses,
        scheduledDays: card.scheduled_days,
        learningSteps: card.learning_steps,
        masteryLevel: masteryFor(state, card.stability),
    };
}

// Pure FSRS step. Returns a new CardProgress; does not mutate `prev`.
export function reviewCard(
    prev: CardProgress,
    grade: Grade,
    now: Date = new Date()
): CardProgress {
    // A tab still running pre-FSRS code can write SM-2 rows after the
    // Dexie v5 upgrade, so normalise here too.
    const p = migrateProgressToFsrs(prev);
    const { card } = scheduler.next(
        toFsrsCard(p, now),
        now,
        GRADE_RATING[grade]
    );
    return fromFsrsCard(p, card, now);
}

// Interval (days) a given grade would yield, without side effects.
export function projectInterval(prev: CardProgress, grade: Grade): number {
    return reviewCard(prev, grade).scheduledDays;
}

export type LegacySm2Progress = Pick<
    CardProgress,
    'cardUUID' | 'lastStudied' | 'nextReview'
> & {
    easeFactor?: number;
    interval?: number;
    repetitions?: number;
    masteryLevel?: CardProgress['masteryLevel'];
};

type Migrated<T> = Omit<T, 'easeFactor' | 'interval' | 'repetitions'> &
    CardProgress;

// Converts a stored SM-2 row to FSRS state, keeping its due date.
// Idempotent: FSRS rows come back unchanged apart from stray SM-2 keys.
export function migrateProgressToFsrs<
    T extends LegacySm2Progress | CardProgress,
>(row: T): Migrated<T> {
    const { easeFactor, interval, repetitions, ...rest } =
        row as LegacySm2Progress & Partial<CardProgress>;
    if (typeof rest.stability === 'number') return rest as Migrated<T>;

    const ease = finiteOr(easeFactor, 2.5);
    const ivl = finiteOr(interval, 0);
    const reps = finiteOr(repetitions, 0);

    if (ivl <= 0 && reps <= 0) {
        return {
            ...rest,
            stability: 0,
            difficulty: 0,
            state: 'New',
            reps: 0,
            lapses: 0,
            scheduledDays: 0,
            learningSteps: 0,
            masteryLevel: 'new',
        } as Migrated<T>;
    }

    // fsrs-rs memory_state_from_sm2 with sm2_retention 0.9, which makes
    // stability equal to the SM-2 interval.
    const stability = Math.max(ivl, S_MIN);
    const difficulty = clamp(
        11 -
            (ease - 1) /
                (Math.exp(weight(8)) *
                    stability ** -weight(9) *
                    Math.expm1(0.1 * weight(10))),
        1,
        10
    );
    return {
        ...rest,
        stability,
        difficulty,
        state: 'Review',
        reps,
        lapses: 0,
        scheduledDays: ivl,
        learningSteps: 0,
        masteryLevel: masteryFor('Review', stability),
    } as Migrated<T>;
}

export function isDue(progress: CardProgress, now: Date = new Date()): boolean {
    return new Date(progress.nextReview).getTime() <= now.getTime();
}

export function sortByNextReview(list: CardProgress[]): CardProgress[] {
    return [...list].sort(
        (a, b) =>
            new Date(a.nextReview).getTime() - new Date(b.nextReview).getTime()
    );
}
