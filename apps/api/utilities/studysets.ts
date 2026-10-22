import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Studyset, Card, CardFileMetadata } from 'models/studysets';

type GetStudysetParams = {
    docClient: DynamoDBDocumentClient;
    mainTable: string;
    studysetUUID: string;
    userUUID: string;
};
export const getStudysetFromDynamo = async ({
    docClient,
    mainTable,
    studysetUUID,
    userUUID,
}: GetStudysetParams) => {
    const PK = `userUUID#${userUUID}`;
    const SK = `studyset#${studysetUUID}`;

    const getCommand = new GetCommand({
        Key: {
            PK,
            SK,
        },
        TableName: mainTable,
    });

    const { Item } = await docClient.send(getCommand);

    if (!Item) {
        throw new Error(
            `Studyset with UUID ${studysetUUID} for user ${userUUID} not found`
        );
    }

    return Item as Studyset;
};

const SIGNED_URL_EXPIRATION = 86400; // 24 hours in seconds

type RegenerateSignedUrlsParams = {
    s3Client: S3Client;
    bucket: string;
    studyset: Studyset;
};

/**
 * Regenerates signed URLs for all files in a studyset's cards.
 * This should be called when retrieving studysets to ensure URLs are fresh.
 */
export const regenerateSignedUrls = async ({
    s3Client,
    bucket,
    studyset,
}: RegenerateSignedUrlsParams): Promise<Studyset> => {
    if (!studyset.cards || studyset.cards.length === 0) {
        return studyset;
    }

    const updatedCards = await Promise.all(
        studyset.cards.map(async (card) => {
            if (!card.files || card.files.length === 0) {
                return card;
            }

            const updatedFiles = await Promise.all(
                card.files.map(async (file) => {
                    if (!file.key) {
                        return file;
                    }

                    try {
                        const getObjectCommand = new GetObjectCommand({
                            Bucket: bucket,
                            Key: file.key,
                        });
                        const signedURL = await getSignedUrl(
                            s3Client,
                            getObjectCommand,
                            { expiresIn: SIGNED_URL_EXPIRATION }
                        );
                        return { ...file, signedURL };
                    } catch (error) {
                        console.error(
                            `Failed to generate signed URL for key: ${file.key}`,
                            error
                        );
                        return file;
                    }
                })
            );

            return { ...card, files: updatedFiles };
        })
    );

    return { ...studyset, cards: updatedCards };
};

type RegenerateSignedUrlsForStudysetsParams = {
    s3Client: S3Client;
    bucket: string;
    studysets: Studyset[];
};

/**
 * Regenerates signed URLs for all files in multiple studysets.
 */
export const regenerateSignedUrlsForStudysets = async ({
    s3Client,
    bucket,
    studysets,
}: RegenerateSignedUrlsForStudysetsParams): Promise<Studyset[]> => {
    return Promise.all(
        studysets.map((studyset) =>
            regenerateSignedUrls({ s3Client, bucket, studyset })
        )
    );
};
