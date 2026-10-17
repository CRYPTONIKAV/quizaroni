import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { PUBLIC_STUDYSET_PK } from "resources/dynamo/publicSharing";

// #125: both duplicate lambdas structuredClone'd the stored item, so a copy of
// a public set was written with the source's PK2/SK2 (pointing at the source's
// id), publiclyViewable and favorited.

type Handler = (event: unknown, context: unknown) => Promise<{ statusCode: number; body: string }>;

let duplicateStudyset: Handler;
let batchDuplicateStudysets: Handler;

const spySend = () => jest.spyOn(DynamoDBDocumentClient.prototype, "send");

beforeAll(() => {
    process.env.mainTable = "test-main";
    /* eslint-disable @typescript-eslint/no-var-requires */
    ({ handler: duplicateStudyset } = require("../../service/lambdas/duplicateStudyset/src/duplicateStudyset"));
    ({ handler: batchDuplicateStudysets } = require("../../service/lambdas/batchDuplicateStudysets/src/batchDuplicateStudysets"));
    /* eslint-enable @typescript-eslint/no-var-requires */
});

beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

const publicSource = (uuid: string) => ({
    PK: "userUUID#u1",
    SK: `studyset#${uuid}`,
    PK2: PUBLIC_STUDYSET_PK,
    SK2: `studyset#${uuid}`,
    userUUID: "u1",
    studysetUUID: uuid,
    username: "turtles",
    title: "Cell biology",
    description: "",
    labels: [],
    categories: [],
    favorited: true,
    lastViewed: "2026-10-14T00:00:00.000Z",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-15T00:00:00.000Z",
    metadata: { publiclyViewable: true, terminology: "Term" },
    cards: [{ cardUUID: "c1", term: "t", definition: "d", notes: [{ noteUUID: "n1", text: "x" }] }],
});

// Captures each Put item. The clone matters: duplicateStudyset runs removeKeys
// on the same object after the Put.
const fakeDynamo = () => {
    const puts: Record<string, unknown>[] = [];
    spySend().mockImplementation((async (command: unknown) => {
        if (command instanceof GetCommand) {
            const sk = command.input.Key?.SK as string;
            return { Item: publicSource(sk.replace("studyset#", "")) };
        }
        if (command instanceof PutCommand) {
            puts.push(structuredClone(command.input.Item) as Record<string, unknown>);
            return {};
        }
        throw new Error("unexpected command");
    }) as never);
    return puts;
};

const invoke = (handler: Handler, body: unknown) =>
    handler(
        {
            requestContext: { authorizer: { lambda: { sub: "u1", username: "turtles" } } },
            body: JSON.stringify(body),
        },
        {}
    );

const expectPrivateCopy = (item: Record<string, unknown>, sourceUUID: string) => {
    expect(item).not.toHaveProperty("PK2");
    expect(item).not.toHaveProperty("SK2");
    expect((item.metadata as { publiclyViewable: boolean }).publiclyViewable).toBe(false);
    expect(item.favorited).toBe(false);
    expect(item.studysetUUID).not.toBe(sourceUUID);
    expect(item.SK).toBe(`studyset#${item.studysetUUID}`);
};

describe("duplicateStudyset", () => {
    it("writes a private copy without public-index keys", async () => {
        const puts = fakeDynamo();

        const res = await invoke(duplicateStudyset, { studysetUUID: "src" });

        expect(res.statusCode).toBe(200);
        expect(puts).toHaveLength(1);
        expectPrivateCopy(puts[0], "src");
        const { studyset } = JSON.parse(res.body);
        for (const key of ["PK", "SK", "PK2", "SK2"]) {
            expect(studyset).not.toHaveProperty(key);
        }
    });
});

describe("batchDuplicateStudysets", () => {
    it("writes a private copy of each set", async () => {
        const puts = fakeDynamo();

        const res = await invoke(batchDuplicateStudysets, { studysetUUIDs: ["a", "b"] });

        expect(res.statusCode).toBe(200);
        expect(puts).toHaveLength(2);
        expectPrivateCopy(puts[0], "a");
        expectPrivateCopy(puts[1], "b");
        expect(puts[0].studysetUUID).not.toBe(puts[1].studysetUUID);
    });
});
