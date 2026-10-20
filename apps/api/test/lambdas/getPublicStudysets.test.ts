import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

// #132: the sitemap list must apply the same rule as the public set endpoint,
// so it never lists a hidden or unflagged set whose link would 404.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let handler: (event: any, context: any) => Promise<APIGatewayProxyStructuredResultV2>;

const spySend = () => jest.spyOn(DynamoDBDocumentClient.prototype, "send");
let send: ReturnType<typeof spySend>;

type Item = Record<string, unknown>;

// Mimics DynamoDB: only the projected paths come back, so a projection that
// forgets an attribute the filter needs makes the test fail.
const project = (item: Item, projection: string, names: Record<string, string> = {}): Item => {
    const out: Item = {};
    for (const rawPath of projection.split(",").map((p) => p.trim())) {
        const segments = rawPath.split(".").map((s) => names[s] ?? s);
        let source: unknown = item;
        for (const segment of segments) {
            source = (source as Item | undefined)?.[segment];
        }
        if (source === undefined) continue;
        let target = out;
        segments.slice(0, -1).forEach((segment) => {
            target[segment] = (target[segment] as Item | undefined) ?? {};
            target = target[segment] as Item;
        });
        target[segments[segments.length - 1]] = source;
    }
    return out;
};

const stored = (id: string, extra: Item = {}): Item => ({
    PK: `userUUID#u-${id}`,
    SK: `studyset#${id}`,
    PK2: "publicStudyset",
    SK2: `studyset#${id}`,
    studysetUUID: id,
    title: `Set ${id}`,
    updatedAt: "2026-10-15T00:00:00.000Z",
    metadata: { publiclyViewable: true, terminology: "Term" },
    cards: [],
    ...extra,
});

beforeAll(() => {
    process.env.mainTable = "test-main";
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ({ handler } = require("../../service/lambdas/getPublicStudysets/src/getPublicStudysets"));
});

beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    send = spySend();
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("getPublicStudysets handler", () => {
    it("lists only sets that are flagged public and not hidden", async () => {
        const items = [
            stored("visible"),
            stored("hidden", { moderation: { hiddenAt: "2026-10-16T00:00:00.000Z" } }),
            stored("flag-off", { metadata: { publiclyViewable: false } }),
            // #171: a pre-#125 copy indexed under another set's key.
            stored("copy", { SK2: "studyset#visible" }),
        ];
        send.mockImplementation((async (command: QueryCommand) => {
            const { ProjectionExpression = "", ExpressionAttributeNames } = command.input;
            return { Items: items.map((item) => project(item, ProjectionExpression, ExpressionAttributeNames)) };
        }) as never);

        const res = await handler({}, {});

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body ?? "").studysets).toEqual([
            { studysetUUID: "visible", title: "Set visible", updatedAt: "2026-10-15T00:00:00.000Z" },
        ]);
    });
});
