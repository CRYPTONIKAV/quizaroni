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
import { AuthorizerContext } from 'models/auth';
import { Studyset } from 'models/studysets';
import { removeKeys } from 'resources/dynamo/utilities';
import {
    buildPublishUpdate,
    validatePublishRequest,
} from 'utilities/publishStudyset';
import { logRequest } from 'utilities/logging';

const { mainTable = '' } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

type RequestBody = {
    studysetUUID?: string;
    subject?: unknown;
};

const respond = (statusCode: number, body: object): APIGatewayProxyResultV2 => ({
    statusCode,
    body: JSON.stringify(body),
});

const parseBody = (raw: string | undefined): RequestBody => {
    try {
        return JSON.parse(raw ?? '{}') ?? {};
    } catch {
        return {};
    }
};

/**
 * Publishes the caller's own set to Explore. The gate runs on the stored set,
 * and the write is conditional so a takedown that lands in between still wins.
 * The raw event is never logged: it carries the bearer token.
 */
export const handler: Handler = async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>
): Promise<APIGatewayProxyResultV2> => {
    logRequest(event);

    const { sub: userUUID, username } = event.requestContext.authorizer.lambda;
    const body = parseBody(event.body);

    const { studysetUUID, subject } = body;
    if (typeof studysetUUID !== 'string' || !studysetUUID) {
        return respond(400, { message: 'studysetUUID is required' });
    }

    const Key = { PK: `userUUID#${userUUID}`, SK: `studyset#${studysetUUID}` };

    try {
        const { Item } = await docClient.send(
            new GetCommand({ TableName: mainTable, Key })
        );
        if (!Item) {
            return respond(404, { message: 'Study set not found' });
        }

        const now = new Date().toISOString();
        const validation = validatePublishRequest({
            subject,
            studyset: Item as Studyset,
            now,
        });
        if (!validation.ok) {
            return respond(400, {
                message: 'Study set cannot be published',
                errors: validation.errors,
            });
        }

        const { Attributes } = await docClient.send(
            new UpdateCommand({
                TableName: mainTable,
                Key,
                ...buildPublishUpdate({
                    studysetUUID,
                    subject: validation.subject,
                    publishedAt: validation.publishedAt,
                    username,
                    now,
                }),
                ReturnValues: 'ALL_NEW',
                ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
            })
        );

        return respond(200, {
            message: 'Published study set',
            studyset: removeKeys(Attributes ?? {}),
        });
    } catch (err) {
        const error = err as { name?: string; Item?: unknown };
        if (error?.name === 'ConditionalCheckFailedException') {
            // With ALL_OLD the failed check returns the item if it still
            // exists, so it was hidden; no item means it was deleted.
            return error.Item
                ? respond(400, {
                      message: 'Study set cannot be published',
                      errors: [{ code: 'hidden' }],
                  })
                : respond(404, { message: 'Study set not found' });
        }
        console.error(err);
        return respond(500, { message: 'Error publishing study set' });
    }
};
