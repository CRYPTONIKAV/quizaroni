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
import { NotificationPreferences } from 'models/user';
import { logRequest } from 'utilities/logging';

const { usersTable = '' } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

type RequestBody = {
    updates: Partial<NotificationPreferences>;
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

        // First, get the current user to merge notification preferences
        const getCommand = new GetCommand({
            Key: { PK, SK },
            TableName: usersTable,
        });
        const getResult = await docClient.send(getCommand);
        const currentUser = getResult.Item;

        if (!currentUser) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'User not found' }),
            };
        }

        // Merge existing notifications with updates
        const currentNotifications = currentUser.metadata?.notifications || {};
        const mergedNotifications = deepMerge(currentNotifications, updates);

        // Build the update expression
        const updateCommand = new UpdateCommand({
            Key: { PK, SK },
            TableName: usersTable,
            UpdateExpression:
                'SET #metadata.#notifications = :notifications, #updatedAt = :updatedAt, #updatedBy = :updatedBy',
            ExpressionAttributeNames: {
                '#metadata': 'metadata',
                '#notifications': 'notifications',
                '#updatedAt': 'updatedAt',
                '#updatedBy': 'updatedBy',
            },
            ExpressionAttributeValues: {
                ':notifications': mergedNotifications,
                ':updatedAt': updatedAt,
                ':updatedBy': username,
            },
            ReturnValues: 'ALL_NEW',
        });

        const updateResult = await docClient.send(updateCommand);
        const updatedUser = updateResult.Attributes;

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Successfully updated notification preferences',
                user: removeKeys(updatedUser ?? {}),
            }),
        };
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Error updating notification preferences',
            }),
        };
    }
};

// Deep merge helper function
function deepMerge<T extends Record<string, any>>(
    target: T,
    source: Partial<T>
): T {
    const result = { ...target };

    for (const key in source) {
        const sourceValue = source[key];
        const targetValue = result[key];

        if (
            sourceValue !== null &&
            typeof sourceValue === 'object' &&
            !Array.isArray(sourceValue) &&
            targetValue !== null &&
            typeof targetValue === 'object' &&
            !Array.isArray(targetValue)
        ) {
            result[key] = deepMerge(targetValue, sourceValue);
        } else if (sourceValue !== undefined) {
            result[key] = sourceValue as T[Extract<keyof T, string>];
        }
    }

    return result;
}
