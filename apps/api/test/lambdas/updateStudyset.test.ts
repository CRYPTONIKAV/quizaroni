import { buildUpdateExpression } from "../../service/lambdas/updateStudyset/src/updateStudyset";

// Regression test for a real bug caught in production: CreateSet.tsx's
// saveChanges() spreads a previously-fetched studyset into `updates`, which
// carries the set's existing `updatedAt`/`updatedBy`. Since this function
// always sets those two itself, the old code produced two SET clauses for
// the same #updatedAt/#updatedBy attribute paths — DynamoDB rejects that
// outright, so every save of an existing studyset 500'd.

const NOW = "2026-08-25T00:00:00.000Z";

// DynamoDB rejects an update whose names or values aren't all referenced.
const expectAllPlaceholdersUsed = ({
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
}: ReturnType<typeof buildUpdateExpression>) => {
    for (const placeholder of [
        ...Object.keys(ExpressionAttributeNames),
        ...Object.keys(ExpressionAttributeValues),
    ]) {
        expect(UpdateExpression).toMatch(new RegExp(`${placeholder}\\b`));
    }
};

describe("updateStudyset buildUpdateExpression", () => {
    it("doesn't duplicate #updatedAt/#updatedBy when the caller's updates carry stale copies", () => {
        const result = buildUpdateExpression({
            updates: {
                title: "New Title",
                // Stale values copied from a previously-fetched studyset,
                // as CreateSet.tsx's saveChanges() sends them.
                updatedAt: "2020-01-01T00:00:00.000Z",
                updatedBy: "someone-else",
            },
            isMetadataUpdate: false,
            updatedAt: NOW,
            updatedBy: "turtles",
        });
        const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } = result;

        const updatedAtOccurrences = (
            UpdateExpression.match(/#updatedAt = :updatedAt/g) ?? []
        ).length;
        const updatedByOccurrences = (
            UpdateExpression.match(/#updatedBy = :updatedBy/g) ?? []
        ).length;

        expect(updatedAtOccurrences).toBe(1);
        expect(updatedByOccurrences).toBe(1);
        // The server-set values win, not the caller's stale copies.
        expect(ExpressionAttributeValues[":updatedAt"]).toBe(NOW);
        expect(ExpressionAttributeValues[":updatedBy"]).toBe("turtles");
        expect(ExpressionAttributeNames["#title"]).toBe("title");
        expect(ExpressionAttributeValues[":title"]).toBe("New Title");
        expectAllPlaceholdersUsed(result);
    });

    it("still updates normally when the caller's updates don't include updatedAt/updatedBy", () => {
        const result = buildUpdateExpression({
            updates: { title: "New Title" },
            isMetadataUpdate: false,
            updatedAt: NOW,
            updatedBy: "turtles",
        });

        expect(result.UpdateExpression).toContain("#updatedAt = :updatedAt");
        expect(result.UpdateExpression).toContain("#updatedBy = :updatedBy");
        expect(result.UpdateExpression).toContain("#title = :title");
        expect(result.ExpressionAttributeValues[":title"]).toBe("New Title");
        expectAllPlaceholdersUsed(result);
    });

    // #132: publication and moderation are owned by publish/unpublish and the
    // takedown script, so update-studyset can't skip the gate or undo a takedown.
    it("ignores publication and moderation fields", () => {
        const result = buildUpdateExpression({
            updates: {
                title: "T",
                subject: "math",
                publishedAt: "x",
                moderation: null,
                PK2: "x",
                SK2: "y",
            },
            isMetadataUpdate: false,
            updatedAt: NOW,
            updatedBy: "turtles",
        });

        expect(Object.keys(result.ExpressionAttributeNames).sort()).toEqual([
            "#title",
            "#updatedAt",
            "#updatedBy",
        ]);
        expect(result.UpdateExpression).not.toContain("REMOVE");
        expectAllPlaceholdersUsed(result);
    });

    it("drops publiclyViewable from a metadata update without leaving an unused #metadata", () => {
        const result = buildUpdateExpression({
            updates: { publiclyViewable: true },
            isMetadataUpdate: true,
            updatedAt: NOW,
            updatedBy: "turtles",
        });

        expect(result.UpdateExpression).toBe("SET #updatedAt = :updatedAt, #updatedBy = :updatedBy");
        expect(result.ExpressionAttributeNames).not.toHaveProperty("#metadata");
        expect(result.ExpressionAttributeNames).not.toHaveProperty("#PK2");
        expectAllPlaceholdersUsed(result);
    });

    it("keeps other keys in a metadata update", () => {
        const result = buildUpdateExpression({
            updates: { publiclyViewable: true, textColorVisible: true },
            isMetadataUpdate: true,
            updatedAt: NOW,
            updatedBy: "turtles",
        });

        expect(result.UpdateExpression).toContain("#metadata.#textColorVisible = :textColorVisible");
        expect(result.ExpressionAttributeNames["#metadata"]).toBe("metadata");
        expect(result.ExpressionAttributeNames).not.toHaveProperty("#publiclyViewable");
        expectAllPlaceholdersUsed(result);
    });

    it("merges a full-save metadata object per key without publiclyViewable", () => {
        // CreateSet's saveChanges() sends the whole fetched set, metadata included.
        const result = buildUpdateExpression({
            updates: { title: "T", metadata: { publiclyViewable: false, textColorVisible: true } },
            isMetadataUpdate: false,
            updatedAt: NOW,
            updatedBy: "turtles",
        });

        expect(result.UpdateExpression).toContain("#metadata.#metadataKey0 = :metadataValue0");
        expect(result.ExpressionAttributeNames["#metadataKey0"]).toBe("textColorVisible");
        expect(result.UpdateExpression).not.toContain("#metadata = ");
        expect(Object.values(result.ExpressionAttributeNames)).not.toContain("publiclyViewable");
        expectAllPlaceholdersUsed(result);
    });

    it("writes nothing for a full-save metadata object holding only publiclyViewable", () => {
        const result = buildUpdateExpression({
            updates: { title: "T", metadata: { publiclyViewable: true } },
            isMetadataUpdate: false,
            updatedAt: NOW,
            updatedBy: "turtles",
        });

        expect(result.ExpressionAttributeNames).not.toHaveProperty("#metadata");
        expectAllPlaceholdersUsed(result);
    });

    it("drops a non-object metadata value", () => {
        const result = buildUpdateExpression({
            updates: { title: "T", metadata: null },
            isMetadataUpdate: false,
            updatedAt: NOW,
            updatedBy: "turtles",
        });

        expect(result.ExpressionAttributeNames).not.toHaveProperty("#metadata");
        expectAllPlaceholdersUsed(result);
    });
});
