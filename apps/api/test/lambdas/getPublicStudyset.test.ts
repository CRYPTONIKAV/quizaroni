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
});
