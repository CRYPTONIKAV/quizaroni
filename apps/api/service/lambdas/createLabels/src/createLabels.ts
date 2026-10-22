import {
    APIGatewayProxyEventV2WithLambdaAuthorizer,
    APIGatewayProxyResultV2,
    Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { AuthorizerContext } from "models/auth";
import { logRequest } from "utilities/logging";

const { mainTable = "", usersTable = "" } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

type RequestBody = {
    label: string;
    studysetUUID?: string;
    updateStudysetLabel?: boolean;
};

export const handler: Handler = async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
    context
): Promise<APIGatewayProxyResultV2> => {
    logRequest(event);

    const { sub: userUUID, username } = event.requestContext.authorizer.lambda
    const body: RequestBody = JSON.parse(event.body ?? "{}");

    const { label, studysetUUID = "", updateStudysetLabel = false } = body;

    try {
        const userPK = `user#${userUUID}`;
        const userSK = 'userData';
        const updatedAt = new Date().toISOString();

        const userLabelsUpdateCommand = new UpdateCommand({
            Key: {
                PK: userPK,
                SK: userSK,
            },
            TableName: usersTable,
            ExpressionAttributeNames: {
                '#labels': 'labels',
            },
            ExpressionAttributeValues: {
                ':newLabel': [label],
                ':updatedAt': updatedAt,
            },
            UpdateExpression: 'SET #labels = list_append(#labels, :newLabel), updatedAt = :updatedAt',
        });
        await docClient.send(userLabelsUpdateCommand);

        if (updateStudysetLabel) {
            const studysetsPK = `userUUID#${userUUID}`;
            const studysetsSK = `studyset#${studysetUUID}`;
            const updatedAt = new Date().toISOString();

            const studysetLabelUpdateCommand = new UpdateCommand({
                Key: {
                    PK: studysetsPK,
                    SK: studysetsSK,
                },
                TableName: mainTable,
                ExpressionAttributeNames: {
                    '#labels': 'labels',
                },
                ExpressionAttributeValues: {
                    ':newLabelArray': [label],
                    ':emptyList': [],
                    ':updatedAt': updatedAt,
                    ':updatedBy': username,
                },
                UpdateExpression: 'SET #labels = list_append(if_not_exists(#labels, :emptyList), :newLabelArray), updatedAt = :updatedAt, updatedBy = :updatedBy',
            });
            await docClient.send(studysetLabelUpdateCommand);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Successfully created label",
            }),
        };
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Error",
            }),
        };
    }
};
