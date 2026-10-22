import type { Studyset } from "models/studysets";
import { PUBLIC_STUDYSET_PK } from "resources/dynamo/publicSharing";
import { buildDuplicate } from "utilities/duplicateStudyset";
import { validatePublishRequest } from "utilities/publishStudyset";

// #125: duplicating a public set used to structuredClone the stored item, so
// the copy inherited the source's public-index keys (PK2/SK2 pointing at the
// source's id), publiclyViewable and favorited. The copy is now built from an
// explicit allowlist.

const SOURCE_UUID = "11111111-1111-4111-8111-111111111111";
const NEW_UUID = "99999999-9999-4999-8999-999999999999";
const USER_UUID = "22222222-2222-4222-8222-222222222222";
const NOW = "2026-10-17T00:00:00.000Z";

const publicSource = () =>
    ({
        PK: `userUUID#${USER_UUID}`,
        SK: `studyset#${SOURCE_UUID}`,
        PK2: PUBLIC_STUDYSET_PK,
        SK2: `studyset#${SOURCE_UUID}`,
        PK3: "pk3",
        SK3: "sk3",
        userUUID: USER_UUID,
        studysetUUID: SOURCE_UUID,
        username: "turtles",
        title: "Cell biology",
        description: "Organelles and what they do",
        labels: ["Biology"],
        categories: ["Organelles"],
        favorited: true,
        lastViewed: "2026-10-14T00:00:00.000Z",
        updatedBy: "turtles",
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-15T00:00:00.000Z",
        subject: "science",
        publishedAt: "2026-10-10T00:00:00.000Z",
        featuredAt: "2026-10-11T00:00:00.000Z",
        saveCount: 7,
        moderation: { status: "approved" },
        metadata: {
            publiclyViewable: true,
            terminology: "Term/Definition",
            notesDrawerPosition: "left",
            printConfig: { layout: "list", includeNotes: true },
        },
        cards: [
            {
                cardUUID: "c1",
                term: "Mitochondria",
                definition: "Powerhouse of the cell",
                notes: [
                    { noteUUID: "n1", text: "First note" },
                    { noteUUID: "n2", text: "Second note" },
                ],
                categories: ["Organelles"],
                important: true,
                files: [{ key: "k1", name: "photo.png", association: "term" }],
            },
            {
                cardUUID: "c2",
                term: "Ribosome",
                definition: "Makes proteins",
                notes: [{ noteUUID: "n3", text: "Third note" }],
                categories: [],
                important: false,
                files: [],
            },
        ],
    }) as unknown as Studyset;

// #169: the owner of a taken-down set could duplicate it and publish the copy.
const hiddenSource = () =>
    ({
        ...publicSource(),
        metadata: { ...publicSource().metadata, publiclyViewable: false },
        moderation: { hiddenAt: "2026-10-16T00:00:00.000Z", reason: "spam" },
        cards: ["c1", "c2", "c3", "c4"].map((cardUUID) => ({
            cardUUID,
            term: `Term ${cardUUID}`,
            definition: `Definition ${cardUUID}`,
            notes: [],
            categories: [],
            important: false,
            files: [],
        })),
    }) as unknown as Studyset;

const cardIds = (set: Studyset) => set.cards.map((card) => card.cardUUID);
const noteIds = (set: Studyset) =>
    set.cards.flatMap((card) => card.notes.map((note) => note.noteUUID));

describe("buildDuplicate", () => {
    it("makes a copy of a public set private", () => {
        const copy = buildDuplicate(publicSource(), NEW_UUID, NOW);

        expect(copy.metadata.publiclyViewable).toBe(false);
        for (const key of ["PK2", "SK2", "PK3", "SK3"]) {
            expect(Object.prototype.hasOwnProperty.call(copy, key)).toBe(false);
        }
    });

    it("gives every card and note a new unique id", () => {
        const source = publicSource();
        const copy = buildDuplicate(source, NEW_UUID, NOW);
        const sourceIds = new Set([...cardIds(source), ...noteIds(source)]);
        const copyIds = [...cardIds(copy), ...noteIds(copy)];

        expect(copyIds).toHaveLength(5);
        expect(copyIds.filter((id) => sourceIds.has(id))).toEqual([]);
        expect(new Set(copyIds).size).toBe(copyIds.length);
    });

    it("keeps content and display settings", () => {
        const source = publicSource();
        const copy = buildDuplicate(source, NEW_UUID, NOW);
        const withoutIds = (set: Studyset) =>
            set.cards.map(({ cardUUID: _cardUUID, notes, ...card }) => ({
                ...card,
                notes: notes.map(({ noteUUID: _noteUUID, ...note }) => note),
            }));

        expect(copy.title).toBe("Cell biology Copy");
        expect(copy.description).toBe(source.description);
        expect(copy.categories).toEqual(source.categories);
        expect(copy.labels).toEqual(source.labels);
        expect(withoutIds(copy)).toEqual(withoutIds(source));
        expect(copy.metadata).toEqual({ ...source.metadata, publiclyViewable: false });
    });

    it("sets keys and timestamps for the new set", () => {
        const copy = buildDuplicate(publicSource(), NEW_UUID, NOW);

        expect(copy.SK).toBe(`studyset#${NEW_UUID}`);
        expect(copy.studysetUUID).toBe(NEW_UUID);
        expect(copy.PK).toBe(`userUUID#${USER_UUID}`);
        expect(copy.userUUID).toBe(USER_UUID);
        expect(copy.username).toBe("turtles");
        expect(copy.createdAt).toBe(NOW);
        expect(copy.updatedAt).toBe(NOW);
        expect(copy.lastViewed).toBe(NOW);
        expect(copy.favorited).toBe(false);
    });

    it("copies only allowlisted fields", () => {
        const copy = buildDuplicate(publicSource(), NEW_UUID, NOW);

        expect(Object.keys(copy).sort()).toEqual([
            "PK",
            "SK",
            "cards",
            "categories",
            "createdAt",
            "description",
            "favorited",
            "labels",
            "lastViewed",
            "metadata",
            "studysetUUID",
            "title",
            "updatedAt",
            "userUUID",
            "username",
        ]);
    });

    it("carries a takedown onto the copy (#169)", () => {
        const copy = buildDuplicate(hiddenSource(), NEW_UUID, NOW);

        expect(copy.moderation).toEqual({
            hiddenAt: "2026-10-16T00:00:00.000Z",
            reason: "spam",
        });
        expect(validatePublishRequest({ subject: "science", studyset: copy, now: NOW })).toEqual({
            ok: false,
            errors: [{ code: "hidden" }],
        });
    });

    it("does not carry moderation from a set that isn't hidden", () => {
        const copy = buildDuplicate(publicSource(), NEW_UUID, NOW);

        expect(Object.prototype.hasOwnProperty.call(copy, "moderation")).toBe(false);
    });

    it("does not mutate the source", () => {
        const source = publicSource();
        const before = structuredClone(source);

        const copy = buildDuplicate(source, NEW_UUID, NOW);
        copy.cards[0].files.push({ key: "k2" } as never);
        copy.metadata.terminology = "changed";

        expect(source).toEqual(before);
    });

    it("tolerates a source with no cards or notes", () => {
        const noCards = { ...publicSource(), cards: undefined } as unknown as Studyset;
        expect(buildDuplicate(noCards, NEW_UUID, NOW).cards).toEqual([]);

        const noNotes = publicSource();
        (noNotes.cards[0] as { notes?: unknown }).notes = undefined;
        expect(buildDuplicate(noNotes, NEW_UUID, NOW).cards[0].notes).toEqual([]);
    });
});
