import {
    APIGatewayProxyEventV2WithLambdaAuthorizer,
    APIGatewayProxyResultV2,
    Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { AuthorizerContext } from "models/auth";
import { Studyset } from "models/studysets";
import { removeKeys } from "resources/dynamo/utilities";
import { regenerateSignedUrls } from "utilities/studysets";
import { logRequest } from "utilities/logging";

const { mainTable = "", mainBucket = "" } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const s3Client = new S3Client({});

type RequestBody = {
    studysetUUID: string;
};

const notFound = (): APIGatewayProxyResultV2 => ({
    statusCode: 404,
    body: JSON.stringify({ message: "Study set not found in your library." }),
});

export const handler: Handler = async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
    context
): Promise<APIGatewayProxyResultV2> => {
    logRequest(event);

    const { sub: userUUID } = event.requestContext.authorizer.lambda
    const body: RequestBody = JSON.parse(event.body ?? "{}");

    const { studysetUUID } = body;

    try {
        const getCommand = new GetCommand({
            Key: {
                PK: `userUUID#${userUUID}`,
                SK: `studyset#${studysetUUID}`,
            },
            TableName: mainTable,
            // A 404 now skips retries and shows the public fallback, so a stale
            // read right after create must not miss (#133).
            ConsistentRead: true,
        })
        // TODO: Think about shared sessions

        const result = await docClient.send(getCommand);
        const studyset = result.Item;

        // An upsert stub (#127, #146) can sit under someone else's id with no
        // studysetUUID; it isn't the caller's set either.
        if (!studyset || studyset.studysetUUID !== studysetUUID) {
            return notFound();
        }

        removeKeys(studyset);

        // Regenerate signed URLs for all files in the studyset
        const studysetWithFreshUrls = await regenerateSignedUrls({
            s3Client,
            bucket: mainBucket,
            studyset: studyset as Studyset,
        });

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Successfully retrieved study set data",
                studyset: studysetWithFreshUrls,
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
