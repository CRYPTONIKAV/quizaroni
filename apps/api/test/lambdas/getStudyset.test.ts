import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

// #133: a set that isn't in the caller's library used to throw into the catch
// and come back as a 500. The web falls back to the public view on a 404.

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
const PK = `userUUID#${USER_UUID}`;
const SK = `studyset#${STUDYSET_UUID}`;

const ownedItem = {
    PK,
    SK,
    userUUID: USER_UUID,
    studysetUUID: STUDYSET_UUID,
    username: "turtles",
    title: "Cell biology",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-15T00:00:00.000Z",
    cards: [
        {
            cardUUID: "c1",
            term: "Mitochondria",
            definition: "Powerhouse of the cell",
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
    ({ handler } = require("../../service/lambdas/getStudyset/src/getStudyset"));
});

beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    send = spySend();
});

afterEach(() => {
    jest.restoreAllMocks();
});

const invoke = (studysetUUID = STUDYSET_UUID) =>
    handler(
        {
            requestContext: { authorizer: { lambda: { sub: USER_UUID, username: "turtles" } } },
            body: JSON.stringify({ studysetUUID }),
        },
        {}
    );

describe("getStudyset handler", () => {
    it("returns 404 when the set isn't in the caller's library", async () => {
        send.mockResolvedValueOnce({} as never);

        const res = await invoke();

        expect(res.statusCode).toBe(404);
        const get = send.mock.calls[0][0] as unknown as { input: Record<string, unknown> };
        expect(get.input).toMatchObject({ Key: { PK, SK }, ConsistentRead: true });
    });

    it("returns 404 for an upsert stub left under that id", async () => {
        send.mockResolvedValueOnce({
            Item: { PK, SK, lastViewed: "2026-10-14T00:00:00.000Z", updatedAt: "2026-10-14T00:00:00.000Z", updatedBy: "turtles" },
        } as never);

        const res = await invoke();

        expect(res.statusCode).toBe(404);
    });

    it("returns 404 for a labelled row with no studysetUUID", async () => {
        send.mockResolvedValueOnce({
            Item: { PK, SK, labels: ["bio"], updatedAt: "2026-10-14T00:00:00.000Z" },
        } as never);

        const res = await invoke();

        expect(res.statusCode).toBe(404);
    });

    it("returns the owned set without keys, with fresh signed URLs", async () => {
        send.mockResolvedValueOnce({ Item: structuredClone(ownedItem) } as never);

        const res = await invoke();

        expect(res.statusCode).toBe(200);
        const { studyset } = JSON.parse(res.body ?? "");
        expect(studyset.PK).toBeUndefined();
        expect(studyset.SK).toBeUndefined();
        expect(studyset.studysetUUID).toBe(STUDYSET_UUID);
        expect(studyset.cards[0].files[0].signedURL).toBe(`https://signed.example/${KEY}`);
    });

    it("returns 500 when DynamoDB fails", async () => {
        send.mockRejectedValueOnce(new Error("boom") as never);

        const res = await invoke();

        expect(res.statusCode).toBe(500);
    });
});
