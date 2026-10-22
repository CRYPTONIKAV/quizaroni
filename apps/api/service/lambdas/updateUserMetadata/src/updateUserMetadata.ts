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
import { removeKeys } from 'resources/dynamo/utilities';
import { logRequest } from 'utilities/logging';

const { usersTable = '' } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

type RequestBody = {
    updates: { [key: string]: any };
};

export const handler: Handler = async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
    context
): Promise<APIGatewayProxyResultV2> => {
    logRequest(event);

    const { sub: userUUID, username } = event.requestContext.authorizer.lambda;
    const body: RequestBody = JSON.parse(event.body ?? '{}');

    const { updates } = body;

    try {
        const PK = `user#${userUUID}`;
        const SK = `userData`;
        const updatedAt = new Date().toISOString();

        // Ensure `updatedAt` and `updatedBy` are at the top level
        const topLevelUpdates = {
            updatedAt,
            updatedBy: username,
        };

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

        // Ensure #metadata is set only once
        ExpressionAttributeNames[`#metadata`] = 'metadata';

        for (const [key, value] of Object.entries(updates)) {
            const attributeValue = `:${key}`;

            // Determine the correct key path for metadata vs. standard update
            const attributeKey = `#metadata.#${key}`;

            // Add the key to ExpressionAttributeNames (same for both cases)
            ExpressionAttributeNames[`#${key}`] = key;

            // Push the update expression
            updateExpressions.push(`${attributeKey} = ${attributeValue}`);

            // Add the value to ExpressionAttributeValues
            ExpressionAttributeValues[attributeValue] = value;
        }

        const UpdateExpression = `SET ${updateExpressions.join(', ')}`;

        const updateCommand = new UpdateCommand({
            Key: {
                PK,
                SK,
            },
            TableName: usersTable,
            ExpressionAttributeNames,
            ExpressionAttributeValues,
            UpdateExpression,
        });
        await docClient.send(updateCommand);

        const getCommand = new GetCommand({
            Key: {
                PK,
                SK,
            },
            TableName: usersTable,
        });
        const getResult = await docClient.send(getCommand);
        const updatedUser = getResult.Item;

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Successfully updated user metadata',
                user: removeKeys(updatedUser ?? {}),
            }),
        };
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Error updating user metadata',
            }),
        };
    }
};
