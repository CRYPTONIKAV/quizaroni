import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

// #132: unpublish takes the caller's set off the public index.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let handler: (event: any, context: any) => Promise<APIGatewayProxyStructuredResultV2>;

const spySend = () => jest.spyOn(DynamoDBDocumentClient.prototype, "send");
let send: ReturnType<typeof spySend>;

const STUDYSET_UUID = "11111111-1111-4111-8111-111111111111";
const USER_UUID = "22222222-2222-4222-8222-222222222222";
const KEY = { PK: `userUUID#${USER_UUID}`, SK: `studyset#${STUDYSET_UUID}` };

beforeAll(() => {
    process.env.mainTable = "test-main";
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ({ handler } = require("../../service/lambdas/unpublishStudyset/src/unpublishStudyset"));
});

beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    send = spySend();
});

afterEach(() => {
    jest.restoreAllMocks();
});

const invoke = (body: unknown) =>
    handler(
        {
            requestContext: {
                requestId: "req-1",
                authorizer: { lambda: { sub: USER_UUID, username: "turtles" } },
            },
            body: JSON.stringify(body),
        },
        {},
    );

describe("unpublishStudyset handler", () => {
    it("removes the caller's set from the public index", async () => {
        send.mockResolvedValueOnce({
            Attributes: { ...KEY, studysetUUID: STUDYSET_UUID, metadata: { publiclyViewable: false } },
        } as never);

        const res = await invoke({ studysetUUID: STUDYSET_UUID });

        expect(res.statusCode).toBe(200);
        const [command] = send.mock.calls[0];
        expect(command).toBeInstanceOf(UpdateCommand);
        const { input } = command as UpdateCommand;
        expect(input.TableName).toBe("test-main");
        expect(input.Key).toEqual(KEY);
        expect(input.UpdateExpression).toContain("REMOVE #PK2, #SK2");
        expect(input.ExpressionAttributeValues?.[":false"]).toBe(false);
        expect(JSON.parse(res.body ?? "").studyset).not.toHaveProperty("PK");
    });

    it("404s when the caller has no such set", async () => {
        send.mockRejectedValueOnce(
            Object.assign(new Error("conditional"), { name: "ConditionalCheckFailedException" }) as never,
        );

        const res = await invoke({ studysetUUID: STUDYSET_UUID });

        expect(res.statusCode).toBe(404);
    });

    it("400s a body without a studysetUUID", async () => {
        const res = await invoke({});

        expect(res.statusCode).toBe(400);
        expect(send).not.toHaveBeenCalled();
    });
});
