import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { SignJWT, exportJWK, generateKeyPair, type KeyLike } from "jose";
import type { APIGatewayRequestAuthorizerEvent } from "aws-lambda";

// Exercises the real cryptographic verify path (jose's jwtVerify against a
// real ES384 key pair and a real JWKS document), the same as production —
// only the network transport is a local HTTP server instead of Logto
// itself, since hitting the live logto-af.fly.dev instance on every test
// run isn't viable. The live instance is verified separately (see the auth
// migration plan's Phase 3 gate). Mirrors team-builder-cdk's
// apiAuthorizer.test.ts, which proved this pattern for the same rewrite.
//
// The module under test reads logtoEndpoint/apiResource from process.env
// and derives the issuer/JWKS URL at import time, so the env vars are set
// before the one `require` below (jest resets the module registry per test
// file, so this only needs to happen once here).

const ISSUER_PATH = "/oidc";
const AUDIENCE = "https://api.quizaroni.yusufaf.dev";
const KEY_ID = "test-key-1";

let server: Server;
let endpoint: string;
let privateKey: KeyLike;
let handler: (
    event: APIGatewayRequestAuthorizerEvent,
    context: unknown,
    callback: unknown
) => Promise<{ isAuthorized: boolean; context: Record<string, unknown> }>;

const startJwksServer = async () => {
    const { publicKey, privateKey: generatedPrivateKey } =
        await generateKeyPair("ES384");
    privateKey = generatedPrivateKey;
    const jwk = await exportJWK(publicKey);
    jwk.kid = KEY_ID;
    jwk.alg = "ES384";
    jwk.use = "sig";

    server = createServer((req, res) => {
        if (req.url === `${ISSUER_PATH}/jwks`) {
            res.writeHead(200, { "content-type": "application/json" });
            res.end(JSON.stringify({ keys: [jwk] }));
            return;
        }
        res.writeHead(404);
        res.end();
    });

    await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve)
    );
    const { port } = server.address() as AddressInfo;
    endpoint = `http://127.0.0.1:${port}`;
};

const signToken = async (
    claims: Record<string, unknown>,
    {
        issuer = `${endpoint}${ISSUER_PATH}`,
        audience = AUDIENCE,
        expired = false,
    } = {}
) => {
    const jwt = new SignJWT(claims)
        .setProtectedHeader({ alg: "ES384", kid: KEY_ID })
        .setIssuedAt()
        .setIssuer(issuer)
        .setAudience(audience)
        .setExpirationTime(expired ? "-1h" : "1h");
    return jwt.sign(privateKey);
};

const buildEvent = (
    authorization?: string
): APIGatewayRequestAuthorizerEvent =>
    ({
        headers: authorization ? { Authorization: authorization } : {},
    }) as unknown as APIGatewayRequestAuthorizerEvent;

beforeAll(async () => {
    await startJwksServer();
    process.env.logtoEndpoint = endpoint;
    process.env.apiResource = AUDIENCE;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ({ handler } = require("../../service/lambdas/apiAuthorizer/src/apiAuthorizer"));
});

afterAll(() => {
    server.close();
});

describe("apiAuthorizer", () => {
    it("authorizes a valid token and populates username/sub from its claims", async () => {
        const token = await signToken({ sub: "user-123", username: "yusufaf" });

        const result = await handler(buildEvent(`Bearer ${token}`), {}, {});

        expect(result.isAuthorized).toBe(true);
        expect(result.context).toMatchObject({
            sub: "user-123",
            username: "yusufaf",
        });
    });

    it("rejects a token issued for a different project's API resource", async () => {
        const token = await signToken(
            { sub: "user-123", username: "yusufaf" },
            { audience: "https://api.nba.yusufaf.dev" }
        );

        const result = await handler(buildEvent(`Bearer ${token}`), {}, {});

        expect(result.isAuthorized).toBe(false);
    });

    it("rejects an expired token", async () => {
        const token = await signToken(
            { sub: "user-123", username: "yusufaf" },
            { expired: true }
        );

        const result = await handler(buildEvent(`Bearer ${token}`), {}, {});

        expect(result.isAuthorized).toBe(false);
    });

    // #179: jose's JWTExpired/JWTClaimValidationFailed carry the decoded
    // claims on `payload`, so logging the raw error wrote them to CloudWatch.
    it("does not log the token's claims when it rejects one", async () => {
        const error = jest.spyOn(console, "error").mockImplementation(() => {});
        const token = await signToken(
            { sub: "user-123", username: "yusufaf" },
            { expired: true }
        );

        await handler(buildEvent(`Bearer ${token}`), {}, {});

        const logged = error.mock.calls
            .flat()
            .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
            .join("\n");
        error.mockRestore();
        expect(logged).toContain("ERR_JWT_EXPIRED");
        expect(logged).not.toContain("user-123");
        expect(logged).not.toContain("yusufaf");
        expect(logged).not.toContain(token);
    });

    it("rejects a token from an unrecognized issuer", async () => {
        const token = await signToken(
            { sub: "user-123", username: "yusufaf" },
            { issuer: "https://not-logto.example.com/oidc" }
        );

        const result = await handler(buildEvent(`Bearer ${token}`), {}, {});

        expect(result.isAuthorized).toBe(false);
    });

    it("rejects a request with no Authorization header", async () => {
        const result = await handler(buildEvent(), {}, {});

        expect(result.isAuthorized).toBe(false);
    });

    it("rejects a token signed with a key not in the JWKS (forged signature)", async () => {
        // Every other test signs with the one key pair the JWKS server
        // serves, so a broken implementation that checked only iss/aud/exp
        // and skipped the actual signature verification would still pass
        // them. Signing with a second, unrelated key pair proves jwtVerify's
        // cryptographic check is actually being exercised.
        const { privateKey: forgedPrivateKey } = await generateKeyPair(
            "ES384"
        );
        const token = await new SignJWT({
            sub: "user-123",
            username: "yusufaf",
        })
            .setProtectedHeader({ alg: "ES384", kid: KEY_ID })
            .setIssuedAt()
            .setIssuer(`${endpoint}${ISSUER_PATH}`)
            .setAudience(AUDIENCE)
            .setExpirationTime("1h")
            .sign(forgedPrivateKey);

        const result = await handler(buildEvent(`Bearer ${token}`), {}, {});

        expect(result.isAuthorized).toBe(false);
    });
});
