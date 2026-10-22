import { PUBLIC_STUDYSET_PK } from "resources/dynamo/publicSharing";
import { PublicStudysetSource, toPublicStudyset } from "utilities/publicStudyset";

// #128: the public endpoint used to return the whole stored set minus a few
// keys, leaking the owner's notes, labels, categories and storage keys. The
// response is now built from an explicit allowlist.

const STUDYSET_UUID = "11111111-1111-4111-8111-111111111111";
const USER_UUID = "22222222-2222-4222-8222-222222222222";
const TERM_KEY = `${STUDYSET_UUID}/${USER_UUID}/photo.png`;
const DEFINITION_KEY = `${STUDYSET_UUID}/${USER_UUID}/diagram.png`;
const TERM_URL = `https://bucket.s3.amazonaws.com/${TERM_KEY}?X-Amz-Signature=abc`;
const DEFINITION_URL = `https://bucket.s3.amazonaws.com/${DEFINITION_KEY}?X-Amz-Signature=def`;

const storedItem = () => ({
    PK: `userUUID#${USER_UUID}`,
    SK: `studyset#${STUDYSET_UUID}`,
    PK2: PUBLIC_STUDYSET_PK,
    SK2: `studyset#${STUDYSET_UUID}`,
    userUUID: USER_UUID,
    studysetUUID: STUDYSET_UUID,
    username: "turtles",
    title: "Cell biology",
    description: "Organelles and what they do",
    labels: ["Private folder"],
    categories: ["Secret category"],
    favorited: true,
    lastViewed: "2026-10-14T00:00:00.000Z",
    updatedBy: "turtles",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-15T00:00:00.000Z",
    subject: "science",
    publishedAt: "2026-10-10T00:00:00.000Z",
    metadata: { publiclyViewable: true, terminology: "Term" },
    cards: [
        {
            cardUUID: "33333333-3333-4333-8333-333333333333",
            term: "Mitochondria",
            definition: "Powerhouse of the cell",
            notes: [{ noteUUID: "n1", text: "My private note" }],
            categories: ["Card category"],
            important: true,
            backgroundColor: "#fff",
            textColor: "#000",
            files: [
                {
                    key: TERM_KEY,
                    name: "photo.png",
                    size: 1234,
                    uploadedAt: "2026-10-02T00:00:00.000Z",
                    association: "term",
                    signedURL: TERM_URL,
                },
                {
                    key: DEFINITION_KEY,
                    name: "diagram.png",
                    size: 5678,
                    association: "definition",
                    signedURL: DEFINITION_URL,
                },
            ],
        },
    ],
});

const map = (fixture: unknown) => toPublicStudyset(fixture as unknown as PublicStudysetSource);

describe("toPublicStudyset", () => {
    it("returns only the public allowlist", () => {
        const out = map(storedItem());

        expect(out).toEqual({
            title: "Cell biology",
            description: "Organelles and what they do",
            username: "turtles",
            subject: "science",
            publishedAt: "2026-10-10T00:00:00.000Z",
            updatedAt: "2026-10-15T00:00:00.000Z",
            cards: [
                {
                    term: "Mitochondria",
                    definition: "Powerhouse of the cell",
                    files: [
                        { association: "term", signedURL: TERM_URL },
                        { association: "definition", signedURL: DEFINITION_URL },
                    ],
                },
            ],
        });

        for (const field of [
            "labels",
            "categories",
            "favorited",
            "lastViewed",
            "updatedBy",
            "userUUID",
            "studysetUUID",
            "metadata",
            "createdAt",
            "PK",
            "SK",
            "PK2",
            "SK2",
        ]) {
            expect(out).not.toHaveProperty(field);
        }
        for (const field of ["notes", "categories", "cardUUID", "important"]) {
            expect(out.cards[0]).not.toHaveProperty(field);
        }
        for (const field of ["key", "name", "size", "uploadedAt"]) {
            expect(out.cards[0].files[0]).not.toHaveProperty(field);
        }

        // Signed URLs carry the S3 key, which embeds the owner id and the
        // filename, by construction (tracked in #152). Everything else must
        // be free of them.
        const withoutUrls = {
            ...out,
            cards: out.cards.map((card) => ({
                ...card,
                files: card.files.map((file) => file.association),
            })),
        };
        const serialized = JSON.stringify(withoutUrls);
        for (const secret of [
            USER_UUID,
            TERM_KEY,
            "photo.png",
            "My private note",
            "Private folder",
            "Secret category",
            "Card category",
        ]) {
            expect(serialized).not.toContain(secret);
        }
    });

    it("maps a missing or empty username to null", () => {
        const { username: _username, ...withoutUsername } = storedItem();

        expect(map(withoutUsername).username).toBeNull();
        expect(map({ ...storedItem(), username: "" }).username).toBeNull();
    });

    it("emits null subject and publishedAt until publishing sets them", () => {
        const { subject: _subject, publishedAt: _publishedAt, ...unpublished } = storedItem();

        const out = map(unpublished);

        expect(out.subject).toBeNull();
        expect(out.publishedAt).toBeNull();
    });

    it("emits a null updatedAt for records that predate it", () => {
        const { updatedAt: _updatedAt, ...legacy } = storedItem();

        expect(map(legacy).updatedAt).toBeNull();
    });

    it("drops files without a signedURL or a known side, and tolerates missing cards/files", () => {
        const item = storedItem();
        const [card] = item.cards;
        const { association: _association, ...unplacedFile } = card.files[1];
        const withUnusableFiles = {
            ...item,
            cards: [
                {
                    ...card,
                    files: [{ ...card.files[0], signedURL: "" }, unplacedFile, card.files[1]],
                },
                { term: "No files", definition: "None" },
            ],
        };

        expect(map(withUnusableFiles).cards).toEqual([
            {
                term: "Mitochondria",
                definition: "Powerhouse of the cell",
                files: [{ association: "definition", signedURL: DEFINITION_URL }],
            },
            { term: "No files", definition: "None", files: [] },
        ]);

        const { cards: _cards, ...withoutCards } = item;
        expect(map(withoutCards).cards).toEqual([]);
    });
});
