import {
    APIGatewayProxyEventV2WithLambdaAuthorizer,
    APIGatewayProxyResultV2,
    Handler,
} from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    GetCommand,
    UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { AuthorizerContext } from 'models/auth';
import { removeKeys } from 'resources/dynamo/utilities';
import { logRequest } from 'utilities/logging';

const { mainBucket = '', mainTable = '' } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const s3Client = new S3Client({});

type RequestBody = {
    studysetUUID: string;
    updates: { [key: string]: any };
    isMetadataUpdate?: boolean;
};

type BuildUpdateExpressionParams = {
    updates: { [key: string]: any };
    isMetadataUpdate: boolean;
    updatedAt: string;
    updatedBy: string;
};

const SERVER_OWNED_FIELDS = new Set(['subject', 'publishedAt', 'moderation', 'PK2', 'SK2']);
const SERVER_OWNED_METADATA_FIELDS = new Set(['publiclyViewable']);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Builds the DynamoDB UpdateExpression for a studyset update.
 *
 * Regression test: `updatedAt`/`updatedBy` are always server-set here, but
 * callers that spread a previously-fetched studyset into `updates` (see
 * apps/web CreateSet.tsx's saveChanges()) carry the studyset's existing
 * values for both. Left in, that produced two SET clauses for the same
 * #updatedAt/#updatedBy attribute paths, which DynamoDB rejects outright —
 * every save of an existing studyset 500'd, and the frontend's `validate()`
 * helper doesn't check response.ok, so the error was swallowed and shown to
 * the user as a successful save. This strips both from the caller-supplied
 * `updates` before building the expression.
 *
 * Publication fields (`subject`, `publishedAt`, `PK2`/`SK2`,
 * `metadata.publiclyViewable`) and `moderation` are owned by publish,
 * unpublish and the takedown script, so they are silently stripped here. A
 * top-level `metadata` object (CreateSet's full save) is merged per key
 * rather than replacing the map, so it can't reset `publiclyViewable`.
 */
export const buildUpdateExpression = ({
    updates,
    isMetadataUpdate,
    updatedAt,
    updatedBy,
}: BuildUpdateExpressionParams) => {
    const topLevelUpdates = { updatedAt, updatedBy };

    const updateExpressions: string[] = [];
    const ExpressionAttributeNames: Record<string, string> = {};
    const ExpressionAttributeValues: Record<string, any> = {};

    // Handle top-level updates for `updatedAt` and `updatedBy`
    for (const [key, value] of Object.entries(topLevelUpdates)) {
        const attributeKey = `#${key}`;
        const attributeValue = `:${key}`;
        updateExpressions.push(`${attributeKey} = ${attributeValue}`);
        ExpressionAttributeNames[attributeKey] = key;
        ExpressionAttributeValues[attributeValue] = value;
    }

    const {
        updatedAt: _ignoredUpdatedAt,
        updatedBy: _ignoredUpdatedBy,
        ...clientUpdates
    } = updates;

    let metadataKeyCount = 0;
    const setMetadataKey = (key: string, value: unknown) => {
        // Index-based placeholders so a metadata key can't collide with a
        // top-level one of the same name.
        const index = metadataKeyCount++;
        updateExpressions.push(`#metadata.#metadataKey${index} = :metadataValue${index}`);
        ExpressionAttributeNames[`#metadataKey${index}`] = key;
        ExpressionAttributeValues[`:metadataValue${index}`] = value;
    };

    for (const [key, value] of Object.entries(clientUpdates)) {
        if (isMetadataUpdate) {
            if (SERVER_OWNED_METADATA_FIELDS.has(key)) continue;
            updateExpressions.push(`#metadata.#${key} = :${key}`);
            ExpressionAttributeNames[`#${key}`] = key;
            ExpressionAttributeValues[`:${key}`] = value;
        } else if (key === 'metadata') {
            if (!isPlainObject(value)) continue;
            for (const [metadataKey, metadataValue] of Object.entries(value)) {
                if (!SERVER_OWNED_METADATA_FIELDS.has(metadataKey)) {
                    setMetadataKey(metadataKey, metadataValue);
                }
            }
        } else if (!SERVER_OWNED_FIELDS.has(key)) {
            updateExpressions.push(`#${key} = :${key}`);
            ExpressionAttributeNames[`#${key}`] = key;
            ExpressionAttributeValues[`:${key}`] = value;
        }
    }

    // An unused name makes DynamoDB reject the whole update.
    if (updateExpressions.some((expression) => expression.startsWith('#metadata.'))) {
        ExpressionAttributeNames['#metadata'] = 'metadata';
    }

    const UpdateExpression = `SET ${updateExpressions.join(', ')}`;

    return { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues };
};

export const handler: Handler = async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
    context
): Promise<APIGatewayProxyResultV2> => {
    logRequest(event);

    const { sub: userUUID, username } = event.requestContext.authorizer.lambda;
    const body: RequestBody = JSON.parse(event.body ?? '{}');

    const { isMetadataUpdate = false, studysetUUID, updates } = body;

    try {
        const PK = `userUUID#${userUUID}`;
        const SK = `studyset#${studysetUUID}`;
        const updatedAt = new Date().toISOString();

        // Handle S3 file cleanup if cards are being updated
        if (updates.cards) {
            try {
                // Fetch existing studyset to compare files
                const getCommand = new GetCommand({
                    Key: { PK, SK },
                    TableName: mainTable,
                });
                const getResult = await docClient.send(getCommand);
                const existingStudyset = getResult.Item;

                if (existingStudyset && existingStudyset.cards) {
                    // Collect all file keys from old studyset
                    const oldFileKeys = new Set<string>();
                    existingStudyset.cards.forEach((card: any) => {
                        if (card.files && Array.isArray(card.files)) {
                            card.files.forEach((file: any) => {
                                if (file.key) {
                                    oldFileKeys.add(file.key);
                                }
                            });
                        }
                    });

                    // Collect all file keys from new studyset
                    const newFileKeys = new Set<string>();
                    updates.cards.forEach((card: any) => {
                        if (card.files && Array.isArray(card.files)) {
                            card.files.forEach((file: any) => {
                                if (file.key) {
                                    newFileKeys.add(file.key);
                                }
                            });
                        }
                    });

                    // Find removed files
                    const removedFileKeys = [...oldFileKeys].filter(
                        (key) => !newFileKeys.has(key)
                    );

                    // Delete removed files from S3
                    if (removedFileKeys.length > 0) {
                        console.log(
                            `Deleting ${removedFileKeys.length} removed files from S3:`,
                            removedFileKeys
                        );

                        for (const fileKey of removedFileKeys) {
                            try {
                                const deleteCommand = new DeleteObjectCommand({
                                    Bucket: mainBucket,
                                    Key: fileKey,
                                });
                                await s3Client.send(deleteCommand);
                                console.log(`Successfully deleted file: ${fileKey}`);
                            } catch (deleteError) {
                                console.error(
                                    `Failed to delete file ${fileKey}:`,
                                    deleteError
                                );
                                // Continue with update even if S3 delete fails
                            }
                        }
                    }
                }
            } catch (fileCleanupError) {
                console.error('Error during file cleanup:', fileCleanupError);
                // Continue with update even if file cleanup fails
            }
        }

        const { ExpressionAttributeNames, ExpressionAttributeValues, UpdateExpression } =
            buildUpdateExpression({
                updates,
                isMetadataUpdate,
                updatedAt,
                updatedBy: username,
            });

        const updateCommand = new UpdateCommand({
            Key: {
                PK,
                SK,
            },
            TableName: mainTable,
            ExpressionAttributeNames,
            ExpressionAttributeValues,
            UpdateExpression,
        });
        await docClient.send(updateCommand);

        const getCommand = new GetCommand({
            Key: {
                PK: `userUUID#${userUUID}`,
                SK: `studyset#${studysetUUID}`,
            },
            TableName: mainTable,
        });
        const getResult = await docClient.send(getCommand);
        const updatedStudyset = getResult.Item;

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Successfully updated study set',
                studyset: removeKeys(updatedStudyset ?? {}),
            }),
        };
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Error updating study set',
            }),
        };
    }
};
