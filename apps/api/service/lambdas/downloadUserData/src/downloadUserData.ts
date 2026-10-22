import {
    APIGatewayProxyEventV2WithLambdaAuthorizer,
    APIGatewayProxyResultV2,
    Handler,
} from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { AuthorizerContext } from 'models/auth';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile } from 'fs/promises';
import { logRequest } from 'utilities/logging';

const { mainTable = '', usersTable = '', mainBucket = '' } = process.env;

const execPromise = promisify(exec);

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const s3Client = new S3Client();

type RequestBody = {
    includeStudysets: boolean;
};

export const handler: Handler = async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
    context
): Promise<APIGatewayProxyResultV2> => {
    logRequest(event);
    try {
        const { sub: userUUID, username } =
            event.requestContext.authorizer.lambda;
        const body: RequestBody = JSON.parse(event.body ?? '{}');

        const { includeStudysets } = body;

        const getCommand = new GetCommand({
            Key: {
                PK: `user#${userUUID}`,
                SK: 'userData',
            },
            TableName: usersTable,
        });

        const result = await docClient.send(getCommand);
        const user = result.Item;

        // const userDataJSON = JSON.stringify(user, null, 4);
        // const userDataKey = `${userUUID}/data-${new Date().toISOString()}.json`;
        // const putObjectCommand = new PutObjectCommand({
        //     Bucket: mainBucket,
        //     Key: userDataKey,
        //     Body: userDataJSON,
        //     ContentType: 'application/json',
        // });
        // await s3Client.send(putObjectCommand);

        const timestamp = Date.now();
        const jsonKey = `${userUUID}/data-${timestamp}.json`;
        const zipKey = `${userUUID}/data-${timestamp}.zip`;
        const localJsonPath = `/tmp/userData.json`;
        const localZipPath = `/tmp/userData.zip`;

        // Write user data to /tmp/
        if (!includeStudysets) {
            await s3Client.send(
                new PutObjectCommand({
                    Bucket: mainBucket,
                    Key: jsonKey,
                    Body: JSON.stringify(user, null, 4),
                    ContentType: 'application/json',
                })
            );

            const signedURL = await getSignedUrl(
                s3Client,
                new GetObjectCommand({
                    Bucket: mainBucket,
                    Key: jsonKey,
                })
            );

            return { statusCode: 200, body: JSON.stringify({ signedURL }) };
        }
        await writeFile(localJsonPath, JSON.stringify(user, null, 4));

        // Fetch study sets
        const getStudysetsCommand = new QueryCommand({
            TableName: mainTable,
            KeyConditionExpression: 'PK = :pk',
            ExpressionAttributeValues: { ':pk': `user#${userUUID}` },
        });
        const studysetResult = await docClient.send(getStudysetsCommand);
        const studysets = studysetResult.Items || [];

        // Write each studyset as a JSON file
        const studysetFiles: string[] = [];
        for (const studyset of studysets) {
            const studysetFileName = `studyset-${studyset.SK}.json`;
            const studysetPath = `/tmp/${studysetFileName}`;
            await writeFile(studysetPath, JSON.stringify(studyset, null, 4));
            studysetFiles.push(studysetPath);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Successfully duplicated study sets',
                // studyset: duplicatedStudyset,
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
