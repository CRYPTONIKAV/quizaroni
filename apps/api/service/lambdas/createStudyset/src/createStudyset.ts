import {
    APIGatewayProxyEventV2WithLambdaAuthorizer,
    APIGatewayProxyResultV2,
    Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { AuthorizerContext } from "models/auth";
import { StudysetMetadata } from "models/studysets";
import { removeKeys } from "resources/dynamo/utilities";
import { logRequest } from "utilities/logging";

const { mainTable = "" } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

type RequestBody = {
    studysetUUID: string;
};

export const handler: Handler = async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
    context
): Promise<APIGatewayProxyResultV2> => {
    logRequest(event);

    const { sub: userUUID, username } = event.requestContext.authorizer.lambda
    // const body: RequestBody = JSON.parse(event.body ?? "{}");

    try {
        const studysetUUID = randomUUID();
        const timestamp = new Date().toISOString();
        const initialMetadata: StudysetMetadata = {
            backgroundColorVisible: false,
            cardCountVisible: true,
            contentOnly: false,
            customLabelTerminology: "",
            customTerminology: "",
            labelTerminology: "Card",
            notesDrawerInitial: "open",
            notesDrawerPosition: "right",
            publiclyViewable: false,
            terminology: "Term/Definition",
            textColorVisible: false,
        }
        const initialStudySet = {
            PK: `userUUID#${userUUID}`,
            SK: `studyset#${studysetUUID}`,
            cards: [],
            categories: [],
            createdAt: timestamp,
            description: "",
            favorited: false,
            labels: [],
            lastViewed: timestamp,
            metadata: initialMetadata,
            updatedAt: timestamp,
            studysetUUID,
            title: "Untitled Studyset",
            username,
            userUUID,
        }

        const putCommand = new PutCommand({
            TableName: mainTable,
            Item: initialStudySet
        })

        await docClient.send(putCommand);

        removeKeys(initialStudySet);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Successfully created study set",
                studyset: initialStudySet,
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
