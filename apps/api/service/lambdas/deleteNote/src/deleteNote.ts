import {
    APIGatewayProxyEventV2WithLambdaAuthorizer,
    APIGatewayProxyResultV2,
    Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    GetCommand,
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { AuthorizerContext } from "models/auth";
import { Studyset } from "models/studysets";
import { logRequest } from "utilities/logging";

const { mainTable = "" } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

type RequestBody = {
    cardUUID: string;
    noteUUID: string;
    studysetUUID: string;
};

export const handler: Handler = async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
    context
): Promise<APIGatewayProxyResultV2> => {
    logRequest(event);

    const { sub: userUUID, username } = event.requestContext.authorizer.lambda;
    const body: RequestBody = JSON.parse(event.body ?? "{}");

    const { cardUUID, noteUUID, studysetUUID } = body;

    try {
        const PK = `userUUID#${userUUID}`;
        const SK = `studyset#${studysetUUID}`;
        const updatedAt = new Date().toISOString();

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
                `Studyset with UUID ${studysetUUID} for user ${username} not found`
            );
        }
        const studyset = Item as Studyset;

        const { cards } = studyset;

        const newCards = cards.map((card) => {
            const { notes } = card;
            if (card.cardUUID === cardUUID) {
                card.notes = notes.filter((note) => note.noteUUID !== noteUUID)
            }
            return card;
        });

        const deleteNoteCommand = new UpdateCommand({
            TableName: mainTable,
            Key: {
                PK,
                SK,
            },
            ExpressionAttributeValues: {
                ":newCards": newCards,
                ":updatedAt": updatedAt,
                ":updatedBy": username,
            },
            UpdateExpression:
                "SET cards = :newCards, updatedAt = :updatedAt, updatedBy = :updatedBy",
        });
        await docClient.send(deleteNoteCommand);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Successfully deleted note",
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
