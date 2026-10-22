import { logRequest, summarizeRequest } from "utilities/logging";

const authorizedEvent = {
    headers: { authorization: "Bearer SECRET-TOKEN-123" },
    cookies: ["session=COOKIE-SENTINEL"],
    requestContext: {
        requestId: "req-1",
        routeKey: "POST /api/studysets/update-studyset",
        authorizer: { lambda: { sub: "u1", username: "turtles" } },
    },
    body: JSON.stringify({ title: "BODY-SENTINEL" }),
};

describe("summarizeRequest", () => {
    it("keeps only the request id, route and user", () => {
        expect(summarizeRequest(authorizedEvent)).toEqual({
            requestId: "req-1",
            routeKey: "POST /api/studysets/update-studyset",
            userUUID: "u1",
        });
    });

    it("leaves userUUID undefined for a public route", () => {
        expect(
            summarizeRequest({
                requestContext: { requestId: "req-2", routeKey: "GET /api/public/studysets" },
            })
        ).toEqual({
            requestId: "req-2",
            routeKey: "GET /api/public/studysets",
            userUUID: undefined,
        });
    });

    it("does not throw for an event without a requestContext", () => {
        expect(summarizeRequest({})).toEqual({
            requestId: undefined,
            routeKey: undefined,
            userUUID: undefined,
        });
    });
});

describe("logRequest", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("logs the summary once, without the token, cookies or body", () => {
        const log = jest.spyOn(console, "log").mockImplementation(() => {});

        logRequest(authorizedEvent);

        expect(log).toHaveBeenCalledTimes(1);
        const [line] = log.mock.calls[0];
        expect(JSON.parse(line)).toEqual(summarizeRequest(authorizedEvent));
        expect(line).not.toContain("SECRET-TOKEN-123");
        expect(line).not.toContain("COOKIE-SENTINEL");
        expect(line).not.toContain("BODY-SENTINEL");
    });
});
