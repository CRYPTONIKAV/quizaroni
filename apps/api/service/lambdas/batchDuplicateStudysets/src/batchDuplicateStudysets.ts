import {
    APIGatewayProxyEventV2WithLambdaAuthorizer,
    APIGatewayProxyResultV2,
    Handler,
} from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { AuthorizerContext } from 'models/auth';
import { removeKeys } from 'resources/dynamo/utilities';
import { Studyset } from 'models/studysets';
import { buildDuplicate } from 'utilities/duplicateStudyset';
import { copyCardFiles } from 'utilities/cardFiles';
import { logRequest } from 'utilities/logging';

const { mainTable = '', mainBucket = '' } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const s3Client = new S3Client({});

type RequestBody = {
    studysetUUIDs: string[];
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

        const { studysetUUIDs } = body;

        const duplicateStudysetPromises = studysetUUIDs.map((studysetUUID) =>
            duplicateIndividualStudyset({ studysetUUID, username, userUUID })
        );

        const results = await Promise.allSettled(duplicateStudysetPromises);
        results.forEach((result, i) => {
            if (result.status === 'rejected') {
                console.error(
                    `Failed to duplicate studyset ${studysetUUIDs[i]}:`,
                    result.reason
                );
            }
        });

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

type DuplicateIndividualStudysetParams = {
    studysetUUID: string;
    username: string;
    userUUID: string;
};
const duplicateIndividualStudyset = async ({
    studysetUUID,
    username,
    userUUID,
}: DuplicateIndividualStudysetParams) => {
    const getCommand = new GetCommand({
        Key: {
            PK: `userUUID#${userUUID}`,
            SK: `studyset#${studysetUUID}`,
        },
        TableName: mainTable,
    });
    const { Item } = await docClient.send(getCommand);

    if (!Item) {
        throw new Error(
            `Studyset with UUID ${studysetUUID} for user ${username} not found`
        );
    }

    const studyset = Item as Studyset;

    const newStudysetUUID = randomUUID();
    const timestamp = new Date().toISOString();

    const duplicatedStudyset = buildDuplicate(
        studyset,
        newStudysetUUID,
        timestamp
    );
    duplicatedStudyset.cards = await copyCardFiles({
        s3Client,
        bucket: mainBucket,
        cards: duplicatedStudyset.cards,
        studysetUUID: newStudysetUUID,
        ownerUUID: userUUID,
    });

    const putCommand = new PutCommand({
        TableName: mainTable,
        Item: duplicatedStudyset,
    });

    await docClient.send(putCommand);
};
