import {
    APIGatewayProxyEventV2WithLambdaAuthorizer,
    APIGatewayProxyResultV2,
    Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    BatchWriteCommand,
    DynamoDBDocumentClient,
    GetCommand,
    QueryCommand,
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { AuthorizerContext } from "models/auth";
import { User } from "models/user";
import { logRequest } from "utilities/logging";

const { mainTable = "", usersTable = "" } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

type RequestBody = {
    labelsToDelete: string[];
};

export const handler: Handler = async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
    context
): Promise<APIGatewayProxyResultV2> => {
    logRequest(event);

    const { sub: userUUID, username } = event.requestContext.authorizer.lambda;
    const body: RequestBody = JSON.parse(event.body ?? "{}");
    
    const { labelsToDelete } = body;

    try {
        const userPK = `user#${userUUID}`;
        const userSK = "userData";
        const updatedAt = new Date().toISOString();

        const getCommand = new GetCommand({
            TableName: usersTable,
            Key: { PK: userPK, SK: userSK },
        });

        const { Item } = await docClient.send(getCommand);
        if (!Item) {
            throw new Error(
                `Data for user ${username} with UUID ${userUUID} not found`
            );
        }
        const user = Item as User;

        const { labels: currentLabels = [] } = user;
        const newLabels = currentLabels.filter(
            (label) => !labelsToDelete.includes(label)
        );

        const userLabelsUpdateCommand = new UpdateCommand({
            Key: {
                PK: userPK,
                SK: userSK,
            },
            TableName: usersTable,
            ExpressionAttributeNames: {
                "#labels": "labels",
                "#updatedAt": "updatedAt",
            },
            ExpressionAttributeValues: {
                ":newLabels": newLabels,
                ":updatedAt": updatedAt,
            },
            UpdateExpression: 'SET #labels = :newLabels, #updatedAt = :updatedAt',
        });
        await docClient.send(userLabelsUpdateCommand);

        await deleteLabelsFromStudysets({
            labelsToDelete,
            PK: userPK,
            username,
        });

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Successfully deleted labels",
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

const deleteLabelsFromStudysets = async ({
    labelsToDelete,
    PK,
    username,
}: {
    labelsToDelete: string[];
    PK: string;
    username: string;
}) => {
    // Query for all study sets of the user
    const queryCommand = new QueryCommand({
        TableName: mainTable,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
            ":pk": PK,
            ":skPrefix": "studyset",
        },
    });
    const { Items: studysets } = await docClient.send(queryCommand);

    if (!studysets || studysets.length === 0) {
        throw new Error("No study sets found for the user");
    }

    const updatedAt = new Date().toISOString();
    const updatedStudysets = studysets
        .filter((studyset) =>
            studyset.labels?.some((l: string) => labelsToDelete.includes(l))
        )
        .map((item) => {
            // Remove deleted labels from labels array while preserving others
            const updatedLabels = item.labels.filter(
                (l: string) => !labelsToDelete.includes(l)
            );

            return {
                PutRequest: {
                    Item: {
                        ...item,
                        labels: updatedLabels,
                        updatedAt: updatedAt,
                        updatedBy: username,
                    },
                },
            };
        });

    // Batch write in chunks of 25 items (DynamoDB batch write limit)
    const chunkSize = 25;
    for (let i = 0; i < updatedStudysets.length; i += chunkSize) {
        const chunk = updatedStudysets.slice(i, i + chunkSize);
        const batchWriteCommand = new BatchWriteCommand({
            RequestItems: {
                [mainTable]: chunk,
            },
        });

        await docClient.send(batchWriteCommand);
    }
};
