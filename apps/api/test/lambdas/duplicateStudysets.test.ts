import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { Studyset } from "models/studysets";
import { PUBLIC_STUDYSET_PK } from "resources/dynamo/publicSharing";
import { validatePublishRequest } from "utilities/publishStudyset";

// #125: both duplicate lambdas structuredClone'd the stored item, so a copy of
// a public set was written with the source's PK2/SK2 (pointing at the source's
// id), publiclyViewable and favorited.

type Handler = (event: unknown, context: unknown) => Promise<{ statusCode: number; body: string }>;

let duplicateStudyset: Handler;
let batchDuplicateStudysets: Handler;
let updateStudyset: Handler;

const spySend = () => jest.spyOn(DynamoDBDocumentClient.prototype, "send");

beforeAll(() => {
    process.env.mainTable = "test-main";
    process.env.mainBucket = "test-bucket";
    /* eslint-disable @typescript-eslint/no-var-requires */
    ({ handler: duplicateStudyset } = require("../../service/lambdas/duplicateStudyset/src/duplicateStudyset"));
    ({ handler: batchDuplicateStudysets } = require("../../service/lambdas/batchDuplicateStudysets/src/batchDuplicateStudysets"));
    ({ handler: updateStudyset } = require("../../service/lambdas/updateStudyset/src/updateStudyset"));
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

// #126: the copy kept these keys, so removing the image from the copy deleted
// the original's object.
const withPhoto = (uuid: string) => ({
    ...publicSource(uuid),
    cards: [
        {
            ...publicSource(uuid).cards[0],
            files: [
                { key: `${uuid}/u1/photo.png`, name: "photo.png", size: 1, signedURL: "https://x", association: "term" },
            ],
        },
    ],
});

// #169: a set taken down by scripts/unpublishStudyset.ts, with enough cards
// that `hidden` is the only reason publish could refuse a copy.
const HIDDEN_AT = "2026-10-16T00:00:00.000Z";
const hiddenSource = (uuid: string) => {
    const { PK2: _PK2, SK2: _SK2, ...source } = publicSource(uuid);
    return {
        ...source,
        metadata: { publiclyViewable: false, terminology: "Term" },
        moderation: { hiddenAt: HIDDEN_AT, reason: "spam" },
        cards: ["c1", "c2", "c3", "c4"].map((cardUUID) => ({ cardUUID, term: "t", definition: "d", notes: [] })),
    };
};

const expectUnpublishable = (item: Record<string, unknown>) => {
    expect(item.moderation).toEqual({ hiddenAt: HIDDEN_AT, reason: "spam" });
    expect(validatePublishRequest({ subject: "science", studyset: item as never, now: HIDDEN_AT })).toEqual({
        ok: false,
        errors: [{ code: "hidden" }],
    });
};

// Captures each Put item. The clone matters: duplicateStudyset runs removeKeys
// on the same object after the Put.
const fakeDynamo = (source: (uuid: string) => object = publicSource) => {
    const puts: Record<string, unknown>[] = [];
    spySend().mockImplementation((async (command: unknown) => {
        if (command instanceof GetCommand) {
            const sk = command.input.Key?.SK as string;
            return { Item: source(sk.replace("studyset#", "")) };
        }
        if (command instanceof PutCommand) {
            puts.push(structuredClone(command.input.Item) as Record<string, unknown>);
            return {};
        }
        throw new Error("unexpected command");
    }) as never);
    return puts;
};

const fakeS3 = (fail?: string) => {
    const copies: Record<string, unknown>[] = [];
    const deletes: Record<string, unknown>[] = [];
    jest.spyOn(S3Client.prototype, "send").mockImplementation((async (command: unknown) => {
        if (command instanceof CopyObjectCommand) {
            copies.push({ ...command.input });
            if (fail) throw Object.assign(new Error("x"), { name: fail });
            return {};
        }
        if (command instanceof DeleteObjectCommand) {
            deletes.push({ ...command.input });
            return {};
        }
        throw new Error("unexpected S3 command");
    }) as never);
    return { copies, deletes };
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

    it("copies images to the new set's prefix", async () => {
        const puts = fakeDynamo(withPhoto);
        const { copies } = fakeS3();

        const res = await invoke(duplicateStudyset, { studysetUUID: "src" });

        expect(res.statusCode).toBe(200);
        const copy = puts[0] as unknown as Studyset;
        const key = copy.cards[0].files[0].key;
        expect(key).toBe(`${copy.studysetUUID}/u1/photo.png`);
        expect(key).not.toBe("src/u1/photo.png");
        expect(copies).toEqual([{ Bucket: "test-bucket", CopySource: "test-bucket/src/u1/photo.png", Key: key }]);
    });

    it("does not write the set when an image copy fails", async () => {
        const puts = fakeDynamo(withPhoto);
        fakeS3("AccessDenied");

        const res = await invoke(duplicateStudyset, { studysetUUID: "src" });

        expect(res.statusCode).toBe(500);
        expect(puts).toHaveLength(0);
    });

    it("does no storage work for a set without images", async () => {
        fakeDynamo();
        const { copies, deletes } = fakeS3();

        const res = await invoke(duplicateStudyset, { studysetUUID: "src" });

        expect(res.statusCode).toBe(200);
        expect(copies).toHaveLength(0);
        expect(deletes).toHaveLength(0);
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

describe("batchDuplicateStudysets images", () => {
    it("copies each set's images under its own prefix", async () => {
        const puts = fakeDynamo(withPhoto);
        const { copies } = fakeS3();

        const res = await invoke(batchDuplicateStudysets, { studysetUUIDs: ["a", "b"] });

        expect(res.statusCode).toBe(200);
        expect(puts).toHaveLength(2);
        for (const put of puts) {
            const copy = put as unknown as Studyset;
            expect(copy.cards[0].files[0].key).toBe(`${copy.studysetUUID}/u1/photo.png`);
        }
        expect(copies).toHaveLength(2);
        expect(new Set(copies.map((c) => c.Key)).size).toBe(2);
    });
});

describe("duplicating a hidden set (#169)", () => {
    it("single duplicate writes a copy publish refuses", async () => {
        const puts = fakeDynamo(hiddenSource);

        const res = await invoke(duplicateStudyset, { studysetUUID: "src" });

        expect(res.statusCode).toBe(200);
        expect(puts).toHaveLength(1);
        expectUnpublishable(puts[0]);
    });

    it("batch duplicate writes copies publish refuses", async () => {
        const puts = fakeDynamo(hiddenSource);

        const res = await invoke(batchDuplicateStudysets, { studysetUUIDs: ["a", "b"] });

        expect(res.statusCode).toBe(200);
        expect(puts).toHaveLength(2);
        for (const put of puts) {
            expectUnpublishable(put);
        }
    });
});

describe("duplicate then remove an image", () => {
    it("removing an image from the copy leaves the original's object alone", async () => {
        const puts = fakeDynamo(withPhoto);
        const { deletes } = fakeS3();
        await invoke(duplicateStudyset, { studysetUUID: "src" });
        const copy = puts[0] as unknown as Studyset;

        spySend().mockImplementation((async (command: unknown) => {
            if (command instanceof GetCommand) return { Item: structuredClone(copy) };
            if (command instanceof UpdateCommand) return {};
            throw new Error("unexpected command");
        }) as never);

        const res = await invoke(updateStudyset, {
            studysetUUID: copy.studysetUUID,
            updates: { cards: copy.cards.map((c) => ({ ...c, files: [] })) },
        });

        expect(res.statusCode).toBe(200);
        expect(deletes).toEqual([{ Bucket: "test-bucket", Key: copy.cards[0].files[0].key }]);
        expect(deletes.map((d) => d.Key)).not.toContain("src/u1/photo.png");
    });
});
