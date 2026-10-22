import {
    APIGatewayProxyEventV2WithLambdaAuthorizer,
    APIGatewayProxyResultV2,
    Handler,
} from 'aws-lambda';
import {
    S3Client,
    CompleteMultipartUploadCommand,
    CompletedPart,
    HeadObjectCommand,
    GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AuthorizerContext } from 'models/auth';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getStudysetFromDynamo } from 'utilities/studysets';
import { logRequest } from 'utilities/logging';

const { mainBucket = '', mainTable = '' } = process.env;

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client();

type RequestBody = {
    association?: 'term' | 'definition';
    cardUUID?: string;
    key: string;
    parts: CompletedPart[];
    studysetUUID?: string;
    uploadId: string;
};

export const handler: Handler = async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
    context
): Promise<APIGatewayProxyResultV2> => {
    logRequest(event);

    const { sub: userUUID, username } = event.requestContext.authorizer.lambda;
    const body: RequestBody = JSON.parse(event.body ?? '{}');
    
    const { association, cardUUID, key, parts, studysetUUID, uploadId } = body;

    try {
        const completeMultipartUploadCommand =
            new CompleteMultipartUploadCommand({
                Bucket: mainBucket,
                Key: key,
                UploadId: uploadId,
                MultipartUpload: {
                    Parts: parts,
                },
            });
        const completeMultipartUploadResponse = await s3Client.send(
            completeMultipartUploadCommand
        );

        // Getting file metadata
        const splitKey = key.split('/');
        const fileName = splitKey[splitKey.length - 1];
        const headObjectCommand = new HeadObjectCommand({
            Bucket: mainBucket,
            Key: key,
        });
        const s3HeadObject = await s3Client.send(headObjectCommand);
        const fileSize = s3HeadObject.ContentLength || 0;
        const getObjectCommand = new GetObjectCommand({
            Bucket: mainBucket,
            Key: key,
        });
        const signedURL = await getSignedUrl(s3Client, getObjectCommand, {
            expiresIn: 86400, // One day in seconds
        });

        const fileMetadata = {
            name: fileName,
            key,
            size: fileSize,
            signedURL,
            uploadedAt: new Date().toISOString(),
        };

        if (studysetUUID) {
            const PK = `userUUID#${userUUID}`;
            const SK = `studyset#${studysetUUID}`;
            const updatedAt = new Date().toISOString();

            const studyset = await getStudysetFromDynamo({
                docClient,
                mainTable,
                studysetUUID,
                userUUID,
            });

            let newCards = studyset.cards;
            if (cardUUID && association) {
                newCards = newCards.map((card) => {
                    if (card.cardUUID === cardUUID) {
                        const files = card.files ?? [];
                        const cardFileMetadata = {
                            ...fileMetadata,
                            association,
                        };

                        return {
                            ...card,
                            files: [...files, cardFileMetadata],
                        };
                    }
                    return card;
                });
            }

            const updateCommand = new UpdateCommand({
                TableName: mainTable,
                Key: {
                    PK,
                    SK,
                },
                ExpressionAttributeValues: {
                    ":newCards": newCards,
                    ':updatedAt': updatedAt,
                    ':updatedBy': username,
                },
                UpdateExpression:
                    'SET cards = :newCards, updatedAt = :updatedAt, updatedBy = :updatedBy',
            });
            await docClient.send(updateCommand);
        }

        return {
            statusCode: 200,
            body: JSON.stringify(fileMetadata),
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
