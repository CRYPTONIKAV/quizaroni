import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

// #132: publish runs the gate on the caller's own set, then writes the subject
// and the public-index keys in one conditional update.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let handler: (event: any, context: any) => Promise<APIGatewayProxyStructuredResultV2>;

const spySend = () => jest.spyOn(DynamoDBDocumentClient.prototype, "send");
let send: ReturnType<typeof spySend>;

const STUDYSET_UUID = "11111111-1111-4111-8111-111111111111";
const USER_UUID = "22222222-2222-4222-8222-222222222222";
const KEY = { PK: `userUUID#${USER_UUID}`, SK: `studyset#${STUDYSET_UUID}` };

const completeCard = (n: number) => ({ cardUUID: `c${n}`, term: `t${n}`, definition: `d${n}` });

const storedItem = (overrides: Record<string, unknown> = {}) => ({
    ...KEY,
    studysetUUID: STUDYSET_UUID,
    title: "Cell biology",
    metadata: { publiclyViewable: false },
    cards: [1, 2, 3, 4].map(completeCard),
    ...overrides,
});

beforeAll(() => {
    process.env.mainTable = "test-main";
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ({ handler } = require("../../service/lambdas/publishStudyset/src/publishStudyset"));
});

beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    send = spySend();
});

afterEach(() => {
    jest.restoreAllMocks();
});

const invoke = (body: unknown, username: string | undefined = "turtles") =>
    handler(
        {
            requestContext: {
                requestId: "req-1",
                authorizer: { lambda: { sub: USER_UUID, username } },
            },
            body: typeof body === "string" ? body : JSON.stringify(body),
        },
        {},
    );

const sentCommands = () => send.mock.calls.map(([command]) => command);
const sentUpdate = () => sentCommands().find((c) => c instanceof UpdateCommand) as UpdateCommand;
const bodyOf = (res: APIGatewayProxyStructuredResultV2) => JSON.parse(res.body ?? "");

describe("publishStudyset handler", () => {
    it("publishes the caller's set with the chosen subject", async () => {
        send.mockResolvedValueOnce({ Item: storedItem() } as never).mockResolvedValueOnce({
            Attributes: storedItem({
                subject: "science",
                PK2: "publicStudyset",
                SK2: `studyset#${STUDYSET_UUID}`,
                metadata: { publiclyViewable: true },
            }),
        } as never);

        const res = await invoke({ studysetUUID: STUDYSET_UUID, subject: "science" });

        expect(res.statusCode).toBe(200);
        const [get, update] = sentCommands();
        expect(get).toBeInstanceOf(GetCommand);
        expect((get as GetCommand).input.Key).toEqual(KEY);
        expect(update).toBeInstanceOf(UpdateCommand);
        const { input } = update as UpdateCommand;
        expect(input.TableName).toBe("test-main");
        expect(input.Key).toEqual(KEY);
        expect(input.ReturnValuesOnConditionCheckFailure).toBe("ALL_OLD");
        expect(input.ExpressionAttributeValues?.[":subject"]).toBe("science");
        expect(input.ExpressionAttributeValues?.[":username"]).toBe("turtles");

        const { studyset } = bodyOf(res);
        expect(studyset.subject).toBe("science");
        expect(studyset).not.toHaveProperty("PK2");
        expect(studyset).not.toHaveProperty("SK2");
    });

    it("rejects a set below the card gate without writing", async () => {
        send.mockResolvedValueOnce({ Item: storedItem({ cards: [1, 2].map(completeCard) }) } as never);

        const res = await invoke({ studysetUUID: STUDYSET_UUID, subject: "science" });

        expect(res.statusCode).toBe(400);
        expect(bodyOf(res).errors[0].code).toBe("notEnoughCards");
        expect(sentUpdate()).toBeUndefined();
    });

    it("refuses a hidden set without writing", async () => {
        send.mockResolvedValueOnce({
            Item: storedItem({ moderation: { hiddenAt: "2026-10-01T00:00:00.000Z" } }),
        } as never);

        const res = await invoke({ studysetUUID: STUDYSET_UUID, subject: "science" });

        expect(res.statusCode).toBe(400);
        expect(bodyOf(res).errors).toEqual([{ code: "hidden" }]);
        expect(sentUpdate()).toBeUndefined();
    });

    it("reports hidden when a takedown lands between the gate and the write", async () => {
        send.mockResolvedValueOnce({ Item: storedItem() } as never).mockRejectedValueOnce(
            Object.assign(new Error("conditional"), {
                name: "ConditionalCheckFailedException",
                Item: { PK: { S: KEY.PK } },
            }) as never,
        );

        const res = await invoke({ studysetUUID: STUDYSET_UUID, subject: "science" });

        expect(res.statusCode).toBe(400);
        expect(bodyOf(res).errors).toEqual([{ code: "hidden" }]);
    });

    it("404s when the set is deleted between the gate and the write", async () => {
        send.mockResolvedValueOnce({ Item: storedItem() } as never).mockRejectedValueOnce(
            Object.assign(new Error("conditional"), { name: "ConditionalCheckFailedException" }) as never,
        );

        const res = await invoke({ studysetUUID: STUDYSET_UUID, subject: "science" });

        expect(res.statusCode).toBe(404);
    });

    it("404s a set the caller doesn't own", async () => {
        send.mockResolvedValueOnce({} as never);

        const res = await invoke({ studysetUUID: STUDYSET_UUID, subject: "science" });

        expect(res.statusCode).toBe(404);
        expect(sentUpdate()).toBeUndefined();
    });

    it.each([["{not json"], [{ subject: "science" }]])("400s a body without a studysetUUID (%p)", async (body) => {
        const res = await invoke(body);

        expect(res.statusCode).toBe(400);
        expect(send).not.toHaveBeenCalled();
    });
});
