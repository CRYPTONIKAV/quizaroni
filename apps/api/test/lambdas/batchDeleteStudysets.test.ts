import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// #179 removed the full BatchWrite response log. It was the only trace of
// keys DynamoDB left unprocessed, so those keys (and only those) are still
// logged.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let handler: (event: any, context: any) => Promise<{ statusCode: number; body: string }>;

beforeAll(() => {
    process.env.mainTable = "test-main";
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ({ handler } = require("lambdas/batchDeleteStudysets/src/batchDeleteStudysets"));
});

beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

const invoke = () =>
    handler(
        {
            requestContext: { authorizer: { lambda: { sub: "u1", username: "turtles" } } },
            body: JSON.stringify({ studysetUUIDs: ["s1", "s2"] }),
        },
        {}
    );

describe("batchDeleteStudysets", () => {
    it("logs the keys DynamoDB left unprocessed", async () => {
        jest.spyOn(DynamoDBDocumentClient.prototype, "send").mockResolvedValue({
            UnprocessedItems: {
                "test-main": [
                    { DeleteRequest: { Key: { PK: "userUUID#u1", SK: "studyset#s2" } } },
                ],
            },
        } as never);

        await invoke();

        expect(console.error).toHaveBeenCalledWith(
            JSON.stringify({
                unprocessedKeys: [{ PK: "userUUID#u1", SK: "studyset#s2" }],
            })
        );
    });

    it("logs nothing as an error when every delete is processed", async () => {
        jest.spyOn(DynamoDBDocumentClient.prototype, "send").mockResolvedValue({
            UnprocessedItems: {},
        } as never);

        const { statusCode } = await invoke();

        expect(statusCode).toBe(200);
        expect(console.error).not.toHaveBeenCalled();
    });
});
