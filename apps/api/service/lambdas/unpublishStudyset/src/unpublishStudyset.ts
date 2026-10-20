import {
    APIGatewayProxyEventV2WithLambdaAuthorizer,
    APIGatewayProxyResultV2,
    Handler,
} from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { AuthorizerContext } from 'models/auth';
import { removeKeys } from 'resources/dynamo/utilities';
import { buildUnpublishUpdate } from 'utilities/publishStudyset';

const { mainTable = '' } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const respond = (statusCode: number, body: object): APIGatewayProxyResultV2 => ({
    statusCode,
    body: JSON.stringify(body),
});

const parseBody = (raw: string | undefined): { studysetUUID?: string } => {
    try {
        return JSON.parse(raw ?? '{}') ?? {};
    } catch {
        return {};
    }
};

/**
 * Takes the caller's own set off Explore. Allowed on hidden sets too, since it
 * only removes index keys. The raw event is never logged: it carries the
 * bearer token.
 */
export const handler: Handler = async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>
): Promise<APIGatewayProxyResultV2> => {
    const { sub: userUUID, username } = event.requestContext.authorizer.lambda;
    const body = parseBody(event.body);
    console.log(JSON.stringify({ requestId: event.requestContext.requestId, userUUID, body }));

    const { studysetUUID } = body;
    if (typeof studysetUUID !== 'string' || !studysetUUID) {
        return respond(400, { message: 'studysetUUID is required' });
    }

    try {
        const { Attributes } = await docClient.send(
            new UpdateCommand({
                TableName: mainTable,
                Key: { PK: `userUUID#${userUUID}`, SK: `studyset#${studysetUUID}` },
                ...buildUnpublishUpdate({ username, now: new Date().toISOString() }),
                ReturnValues: 'ALL_NEW',
            })
        );

        return respond(200, {
            message: 'Unpublished study set',
            studyset: removeKeys(Attributes ?? {}),
        });
    } catch (err) {
        if ((err as { name?: string })?.name === 'ConditionalCheckFailedException') {
            return respond(404, { message: 'Study set not found' });
        }
        console.error(err);
        return respond(500, { message: 'Error unpublishing study set' });
    }
};
