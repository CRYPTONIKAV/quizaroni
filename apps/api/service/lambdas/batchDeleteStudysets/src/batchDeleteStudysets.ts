import {
    APIGatewayProxyEventV2WithLambdaAuthorizer,
    APIGatewayProxyResultV2,
    Handler,
} from 'aws-lambda';
import { DynamoDBClient, ReturnValue } from '@aws-sdk/client-dynamodb';
import {
    BatchWriteCommand,
    BatchWriteCommandInput,
    DeleteCommand,
    DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { AuthorizerContext } from 'models/auth';
import { logRequest } from 'utilities/logging';

const { mainTable = '' } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

type RequestBody = {
    studysetUUIDs: string[];
};

export const handler: Handler = async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
    context
): Promise<APIGatewayProxyResultV2> => {
    logRequest(event);

    const { sub: userUUID, username } = event.requestContext.authorizer.lambda;
    const body: RequestBody = JSON.parse(event.body ?? '{}');
    const { studysetUUIDs } = body;

    try {
        const deleteRequests = studysetUUIDs.map((studysetUUID) => {
            return {
                DeleteRequest: {
                    Key: {
                        PK: `userUUID#${userUUID}`,
                        SK: `studyset#${studysetUUID}`,
                    },
                },
            };
        });

        const batchWriteCommandInput: BatchWriteCommandInput = {
            RequestItems: {
                [mainTable]: deleteRequests,
            },
        };

        const { UnprocessedItems } = await docClient.send(
            new BatchWriteCommand(batchWriteCommandInput)
        );
        // Keys only. The full response used to be logged, and that log was the
        // only trace of a partial delete (#179).
        const unprocessed = UnprocessedItems?.[mainTable] ?? [];
        if (unprocessed.length > 0) {
            console.error(
                JSON.stringify({
                    unprocessedKeys: unprocessed.map((request) => request.DeleteRequest?.Key),
                })
            );
        }

        // TODO: Delete all associated files

        return {
            statusCode: 200,
            body: JSON.stringify({
                // studysetUUID
            }),
        };
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Error',
            }),
        };
    }
};
