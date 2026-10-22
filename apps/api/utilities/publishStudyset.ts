import { isSubjectId } from '@quizaroni/shared-types';
import type { PublishError, SubjectId } from '@quizaroni/shared-types';
import type { Card, Studyset, Timestamp, UUID } from 'models/studysets';
import { PUBLIC_STUDYSET_PK, publicStudysetSK } from 'resources/dynamo/publicSharing';

export const MIN_PUBLISHABLE_CARDS = 4;

const isFilled = (value: unknown): boolean =>
    typeof value === 'string' && value.trim() !== '';

// Stored cards aren't validated on write, so a side may be missing or not a string.
export const countCompleteCards = (
    cards: Partial<Pick<Card, 'term' | 'definition'>>[] | undefined = [],
): number => cards.filter((card) => isFilled(card?.term) && isFilled(card?.definition)).length;

export type PublishValidation =
    | { ok: true; subject: SubjectId; publishedAt: Timestamp }
    | { ok: false; errors: PublishError[] };

/**
 * The publish gate. A hidden set gets only the `hidden` error, since fixing
 * the subject or cards wouldn't help; otherwise every failing rule is reported
 * so the owner can fix them in one go.
 */
export const validatePublishRequest = ({
    subject,
    studyset,
    now,
}: {
    subject: unknown;
    studyset: Partial<Pick<Studyset, 'cards' | 'publishedAt' | 'moderation'>>;
    now: Timestamp;
}): PublishValidation => {
    if (studyset.moderation?.hiddenAt) {
        return { ok: false, errors: [{ code: 'hidden' }] };
    }

    const errors: PublishError[] = [];
    const validSubject = isSubjectId(subject);
    if (!validSubject) {
        errors.push({ code: 'invalidSubject' });
    }
    const actual = countCompleteCards(studyset.cards);
    if (actual < MIN_PUBLISHABLE_CARDS) {
        errors.push({ code: 'notEnoughCards', required: MIN_PUBLISHABLE_CARDS, actual });
    }
    if (!validSubject || errors.length > 0) {
        return { ok: false, errors };
    }

    return { ok: true, subject, publishedAt: studyset.publishedAt ?? now };
};

/**
 * `if_not_exists` keeps the first publishedAt even if two first publishes
 * race, and the condition refuses a set taken down after the gate's Get.
 */
export const buildPublishUpdate = ({
    studysetUUID,
    subject,
    publishedAt,
    username,
    now,
}: {
    studysetUUID: UUID;
    subject: SubjectId;
    publishedAt: Timestamp;
    username?: string;
    now: Timestamp;
}) => {
    const setExpressions = [
        '#subject = :subject',
        '#publishedAt = if_not_exists(#publishedAt, :publishedAt)',
        '#metadata.#publiclyViewable = :true',
        '#PK2 = :pk2',
        '#SK2 = :sk2',
        '#updatedAt = :now',
    ];
    const ExpressionAttributeNames: Record<string, string> = {
        '#subject': 'subject',
        '#publishedAt': 'publishedAt',
        '#metadata': 'metadata',
        '#publiclyViewable': 'publiclyViewable',
        '#PK2': 'PK2',
        '#SK2': 'SK2',
        '#updatedAt': 'updatedAt',
        '#moderation': 'moderation',
        '#hiddenAt': 'hiddenAt',
    };
    const ExpressionAttributeValues: Record<string, unknown> = {
        ':subject': subject,
        ':publishedAt': publishedAt,
        ':true': true,
        ':pk2': PUBLIC_STUDYSET_PK,
        ':sk2': publicStudysetSK(studysetUUID),
        ':now': now,
    };

    if (username) {
        setExpressions.push('#username = :username', '#updatedBy = :username');
        ExpressionAttributeNames['#username'] = 'username';
        ExpressionAttributeNames['#updatedBy'] = 'updatedBy';
        ExpressionAttributeValues[':username'] = username;
    }

    return {
        UpdateExpression: `SET ${setExpressions.join(', ')}`,
        ConditionExpression: 'attribute_exists(PK) AND attribute_not_exists(#moderation.#hiddenAt)',
        ExpressionAttributeNames,
        ExpressionAttributeValues,
    };
};

/** Takes the set off the public index; subject and publishedAt stay for a later republish. */
export const buildUnpublishUpdate = ({ username, now }: { username?: string; now: Timestamp }) => {
    const setExpressions = ['#metadata.#publiclyViewable = :false', '#updatedAt = :now'];
    const ExpressionAttributeNames: Record<string, string> = {
        '#metadata': 'metadata',
        '#publiclyViewable': 'publiclyViewable',
        '#updatedAt': 'updatedAt',
        '#PK2': 'PK2',
        '#SK2': 'SK2',
    };
    const ExpressionAttributeValues: Record<string, unknown> = {
        ':false': false,
        ':now': now,
    };

    if (username) {
        setExpressions.push('#updatedBy = :username');
        ExpressionAttributeNames['#updatedBy'] = 'updatedBy';
        ExpressionAttributeValues[':username'] = username;
    }

    return {
        UpdateExpression: `SET ${setExpressions.join(', ')} REMOVE #PK2, #SK2`,
        ConditionExpression: 'attribute_exists(PK)',
        ExpressionAttributeNames,
        ExpressionAttributeValues,
    };
};
