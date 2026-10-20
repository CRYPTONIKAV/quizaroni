import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// Regression test for #146: the single-set labels endpoint ran an
// UpdateCommand with no existence condition. DynamoDB's UpdateItem upserts,
// so an unknown or deleted studysetUUID created a stub studyset#<id> item
// holding only labels, and a missing studysetUUID defaulted to "" and
// created a studyset# stub. The write now reuses buildLabelUpdateInput
// (#144), which sets updatedBy and guards with attribute_exists(PK), so an
// unknown id is rejected with 404 and a malformed body with 400.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let handler: (event: any, context: any) => Promise<{ statusCode: number; body: string }>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let buildLabelUpdateInput: (args: any) => any;

const spySend = () => jest.spyOn(DynamoDBDocumentClient.prototype, "send");
let send: ReturnType<typeof spySend>;

const captureInputs = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inputs: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    send.mockImplementation(async (cmd: any) => {
        inputs.push(cmd.input);
        return {} as never;
    });
    return inputs;
};

beforeAll(() => {
    process.env.mainTable = "test-main";
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const batch = require("lambdas/batchUpdateStudysetLabels/src/batchUpdateStudysetLabels");
    ({ handler } = require("lambdas/updateStudysetLabels/src/updateStudysetLabels"));
    ({ buildLabelUpdateInput } = batch);
});

beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    send = spySend();
});

afterEach(() => {
    jest.restoreAllMocks();
});

const invoke = async (body: unknown) => {
    const raw =
        typeof body === "string" ? body : JSON.stringify(body);
    const res = await handler(
        {
            requestContext: { authorizer: { lambda: { sub: "u1", username: "turtles" } } },
            body: raw,
        },
        {}
    );
    return { statusCode: res.statusCode, body: JSON.parse(res.body) };
};

const conditionalFail = () =>
    Object.assign(new Error("The conditional request failed"), {
        name: "ConditionalCheckFailedException",
    });

describe("updateStudysetLabels", () => {
    it("guards the write with attribute_exists(PK), so an unknown id cannot be upserted", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        send.mockRejectedValueOnce(conditionalFail() as never);

        const { statusCode, body } = await invoke({
            studysetUUID: "s1",
            labels: ["biology"],
        });

        expect(statusCode).toBe(404);
        expect(body.message).toBe("Studyset not found");
        expect(buildLabelUpdateInput({
            tableName: "test-main",
            userUUID: "u1",
            username: "turtles",
            studysetUUID: "s1",
            labels: ["biology"],
            updatedAt: "2026-10-15T00:00:00.000Z",
        }).ConditionExpression).toBe("attribute_exists(PK)");
    });

    it("only touches labels, updatedAt and updatedBy on success", async () => {
        const inputs = captureInputs();

        const { statusCode, body } = await invoke({
            studysetUUID: "s1",
            labels: ["biology"],
        });

        expect(statusCode).toBe(200);
        expect(body.message).toBe("Successfully updated studyset labels");
        expect(inputs).toHaveLength(1);
        expect(inputs[0].TableName).toBe("test-main");
        expect(inputs[0].Key).toEqual({ PK: "userUUID#u1", SK: "studyset#s1" });
        expect(inputs[0].UpdateExpression).toBe(
            "SET #labels = :labels, #updatedAt = :updatedAt, #updatedBy = :updatedBy"
        );
        expect(inputs[0].UpdateExpression).not.toContain("REMOVE");
        expect(inputs[0].ExpressionAttributeValues).toEqual({
            ":labels": ["biology"],
            ":updatedBy": "turtles",
            ":updatedAt": expect.any(String),
        });
        expect("Item" in inputs[0]).toBe(false);
    });

    it("returns 404 only for the conditional failure, 500 otherwise", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        send.mockImplementation(async (cmd: any) => {
            if (cmd.input.Key.SK === "studyset#s1") {
                throw new Error("network down");
            }
            return {} as never;
        });

        const { statusCode, body } = await invoke({
            studysetUUID: "s1",
            labels: ["biology"],
        });

        expect(statusCode).toBe(500);
        expect(body.message).toBe("Error");
    });

    it("returns 400 and does not write for a body without a usable studysetUUID", async () => {
        for (const bad of [
            {},
            { studysetUUID: "", labels: ["biology"] },
            { studysetUUID: 7, labels: ["biology"] },
            { studysetUUID: "s1" },
            { studysetUUID: "s1", labels: ["bio", 1] },
            { studysetUUID: "s1", labels: "biology" },
        ]) {
            send.mockClear();
            const { statusCode, body } = await invoke(bad);

            expect(statusCode).toBe(400);
            expect(body.message).toContain("must be");
            expect(send).not.toHaveBeenCalled();
        }
    });

    it("returns 400 for a body that is not JSON", async () => {
        const { statusCode } = await invoke("{ not json");

        expect(statusCode).toBe(400);
        expect(send).not.toHaveBeenCalled();
    });
});
