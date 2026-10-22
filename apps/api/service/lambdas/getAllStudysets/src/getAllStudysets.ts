import {
    APIGatewayProxyEventV2WithLambdaAuthorizer,
    APIGatewayProxyResultV2,
    Handler,
} from "aws-lambda";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand  } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { AuthorizerContext } from "models/auth";
import { Studyset } from "models/studysets";
import { regenerateSignedUrlsForStudysets } from "utilities/studysets";
import { logRequest } from "utilities/logging";

const { mainTable = "", mainBucket = "" } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const s3Client = new S3Client({});

export const handler: Handler = async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
    context
): Promise<APIGatewayProxyResultV2> => {
    logRequest(event);
    const { sub: userUUID } = event.requestContext.authorizer.lambda

    try {
        const SK = `userUUID#${userUUID}`;
        const queryCommand = new QueryCommand({
            TableName: mainTable,
            KeyConditionExpression: "PK = :userUUID",
            ExpressionAttributeValues: {
                ":userUUID": `userUUID#${userUUID}`
            }
        });
        const { Items: studysets } = await docClient.send(queryCommand);

        // Regenerate signed URLs for all files in all studysets
        const studysetsWithFreshUrls = await regenerateSignedUrlsForStudysets({
            s3Client,
            bucket: mainBucket,
            studysets: (studysets ?? []) as Studyset[],
        });

        return {
            statusCode: 200,
            body: JSON.stringify({
                studysets: studysetsWithFreshUrls
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
