import { S3Client, CopyObjectCommand } from "@aws-sdk/client-s3";
import type { Card, CardFileMetadata } from "models/studysets";
import { planCardFileCopies, copyCardFiles } from "utilities/cardFiles";

// #126: a duplicate kept the source's file keys, so removing an image from
// the copy deleted the original's S3 object. Copies now get their own objects.

const file = (key: string, extra: Partial<CardFileMetadata> = {}): CardFileMetadata => ({
    key,
    name: key.slice(key.lastIndexOf("/") + 1),
    signedURL: "https://x",
    size: 1,
    association: "term",
    ...extra,
});

const card = (files: CardFileMetadata[]): Card => ({
    cardUUID: "c",
    term: "t",
    definition: "d",
    categories: [],
    important: false,
    notes: [],
    files,
});

const keys = (cards: Card[]) => cards.map((c) => c.files.map((f) => f.key));

describe("planCardFileCopies", () => {
    it("puts every file under the new set's prefix", () => {
        const { cards, copies } = planCardFileCopies([card([file("src/u1/photo.png")])], "NEW", "owner");

        expect(keys(cards)).toEqual([["NEW/owner/photo.png"]]);
        expect(copies).toEqual([{ from: "src/u1/photo.png", to: "NEW/owner/photo.png" }]);
    });

    it("keeps name, size, association and other metadata, changing only key", () => {
        const source = file("src/u1/photo.png", {
            size: 42,
            association: "definition",
            uploadedAt: "2026-10-01T00:00:00.000Z",
        });

        const { cards } = planCardFileCopies([card([source])], "NEW", "o");

        expect(cards[0].files[0]).toEqual({ ...source, key: "NEW/o/photo.png" });
    });

    it("maps a key shared by two cards to one new key and one copy", () => {
        const shared = "src/u1/photo.png";

        const { cards, copies } = planCardFileCopies([card([file(shared)]), card([file(shared)])], "NEW", "o");

        expect(keys(cards)).toEqual([["NEW/o/photo.png"], ["NEW/o/photo.png"]]);
        expect(copies).toHaveLength(1);
    });

    it("keeps different source keys with the same file name apart", () => {
        const { cards, copies } = planCardFileCopies([card([file("a/u1/x.png"), file("b/u1/x.png")])], "NEW", "o");

        expect(keys(cards)).toEqual([["NEW/o/x.png", "NEW/o/1-x.png"]]);
        expect(copies).toEqual([
            { from: "a/u1/x.png", to: "NEW/o/x.png" },
            { from: "b/u1/x.png", to: "NEW/o/1-x.png" },
        ]);
    });

    it("leaves files without a key alone and plans no copy for them", () => {
        const keyless = file("");

        const { cards, copies } = planCardFileCopies([card([keyless])], "NEW", "o");

        expect(cards[0].files).toEqual([keyless]);
        expect(copies).toEqual([]);
    });

    it("tolerates cards with no files", () => {
        const noFiles = { ...card([]), files: undefined } as unknown as Card;

        const { cards, copies } = planCardFileCopies([noFiles], "NEW", "o");

        expect(cards[0].files).toEqual([]);
        expect(copies).toEqual([]);
    });

    it("does not mutate the input cards", () => {
        const input = [card([file("src/u1/photo.png")]), card([file("src/u1/other.png")])];
        const before = structuredClone(input);

        planCardFileCopies(input, "NEW", "o");

        expect(input).toEqual(before);
    });
});

describe("copyCardFiles", () => {
    const s3Client = new S3Client({});

    beforeEach(() => {
        jest.spyOn(console, "warn").mockImplementation(() => {});
        jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // Records each CopyObjectCommand input; `fail` decides which ones reject.
    const fakeS3 = (fail: (input: CopyObjectCommand["input"]) => string | undefined = () => undefined) => {
        const copies: CopyObjectCommand["input"][] = [];
        const send = jest.spyOn(S3Client.prototype, "send").mockImplementation((async (command: unknown) => {
            if (!(command instanceof CopyObjectCommand)) throw new Error("unexpected command");
            copies.push({ ...command.input });
            const name = fail(command.input);
            if (name) throw Object.assign(new Error("x"), { name });
            return {};
        }) as never);
        return { copies, send };
    };

    const run = (cards: Card[]) =>
        copyCardFiles({ s3Client, bucket: "bucket", cards, studysetUUID: "NEW", ownerUUID: "o" });

    it("sends one CopyObjectCommand per distinct key with URL-encoded CopySource", async () => {
        const { copies } = fakeS3();
        const key = "src/u1/my photo+1.png";

        const cards = await run([card([file(key)]), card([file(key)])]);

        expect(copies).toEqual([
            { Bucket: "bucket", Key: "NEW/o/my photo+1.png", CopySource: "bucket/src/u1/my%20photo%2B1.png" },
        ]);
        expect(keys(cards)).toEqual([["NEW/o/my photo+1.png"], ["NEW/o/my photo+1.png"]]);
    });

    it("does no S3 work when there are no files", async () => {
        const { send } = fakeS3();

        const cards = await run([card([]), card([])]);

        expect(send).not.toHaveBeenCalled();
        expect(keys(cards)).toEqual([[], []]);
    });

    it("drops files whose source object no longer exists", async () => {
        fakeS3((input) => (input.CopySource?.endsWith("a.png") ? "NoSuchKey" : undefined));

        const cards = await run([card([file("src/u1/a.png")]), card([file("src/u1/b.png")])]);

        expect(keys(cards)).toEqual([[], ["NEW/o/b.png"]]);
    });

    it("rejects when a copy fails for another reason", async () => {
        fakeS3(() => "AccessDenied");

        await expect(run([card([file("src/u1/a.png")])])).rejects.toMatchObject({ name: "AccessDenied" });
    });
});
