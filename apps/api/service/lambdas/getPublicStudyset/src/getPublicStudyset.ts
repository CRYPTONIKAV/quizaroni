import {
    APIGatewayProxyEventV2,
    APIGatewayProxyResultV2,
    Handler,
} from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { Studyset } from 'models/studysets';
import {
    PUBLIC_GSI_INDEX_NAME,
    PUBLIC_STUDYSET_PK,
    publicStudysetSK,
} from 'resources/dynamo/publicSharing';
import {
    PublicStudysetSource,
    toPublicStudyset,
} from 'utilities/publicStudyset';
import { regenerateSignedUrls } from 'utilities/studysets';

const { mainTable = '', mainBucket = '' } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const s3Client = new S3Client({});

const notFound = (): APIGatewayProxyResultV2 => ({
    statusCode: 404,
    body: JSON.stringify({
        message: 'This study set is private or does not exist.',
    }),
});

/**
 * Unauthenticated read of a single public study set. Registered without the
 * Cognito authorizer so crawlers, social scrapers, and logged-out visitors can
 * fetch it. Only sets whose `metadata.publiclyViewable` is true are indexed on
 * the PK2 GSI, and we re-check the flag as defence in depth.
 */
export const handler: Handler = async (
    event: APIGatewayProxyEventV2,
    context
): Promise<APIGatewayProxyResultV2> => {
    console.log(JSON.stringify({ event, context }, null, 4));

    const studysetUUID = event.pathParameters?.studysetUUID ?? '';
    if (!studysetUUID) {
        return notFound();
    }

    try {
        const queryCommand = new QueryCommand({
            TableName: mainTable,
            IndexName: PUBLIC_GSI_INDEX_NAME,
            KeyConditionExpression: 'PK2 = :pk AND SK2 = :sk',
            ExpressionAttributeValues: {
                ':pk': PUBLIC_STUDYSET_PK,
                ':sk': publicStudysetSK(studysetUUID),
            },
            Limit: 1,
        });

        const result = await docClient.send(queryCommand);
        const studyset = result.Items?.[0];

        if (!studyset || studyset.metadata?.publiclyViewable !== true) {
            return notFound();
        }

        // Regenerate signed URLs for any card attachments before the storage
        // keys are dropped.
        const studysetWithFreshUrls = await regenerateSignedUrls({
            s3Client,
            bucket: mainBucket,
            studyset: studyset as Studyset,
        });

        // Built from an explicit allowlist: notes, labels, categories, owner
        // ids and storage keys never leave.
        const publicStudyset = toPublicStudyset(
            studysetWithFreshUrls as PublicStudysetSource
        );

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                // Cache at the CDN/edge briefly so a viral link doesn't hammer
                // DynamoDB, while edits still propagate within minutes.
                'Cache-Control': 'public, max-age=60, s-maxage=300',
            },
            body: JSON.stringify({
                message: 'Successfully retrieved public study set',
                studyset: publicStudyset,
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
