import { randomUUID } from 'crypto';
import type { Studyset, Timestamp, UUID } from 'models/studysets';

/**
 * Builds a new private set from a stored one. Top-level fields are picked
 * from an explicit allowlist, never spread, so publication and ownership
 * state (PK2..SK6 index keys, favorited, updatedBy, and server-owned fields
 * such as subject, publishedAt, featuredAt, saveCount) never carries over to
 * the copy (#125).
 *
 * A takedown does carry over: a copy of a hidden set keeps its `moderation`,
 * so publish refuses the copy too (#169).
 *
 * Card files are copied verbatim, still pointing at the source's S3 objects;
 * callers must re-key them with `copyCardFiles` before storing the copy (#126).
 */
export const buildDuplicate = (
    source: Studyset,
    newUUID: UUID,
    now: Timestamp
): Studyset => {
    const {
        PK,
        cards,
        categories,
        description,
        labels,
        metadata,
        moderation,
        title,
        userUUID,
        username,
    } = structuredClone(source);

    return {
        PK,
        SK: `studyset#${newUUID}`,
        studysetUUID: newUUID,
        userUUID,
        username,
        title: `${title} Copy`,
        description,
        categories: categories ?? [],
        labels: labels ?? [],
        cards: (cards ?? []).map((card) => ({
            ...card,
            cardUUID: randomUUID(),
            notes: (card.notes ?? []).map((note) => ({
                ...note,
                noteUUID: randomUUID(),
            })),
        })),
        metadata: { ...metadata, publiclyViewable: false },
        favorited: false,
        createdAt: now,
        updatedAt: now,
        lastViewed: now,
        ...(moderation?.hiddenAt ? { moderation } : {}),
    };
};
