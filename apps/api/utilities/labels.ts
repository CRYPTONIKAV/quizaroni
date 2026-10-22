import type { UpdateCommandInput } from '@aws-sdk/lib-dynamodb';

/**
 * Updates a set's labels in place. This used to be a Put, and a Put replaced
 * the whole item, wiping cards, metadata and the public-index keys (PK2/SK2).
 * The condition stops an unknown id from being created as a stub item, since
 * UpdateItem otherwise upserts (#124, #146).
 */
export const buildLabelUpdateInput = ({
    tableName,
    userUUID,
    username,
    studysetUUID,
    labels,
    updatedAt,
}: {
    tableName: string;
    userUUID: string;
    username?: string;
    studysetUUID: string;
    labels: string[];
    updatedAt: string;
}): UpdateCommandInput => {
    const setExpressions = ['#labels = :labels', '#updatedAt = :updatedAt'];
    const ExpressionAttributeNames: Record<string, string> = {
        '#labels': 'labels',
        '#updatedAt': 'updatedAt',
    };
    const ExpressionAttributeValues: Record<string, unknown> = {
        ':labels': labels,
        ':updatedAt': updatedAt,
    };

    // username comes from an optional Logto custom JWT claim, and the document
    // client rejects undefined values.
    if (username) {
        setExpressions.push('#updatedBy = :updatedBy');
        ExpressionAttributeNames['#updatedBy'] = 'updatedBy';
        ExpressionAttributeValues[':updatedBy'] = username;
    }

    return {
        TableName: tableName,
        Key: {
            PK: `userUUID#${userUUID}`,
            SK: `studyset#${studysetUUID}`,
        },
        UpdateExpression: `SET ${setExpressions.join(', ')}`,
        ConditionExpression: 'attribute_exists(PK)',
        ExpressionAttributeNames,
        ExpressionAttributeValues,
    };
};
