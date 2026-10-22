import {
    APIGatewayProxyEventV2WithLambdaAuthorizer,
    APIGatewayProxyResultV2,
    Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { AuthorizerContext } from "models/auth";
import { buildLabelUpdateInput } from "utilities/labels";

const { mainTable = "" } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const INVALID_BODY_MESSAGE =
    "body must be an object with a non-empty string studysetUUID and an array of string labels";

type RequestBody = {
    labels: string[];
    studysetUUID: string;
};

const isValidBody = (value: unknown): value is RequestBody => {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const { studysetUUID, labels } = value as Partial<Record<keyof RequestBody, unknown>>;
    return (
        typeof studysetUUID === "string" &&
        studysetUUID !== "" &&
        Array.isArray(labels) &&
        labels.every((label: unknown) => typeof label === "string")
    );
};

export const handler: Handler = async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
    context
): Promise<APIGatewayProxyResultV2> => {
    console.log(JSON.stringify({ event, context }, null, 4));

    const { sub: userUUID, username } = event.requestContext.authorizer.lambda;

    let body: unknown;
    try {
        body = JSON.parse(event.body ?? "{}");
    } catch {
        body = undefined;
    }

    if (!isValidBody(body)) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: INVALID_BODY_MESSAGE,
            }),
        };
    }

    const { labels, studysetUUID } = body;

    try {
        const updatedAt = new Date().toISOString();

        const updateLabelsCommand = new UpdateCommand(
            buildLabelUpdateInput({
                tableName: mainTable,
                userUUID,
                username,
                studysetUUID,
                labels,
                updatedAt,
            })
        );
        await docClient.send(updateLabelsCommand);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Successfully updated studyset labels",
            }),
        };
    } catch (err) {
        if ((err as { name?: string })?.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    message: "Studyset not found",
                }),
            };
        }

        console.error(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Error",
            }),
        };
    }
};
