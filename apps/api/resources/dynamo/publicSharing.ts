/**
 * Public-sharing access pattern.
 *
 * Public study sets are exposed to unauthenticated readers via the otherwise
 * unused `PK2` global secondary index. A set is indexed there *only while it is
 * public*:
 *
 *   PK2 = "publicStudyset"            (constant partition — all public sets)
 *   SK2 = "studyset#<studysetUUID>"   (sort key — the set's own id)
 *
 * Not strictly one row per SK2: duplicates made before #125 kept their
 * source's SK2 (#171). Never take `Items[0]`; readers keep only the set's own
 * row (`isOwnIndexRow`, part of `isPubliclyListed`).
 *
 * This yields two access patterns from one key design:
 *   - fetch one public set by id:  Query PK2 = PUBLIC_STUDYSET_PK  AND SK2 = publicStudysetSK(id)
 *   - list every public set:       Query PK2 = PUBLIC_STUDYSET_PK
 *
 * PK2/SK2 are written only by the `publish-studyset` / `unpublish-studyset`
 * lambdas and the `scripts/unpublishStudyset.ts` takedown (plus the legacy
 * one-off `scripts/backfillPublicGsi.ts`); `update-studyset` strips them.
 * Readers apply `isPubliclyListed` on every row.
 */
export const PUBLIC_STUDYSET_PK = 'publicStudyset';

export const publicStudysetSK = (studysetUUID: string): string =>
    `studyset#${studysetUUID}`;

export const PUBLIC_GSI_INDEX_NAME = 'PK2';

type PublicIndexItem = {
    SK?: unknown;
    SK2?: unknown;
    metadata?: { publiclyViewable?: unknown };
    moderation?: { hiddenAt?: unknown };
};

export const isHidden = (item: PublicIndexItem | undefined): boolean =>
    !!item?.moderation?.hiddenAt;

// Writers derive SK2 from the set's own id, so SK2 equals the row's own SK
// (`studyset#<id>`). Duplicates made before #125 kept their source's SK2;
// such a row must never be served under the source's id (#171).
export const isOwnIndexRow = (item: PublicIndexItem | undefined): boolean =>
    typeof item?.SK === 'string' && item.SK === item.SK2;

// The one rule both public read paths apply, so the sitemap never lists a URL
// the set endpoint would 404.
export const isPubliclyListed = (item: PublicIndexItem | undefined): boolean =>
    isOwnIndexRow(item) && item?.metadata?.publiclyViewable === true && !isHidden(item);
