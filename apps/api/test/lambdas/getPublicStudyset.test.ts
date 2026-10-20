import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { PUBLIC_STUDYSET_PK } from "resources/dynamo/publicSharing";

// #128: the handler used to strip a few keys and return the rest of the stored
// set. It must now return only the allowlist from toPublicStudyset.

jest.mock("@aws-sdk/s3-request-presigner", () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getSignedUrl: jest.fn(async (_client: unknown, cmd: any) => `https://signed.example/${cmd.input.Key}`),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let handler: (event: any, context: any) => Promise<APIGatewayProxyStructuredResultV2>;

const spySend = () => jest.spyOn(DynamoDBDocumentClient.prototype, "send");
let send: ReturnType<typeof spySend>;

const STUDYSET_UUID = "11111111-1111-4111-8111-111111111111";
const USER_UUID = "22222222-2222-4222-8222-222222222222";
const KEY = `${STUDYSET_UUID}/${USER_UUID}/photo.png`;

const storedItem = {
    PK: `userUUID#${USER_UUID}`,
    SK: `studyset#${STUDYSET_UUID}`,
    PK2: PUBLIC_STUDYSET_PK,
    SK2: `studyset#${STUDYSET_UUID}`,
    userUUID: USER_UUID,
    studysetUUID: STUDYSET_UUID,
    username: "turtles",
    title: "Cell biology",
    description: "Organelles",
    labels: ["Private folder"],
    categories: ["Secret category"],
    favorited: true,
    lastViewed: "2026-10-14T00:00:00.000Z",
    updatedBy: "turtles",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-15T00:00:00.000Z",
    metadata: { publiclyViewable: true },
    cards: [
        {
            cardUUID: "c1",
            term: "Mitochondria",
            definition: "Powerhouse of the cell",
            notes: [{ noteUUID: "n1", text: "My private note" }],
            categories: [],
            important: false,
            files: [
                {
                    key: KEY,
                    name: "photo.png",
                    size: 1234,
                    association: "term",
                    signedURL: "https://stale.example/old",
                },
            ],
        },
    ],
};

beforeAll(() => {
    process.env.mainTable = "test-main";
    process.env.mainBucket = "test-bucket";
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ({ handler } = require("../../service/lambdas/getPublicStudyset/src/getPublicStudyset"));
});

beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    send = spySend();
});

afterEach(() => {
    jest.restoreAllMocks();
});

const invoke = () => handler({ pathParameters: { studysetUUID: STUDYSET_UUID } }, {});

describe("getPublicStudyset handler", () => {
    it("returns only public fields, with freshly signed image URLs", async () => {
        send.mockResolvedValueOnce({ Items: [storedItem] } as never);

        const res = await invoke();

        expect(res.statusCode).toBe(200);
        expect(res.headers?.["Cache-Control"]).toBe("public, max-age=60, s-maxage=300");
        expect(JSON.parse(res.body ?? "").studyset).toEqual({
            title: "Cell biology",
            description: "Organelles",
            username: "turtles",
            subject: null,
            publishedAt: null,
            updatedAt: "2026-10-15T00:00:00.000Z",
            cards: [
                {
                    term: "Mitochondria",
                    definition: "Powerhouse of the cell",
                    files: [{ association: "term", signedURL: `https://signed.example/${KEY}` }],
                },
            ],
        });
    });

    it("still 404s a set whose publiclyViewable flag is false", async () => {
        send.mockResolvedValueOnce({
            Items: [{ ...storedItem, metadata: { ...storedItem.metadata, publiclyViewable: false } }],
        } as never);

        const res = await invoke();

        expect(res.statusCode).toBe(404);
    });

    // #171: duplicates made before #125 kept their source's SK2, so the index
    // can hold another set's row under this id.
    it("serves the set's own row, not a copy that inherited its index key", async () => {
        const copy = {
            ...storedItem,
            PK: "userUUID#someone-else",
            SK: "studyset#copy",
            studysetUUID: "copy",
            title: "Copied title",
        };
        send.mockResolvedValueOnce({ Items: [copy, storedItem] } as never);

        const res = await invoke();

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body ?? "").studyset.title).toBe("Cell biology");
        const query = send.mock.calls[0][0] as unknown as { input: { Limit?: number } };
        expect(query.input.Limit).toBeUndefined();
    });

    it("pages past copies that fill the first page", async () => {
        send.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { PK2: "x" } } as never)
            .mockResolvedValueOnce({ Items: [storedItem] } as never);

        const res = await invoke();

        expect(res.statusCode).toBe(200);
        expect(send).toHaveBeenCalledTimes(2);
        type QueryInput = { input: { FilterExpression?: string; ExclusiveStartKey?: unknown } };
        const [first, second] = send.mock.calls.map(([cmd]) => cmd as unknown as QueryInput);
        expect(first.input.FilterExpression).toBe("SK = SK2");
        expect(second.input.ExclusiveStartKey).toEqual({ PK2: "x" });
    });

    it("404s when only a copy is left under the set's index key", async () => {
        send.mockResolvedValueOnce({
            Items: [{ ...storedItem, PK: "userUUID#someone-else", SK: "studyset#copy" }],
        } as never);

        const res = await invoke();

        expect(res.statusCode).toBe(404);
    });

    it("404s a set hidden by moderation", async () => {
        send.mockResolvedValueOnce({
            Items: [{ ...storedItem, moderation: { hiddenAt: "2026-10-16T00:00:00.000Z" } }],
        } as never);

        const res = await invoke();

        expect(res.statusCode).toBe(404);
    });
});
