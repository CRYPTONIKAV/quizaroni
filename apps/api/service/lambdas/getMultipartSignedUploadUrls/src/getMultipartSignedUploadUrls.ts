import {
    APIGatewayProxyEventV2WithLambdaAuthorizer,
    APIGatewayProxyResultV2,
    Handler,
} from "aws-lambda";
import { S3Client, GetObjectCommand, UploadPartCommand, UploadPartCommandInput } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AuthorizerContext } from "models/auth";
import { logRequest } from "utilities/logging";

const { mainBucket = "" } = process.env;

const s3Client = new S3Client();

type RequestBody = {
    key: string;
    uploadId: string;
    numParts: number;
};

export const handler: Handler = async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
    context
): Promise<APIGatewayProxyResultV2> => {
    logRequest(event);

    const { sub: userUUID, username } = event.requestContext.authorizer.lambda
    const body: RequestBody = JSON.parse(event.body ?? "{}");

    const { key, uploadId, numParts, } = body;

    try {
        const promises: Promise<string>[] = [];
        for (let index = 0; index < numParts; index++) {
            const uploadPartCommand = new UploadPartCommand({
                Bucket: mainBucket,
                Key: key,
                UploadId: uploadId,
                PartNumber: index + 1
            })

            promises.push(
                getSignedUrl(s3Client, uploadPartCommand, {
                    expiresIn: 3600 // One hour in seconds
                })
            )
        }

        const uploadPartsResult = await Promise.all(promises);
        const signedURLs = uploadPartsResult.reduce((map: Record<number, string> , part, index) => {
            map[index] = part;
            return map;
        }, {})

        return {
            statusCode: 200,
            body: JSON.stringify({
                signedURLs
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
