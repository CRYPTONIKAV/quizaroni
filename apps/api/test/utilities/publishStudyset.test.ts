import { SUBJECT_IDS } from "@quizaroni/shared-types";
import type { Card } from "models/studysets";
import {
    buildPublishUpdate,
    buildUnpublishUpdate,
    countCompleteCards,
    validatePublishRequest,
} from "utilities/publishStudyset";

// #132: publishing is gated server-side. validatePublishRequest is pure so the
// gate (subject, card count, first-publish-only publishedAt, moderation) is
// tested without DynamoDB.

const NOW = "2026-10-19T12:00:00.000Z";
const EARLIER = "2026-10-01T00:00:00.000Z";
const STUDYSET_UUID = "11111111-1111-4111-8111-111111111111";

const card = (term: unknown, definition: unknown) =>
    ({ term, definition }) as unknown as Card;

const fourCards = () => [
    card("a", "1"),
    card("b", "2"),
    card("c", "3"),
    card("d", "4"),
];

describe("SUBJECT_IDS", () => {
    it("exposes the 12 subject ids at runtime", () => {
        expect(SUBJECT_IDS).toHaveLength(12);
        expect(SUBJECT_IDS).toContain("computer-science");
    });
});

describe("countCompleteCards", () => {
    it("counts only cards with a non-blank term and definition", () => {
        expect(
            countCompleteCards([
                card("a", "1"),
                card("b", "  "),
                card(undefined, "3"),
                card("d", null),
                card(42, "5"),
                card("f", "6"),
            ]),
        ).toBe(2);
    });

    it("treats missing cards as zero", () => {
        expect(countCompleteCards(undefined)).toBe(0);
    });
});

describe("validatePublishRequest", () => {
    it.each(SUBJECT_IDS)("accepts subject %s", (subject) => {
        expect(
            validatePublishRequest({ subject, studyset: { cards: fourCards() }, now: NOW }),
        ).toEqual({ ok: true, subject, publishedAt: NOW });
    });

    it.each(["astrology", undefined, 42])("rejects subject %p", (subject) => {
        expect(
            validatePublishRequest({ subject, studyset: { cards: fourCards() }, now: NOW }),
        ).toEqual({ ok: false, errors: [{ code: "invalidSubject" }] });
    });

    it("rejects three complete cards", () => {
        expect(
            validatePublishRequest({
                subject: "math",
                studyset: { cards: fourCards().slice(0, 3) },
                now: NOW,
            }),
        ).toEqual({
            ok: false,
            errors: [{ code: "notEnoughCards", required: 4, actual: 3 }],
        });
    });

    it("does not count a card with a blank definition", () => {
        const cards = [...fourCards().slice(0, 3), card("d", "  ")];
        expect(
            validatePublishRequest({ subject: "math", studyset: { cards }, now: NOW }),
        ).toEqual({
            ok: false,
            errors: [{ code: "notEnoughCards", required: 4, actual: 3 }],
        });
    });

    it("does not throw on cards with non-string sides", () => {
        const cards = [
            ...fourCards().slice(0, 2),
            card("c", undefined),
            card(null, "4"),
        ];
        expect(
            validatePublishRequest({ subject: "math", studyset: { cards }, now: NOW }),
        ).toEqual({
            ok: false,
            errors: [{ code: "notEnoughCards", required: 4, actual: 2 }],
        });
    });

    it("reports a bad subject and too few cards together", () => {
        expect(
            validatePublishRequest({
                subject: "astrology",
                studyset: { cards: [] },
                now: NOW,
            }),
        ).toEqual({
            ok: false,
            errors: [
                { code: "invalidSubject" },
                { code: "notEnoughCards", required: 4, actual: 0 },
            ],
        });
    });

    it("keeps the first publishedAt on a republish", () => {
        expect(
            validatePublishRequest({
                subject: "law",
                studyset: { cards: fourCards(), publishedAt: EARLIER },
                now: NOW,
            }),
        ).toEqual({ ok: true, subject: "law", publishedAt: EARLIER });
    });

    it("refuses a hidden set with only the hidden error", () => {
        expect(
            validatePublishRequest({
                subject: "astrology",
                studyset: { cards: [], moderation: { hiddenAt: EARLIER } },
                now: NOW,
            }),
        ).toEqual({ ok: false, errors: [{ code: "hidden" }] });
    });
});

describe("buildPublishUpdate", () => {
    it("indexes the set and guards against moderation", () => {
        const update = buildPublishUpdate({
            studysetUUID: STUDYSET_UUID,
            subject: "math",
            publishedAt: NOW,
            username: "turtles",
            now: NOW,
        });

        expect(update.UpdateExpression).toContain("#PK2 = :pk2");
        expect(update.UpdateExpression).toContain("#SK2 = :sk2");
        expect(update.UpdateExpression).toContain("#metadata.#publiclyViewable = :true");
        expect(update.UpdateExpression).toContain(
            "#publishedAt = if_not_exists(#publishedAt, :publishedAt)",
        );
        expect(update.ExpressionAttributeValues).toMatchObject({
            ":pk2": "publicStudyset",
            ":sk2": `studyset#${STUDYSET_UUID}`,
            ":subject": "math",
            ":true": true,
            ":username": "turtles",
        });
        expect(update.ConditionExpression).toContain(
            "attribute_not_exists(#moderation.#hiddenAt)",
        );
    });

    it("leaves username alone when the token has none", () => {
        const update = buildPublishUpdate({
            studysetUUID: STUDYSET_UUID,
            subject: "math",
            publishedAt: NOW,
            username: undefined,
            now: NOW,
        });

        expect(update.ExpressionAttributeNames).not.toHaveProperty("#username");
        expect(update.ExpressionAttributeValues).not.toHaveProperty(":username");
        expect(update.UpdateExpression).not.toContain("#username");
    });
});

describe("buildUnpublishUpdate", () => {
    it("removes the index keys and keeps subject and publishedAt", () => {
        const update = buildUnpublishUpdate({ username: "turtles", now: NOW });

        expect(update.UpdateExpression).toContain("REMOVE #PK2, #SK2");
        expect(update.ExpressionAttributeValues[":false"]).toBe(false);
        expect(update.UpdateExpression).not.toContain("subject");
        expect(update.UpdateExpression).not.toContain("publishedAt");
        expect(update.ConditionExpression).toBe("attribute_exists(PK)");
    });
});
