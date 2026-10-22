import { buildLabelUpdateInput } from "utilities/labels";

// #124/#146: both label endpoints write through this builder, so it must only
// touch labels/updatedAt/updatedBy and must refuse to create unknown ids.

const input = (overrides: { username?: string } = { username: "turtles" }) =>
    buildLabelUpdateInput({
        tableName: "test-main",
        userUUID: "u1",
        ...overrides,
        studysetUUID: "s1",
        labels: ["bio"],
        updatedAt: "2026-10-15T00:00:00.000Z",
    });

describe("buildLabelUpdateInput", () => {
    it("only touches labels, updatedAt and updatedBy, so cards/metadata/PK2 survive", () => {
        const { TableName, Key, UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
            input();

        expect(TableName).toBe("test-main");
        expect(Key).toEqual({ PK: "userUUID#u1", SK: "studyset#s1" });
        expect(UpdateExpression).toBe(
            "SET #labels = :labels, #updatedAt = :updatedAt, #updatedBy = :updatedBy"
        );
        expect(UpdateExpression).not.toContain("REMOVE");
        expect(Object.values(ExpressionAttributeNames ?? {}).sort()).toEqual([
            "labels",
            "updatedAt",
            "updatedBy",
        ]);
        expect(ExpressionAttributeValues).toEqual({
            ":labels": ["bio"],
            ":updatedAt": "2026-10-15T00:00:00.000Z",
            ":updatedBy": "turtles",
        });
        expect("Item" in input()).toBe(false);
    });

    it("rejects unknown ids instead of creating them", () => {
        expect(input().ConditionExpression).toBe("attribute_exists(PK)");
    });

    it("skips updatedBy when the token has no username, since undefined values fail the write", () => {
        const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
            input({});

        expect(UpdateExpression).toBe("SET #labels = :labels, #updatedAt = :updatedAt");
        expect(ExpressionAttributeNames).not.toHaveProperty("#updatedBy");
        expect(ExpressionAttributeValues).not.toHaveProperty(":updatedBy");
        expect(Object.values(ExpressionAttributeValues ?? {})).not.toContain(undefined);
    });
});
