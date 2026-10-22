import {
    APIGatewayProxyEventV2WithLambdaAuthorizer,
    APIGatewayProxyResultV2,
    APIGatewayProxyStructuredResultV2,
    Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { AuthorizerContext } from "models/auth";
import { buildLabelUpdateInput } from "utilities/labels";
import { logRequest } from "utilities/logging";

const { mainTable = "" } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const INVALID_BODY_MESSAGE =
    "studysetUpdates must be an array of [studysetUUID, labels[]] tuples with unique studysetUUIDs";

const isValidUpdates = (value: unknown): value is [string, string[]][] =>
    Array.isArray(value) &&
    value.every(
        (entry) =>
            Array.isArray(entry) &&
            typeof entry[0] === "string" &&
            Array.isArray(entry[1]) &&
            entry[1].every((label: unknown) => typeof label === "string")
    ) &&
    new Set(value.map(([studysetUUID]) => studysetUUID)).size === value.length;

export const summarizeLabelUpdates = (
    studysetUUIDs: string[],
    results: PromiseSettledResult<unknown>[]
): APIGatewayProxyStructuredResultV2 => {
    const updatedStudysetUUIDs: string[] = [];
    const notFoundStudysetUUIDs: string[] = [];
    const failedStudysetUUIDs: string[] = [];

    results.forEach((result, i) => {
        if (result.status === "fulfilled") {
            updatedStudysetUUIDs.push(studysetUUIDs[i]);
        } else if (
            (result.reason as { name?: string })?.name === "ConditionalCheckFailedException"
        ) {
            notFoundStudysetUUIDs.push(studysetUUIDs[i]);
        } else {
            failedStudysetUUIDs.push(studysetUUIDs[i]);
        }
    });

    const allSucceeded =
        notFoundStudysetUUIDs.length === 0 && failedStudysetUUIDs.length === 0;
    const statusCode = allSucceeded ? 200 : failedStudysetUUIDs.length > 0 ? 500 : 404;

    return {
        statusCode,
        body: JSON.stringify({
            message: allSucceeded
                ? `Successfully updated ${updatedStudysetUUIDs.length} studyset(s)`
                : "Some studysets could not be updated",
            updatedStudysetUUIDs,
            notFoundStudysetUUIDs,
            failedStudysetUUIDs,
        }),
    };
};

export const handler: Handler = async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
    context
): Promise<APIGatewayProxyResultV2> => {
    logRequest(event);

    const { sub: userUUID, username } = event.requestContext.authorizer.lambda;

    let studysetUpdates: unknown;
    try {
        studysetUpdates = (
            JSON.parse(event.body ?? "{}") as { studysetUpdates?: unknown } | null
        )?.studysetUpdates;
    } catch {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: INVALID_BODY_MESSAGE }),
        };
    }

    if (!isValidUpdates(studysetUpdates)) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: INVALID_BODY_MESSAGE }),
        };
    }

    try {
        const updatedAt = new Date().toISOString();

        // Caps how many updates run concurrently
        const BATCH_SIZE = 25;
        const results: PromiseSettledResult<unknown>[] = [];

        for (let i = 0; i < studysetUpdates.length; i += BATCH_SIZE) {
            const chunk = studysetUpdates.slice(i, i + BATCH_SIZE);
            results.push(
                ...(await Promise.allSettled(
                    chunk.map(([studysetUUID, labels]) =>
                        docClient.send(
                            new UpdateCommand(
                                buildLabelUpdateInput({
                                    tableName: mainTable,
                                    userUUID,
                                    username,
                                    studysetUUID,
                                    labels,
                                    updatedAt,
                                })
                            )
                        )
                    )
                ))
            );
        }

        results.forEach((result, i) => {
            if (result.status === "rejected") {
                console.error(
                    `Failed to update labels for studyset ${studysetUpdates[i][0]}`,
                    result.reason
                );
            }
        });

        return summarizeLabelUpdates(
            studysetUpdates.map(([studysetUUID]) => studysetUUID),
            results
        );
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Error updating studyset labels",
                error: err instanceof Error ? err.message : "Unknown error",
            }),
        };
    }
};
