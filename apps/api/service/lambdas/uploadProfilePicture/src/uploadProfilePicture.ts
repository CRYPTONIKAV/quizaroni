import {
    APIGatewayProxyEventV2WithLambdaAuthorizer,
    APIGatewayProxyResultV2,
    Handler,
} from 'aws-lambda';
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AuthorizerContext } from 'models/auth';
import { logRequest } from 'utilities/logging';

const { mainBucket = '' } = process.env;

// AWS_REGION is injected automatically into the Lambda runtime.
const s3Client = new S3Client({ region: process.env.AWS_REGION });

type RequestBody = {
    imageData: string; // base64 encoded
    fileName: string;
    contentType: string;
};

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export const handler: Handler = async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
    context
): Promise<APIGatewayProxyResultV2> => {
    logRequest(event);

    const { sub: userUUID } = event.requestContext.authorizer.lambda;

    try {
        const body: RequestBody = JSON.parse(event.body ?? '{}');
        const { imageData, fileName, contentType } = body;

        // Validate content type
        if (!ALLOWED_TYPES.includes(contentType)) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message:
                        'Invalid content type. Only PNG, JPEG, and WebP are allowed.',
                }),
            };
        }

        // Decode base64 and validate size
        const imageBuffer = Buffer.from(imageData, 'base64');
        if (imageBuffer.length > MAX_SIZE_BYTES) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: 'Image size exceeds 2MB limit',
                }),
            };
        }

        // Generate unique key
        const timestamp = Date.now();
        const extension = contentType.split('/')[1]; // png, jpeg, webp
        const key = `profile-pictures/${userUUID}/${timestamp}.${extension}`;

        // Upload to S3
        const putCommand = new PutObjectCommand({
            Bucket: mainBucket,
            Key: key,
            Body: imageBuffer,
            ContentType: contentType,
            Metadata: {
                userUUID,
                uploadedAt: new Date().toISOString(),
            },
        });

        await s3Client.send(putCommand);

        // Generate presigned URL (valid for 7 days)
        const getCommand = new GetObjectCommand({
            Bucket: mainBucket,
            Key: key,
        });
        const signedUrl = await getSignedUrl(s3Client, getCommand, {
            expiresIn: 604800, // 7 days
        });

        console.log(`Successfully uploaded profile picture: ${key}`);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Profile picture uploaded successfully',
                url: signedUrl,
            }),
        };
    } catch (err) {
        console.error('Upload error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Error uploading profile picture',
                error: err instanceof Error ? err.message : 'Unknown error',
            }),
        };
    }
};
