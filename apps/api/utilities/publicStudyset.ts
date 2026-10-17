import type { CardFileMetadata, Studyset, Timestamp } from 'models/studysets';

export type PublicCardFile = Pick<CardFileMetadata, 'association' | 'signedURL'>;

export type PublicCard = {
    term: string;
    definition: string;
    files: PublicCardFile[];
};

export type PublicStudyset = {
    title: string;
    description: string;
    username: string | null;
    subject: string | null;
    publishedAt: Timestamp | null;
    updatedAt: Timestamp | null;
    cards: PublicCard[];
};

// subject/publishedAt arrive with publishing (#132); older records may predate
// updatedAt.
export type PublicStudysetSource = Omit<Studyset, 'updatedAt'> & {
    updatedAt?: Timestamp;
    subject?: string;
    publishedAt?: Timestamp;
};

/**
 * Builds the unauthenticated public response from an explicit allowlist.
 * Each object is constructed field by field, never spread, so anything new on
 * the stored record (notes, labels, owner ids, storage keys) stays private
 * unless it is added here on purpose.
 */
export const toPublicStudyset = (item: PublicStudysetSource): PublicStudyset => ({
    title: item.title ?? '',
    description: item.description ?? '',
    username: item.username || null,
    subject: item.subject ?? null,
    publishedAt: item.publishedAt ?? null,
    updatedAt: item.updatedAt ?? null,
    cards: (item.cards ?? []).map((card) => ({
        term: card.term ?? '',
        definition: card.definition ?? '',
        files: (card.files ?? [])
            .filter(
                (file) =>
                    !!file.signedURL &&
                    (file.association === 'term' ||
                        file.association === 'definition')
            )
            .map(({ association, signedURL }) => ({ association, signedURL })),
    })),
});
