import {
    APIGatewayProxyEventV2WithLambdaAuthorizer,
    APIGatewayProxyResultV2,
    Handler,
} from "aws-lambda";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { AuthorizerContext } from "models/auth";
import { logRequest } from "utilities/logging";

const { mainBucket = "" } = process.env;

const s3Client = new S3Client();

type RequestBody = {
    key: string;
};

export const handler: Handler = async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
    context
): Promise<APIGatewayProxyResultV2> => {
    logRequest(event);

    const body: RequestBody = JSON.parse(event.body ?? "{}");
    
    const { key } = body;    

    try {

        const deleteCommand = new DeleteObjectCommand({
            Bucket: mainBucket,
            Key: key,
        })
        const deleteResponse = await s3Client.send(deleteCommand);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Successfully deleted file",
            }),
        };
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Error deleting file",
            }),
        };
    }
};
