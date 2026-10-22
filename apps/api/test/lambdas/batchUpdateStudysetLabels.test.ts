import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// Regression test for a real bug caught in production (#124): the Manage
// Labels dialog's Assign tab wrote each set with a Put holding only
// PK/SK/labels/updatedAt/updatedBy. A Put replaces the whole item, so every
// assignment wiped the set's cards, metadata and public-index keys (PK2/SK2),
// and an unknown id silently created a stub item. Failures were also
// swallowed, so the dialog always showed success.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let handler: (event: any, context: any) => Promise<{ statusCode: number; body: string }>;

const spySend = () => jest.spyOn(DynamoDBDocumentClient.prototype, "send");
let send: ReturnType<typeof spySend>;

beforeAll(() => {
    process.env.mainTable = "test-main";
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ({ handler } = require("../../service/lambdas/batchUpdateStudysetLabels/src/batchUpdateStudysetLabels"));
});

beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    send = spySend();
});

afterEach(() => {
    jest.restoreAllMocks();
});

const invokeRaw = async (body: string) => {
    const res = await handler(
        {
            requestContext: { authorizer: { lambda: { sub: "u1", username: "turtles" } } },
            body,
        },
        {}
    );
    return { statusCode: res.statusCode, body: JSON.parse(res.body) };
};

const invoke = (body: unknown) => invokeRaw(JSON.stringify(body));

const conditionalFail = () =>
    Object.assign(new Error("The conditional request failed"), {
        name: "ConditionalCheckFailedException",
    });

describe("batchUpdateStudysetLabels handler", () => {
    it("updates each set in place: one UpdateCommand per set, never a Put", async () => {
        send.mockResolvedValue({} as never);

        const res = await invoke({ studysetUpdates: [["s1", ["a"]], ["s2", ["a"]]] });

        expect(send).toHaveBeenCalledTimes(2);
        for (const [cmd] of send.mock.calls) {
            expect(cmd).toBeInstanceOf(UpdateCommand);
        }
        expect(JSON.stringify(send.mock.calls)).not.toContain("PutRequest");
        expect(res.statusCode).toBe(200);
    });

    it("reports unknown ids as 404 and still updates the rest", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        send.mockImplementation(async (cmd: any) => {
            if (cmd.input.Key.SK === "studyset#s2") throw conditionalFail();
            return {} as never;
        });

        const res = await invoke({ studysetUpdates: [["s1", ["a"]], ["s2", ["a"]]] });

        expect(res.statusCode).toBe(404);
        expect(res.body).toMatchObject({
            updatedStudysetUUIDs: ["s1"],
            notFoundStudysetUUIDs: ["s2"],
            failedStudysetUUIDs: [],
        });
    });

    it("reports any other failure as 500", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        send.mockImplementation(async (cmd: any) => {
            if (cmd.input.Key.SK === "studyset#s2") throw new Error("throttled");
            return {} as never;
        });

        const res = await invoke({ studysetUpdates: [["s1", ["a"]], ["s2", ["a"]]] });

        expect(res.statusCode).toBe(500);
        expect(res.body).toMatchObject({
            updatedStudysetUUIDs: ["s1"],
            failedStudysetUUIDs: ["s2"],
        });
    });

    it("maps results to the right ids across chunks of 25", async () => {
        const ids = Array.from({ length: 30 }, (_, i) => `s${i}`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        send.mockImplementation(async (cmd: any) => {
            if (cmd.input.Key.SK === "studyset#s27") throw conditionalFail();
            return {} as never;
        });

        const res = await invoke({ studysetUpdates: ids.map((id) => [id, ["a"]]) });

        expect(send).toHaveBeenCalledTimes(30);
        expect(res.statusCode).toBe(404);
        expect(res.body.notFoundStudysetUUIDs).toEqual(["s27"]);
        expect(res.body.updatedStudysetUUIDs).toEqual(ids.filter((id) => id !== "s27"));
    });

    it("returns 200 for an empty update list without touching DynamoDB", async () => {
        const res = await invoke({ studysetUpdates: [] });

        expect(res.statusCode).toBe(200);
        expect(send).not.toHaveBeenCalled();
    });

    it("returns 400 for a malformed body without touching DynamoDB", async () => {
        const responses = [
            await invoke({ studysetUpdates: "nope" }),
            await invoke({ studysetUpdates: [["s1", "not-an-array"]] }),
            // Concurrent updates to one key would race, last write wins
            await invoke({ studysetUpdates: [["s1", ["a"]], ["s1", ["b"]]] }),
            await invokeRaw("{bad"),
            await invokeRaw("null"),
        ];

        for (const res of responses) {
            expect(res.statusCode).toBe(400);
        }
        expect(send).not.toHaveBeenCalled();
    });
});
