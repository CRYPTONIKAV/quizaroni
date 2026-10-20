import {
    APIGatewayProxyEventV2,
    APIGatewayProxyResultV2,
    Handler,
} from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
    isPubliclyListed,
    PUBLIC_GSI_INDEX_NAME,
    PUBLIC_STUDYSET_PK,
} from 'resources/dynamo/publicSharing';

const { mainTable = '' } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Safety cap so a runaway public-set count can't produce an unbounded response.
const MAX_ITEMS = 5000;

type PublicStudysetSummary = {
    studysetUUID: string;
    title: string;
    updatedAt: string;
};

/**
 * Unauthenticated listing of every public study set, used to build the sitemap
 * (and, later, an anonymous Explore). A set is indexed on the PK2 GSI only
 * while published, so this is a single partition Query. Rows that fail
 * `isPubliclyListed` (flag off, hidden by moderation, or a pre-#125 copy under
 * another set's key) are dropped in the loop, matching the single-set endpoint.
 */
export const handler: Handler = async (
    event: APIGatewayProxyEventV2,
    context
): Promise<APIGatewayProxyResultV2> => {
    console.log(JSON.stringify({ event, context }, null, 4));

    try {
        const studysets: PublicStudysetSummary[] = [];
        let lastEvaluatedKey: Record<string, unknown> | undefined;

        do {
            const queryCommand: QueryCommand = new QueryCommand({
                TableName: mainTable,
                IndexName: PUBLIC_GSI_INDEX_NAME,
                KeyConditionExpression: 'PK2 = :pk',
                ExpressionAttributeValues: { ':pk': PUBLIC_STUDYSET_PK },
                // `title` / `updatedAt` are not reserved words; alias only if
                // that ever changes.
                ProjectionExpression:
                    'studysetUUID, title, updatedAt, SK, SK2, #metadata.#publiclyViewable, #moderation.#hiddenAt',
                ExpressionAttributeNames: {
                    '#metadata': 'metadata',
                    '#publiclyViewable': 'publiclyViewable',
                    '#moderation': 'moderation',
                    '#hiddenAt': 'hiddenAt',
                },
                ExclusiveStartKey: lastEvaluatedKey,
            });

            const result = await docClient.send(queryCommand);

            for (const item of result.Items ?? []) {
                if (item.studysetUUID && isPubliclyListed(item)) {
                    studysets.push({
                        studysetUUID: item.studysetUUID,
                        title: item.title ?? '',
                        updatedAt: item.updatedAt ?? '',
                    });
                }
            }

            lastEvaluatedKey = result.LastEvaluatedKey as
                | Record<string, unknown>
                | undefined;
        } while (lastEvaluatedKey && studysets.length < MAX_ITEMS);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300, s-maxage=3600',
            },
            body: JSON.stringify({
                message: 'Successfully retrieved public study sets',
                studysets,
            }),
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: (error as Error).message,
            }),
        };
    }
};
