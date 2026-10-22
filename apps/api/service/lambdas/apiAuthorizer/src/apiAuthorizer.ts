import {
    APIGatewayRequestAuthorizerEvent,
    APIGatewaySimpleAuthorizerWithContextResult,
    Handler,
} from "aws-lambda";
import { createRemoteJWKSet, jwtVerify } from "jose";

type AuthorizerContext = { [key: string]: any };

const { logtoEndpoint = "", apiResource = "" } = process.env;

// Logto's OIDC issuer is the endpoint plus /oidc (see the OIDC discovery
// document at `${logtoEndpoint}/oidc/.well-known/openid-configuration`).
const issuer = `${logtoEndpoint}/oidc`;
const jwksUri = new URL(`${issuer}/jwks`);

// createRemoteJWKSet caches the key set in module scope, so a warm Lambda
// invocation verifies locally with no network call — unlike the Cognito
// version this replaces, which called GetUser on every single request.
const jwks = createRemoteJWKSet(jwksUri);

export const handler: Handler = async (
    event: APIGatewayRequestAuthorizerEvent
): Promise<APIGatewaySimpleAuthorizerWithContextResult<AuthorizerContext>> => {
    try {
        const authorization =
            event.headers?.Authorization ?? event.headers?.authorization ?? "";
        // Logto's SDK sends a normal "Bearer <accessToken>" — unlike the
        // Cognito era, which sent "<accessToken> <idToken>" space-separated.
        const [, accessToken] = authorization.split(" ");

        if (!accessToken) {
            throw new Error("Missing bearer token");
        }

        const { payload } = await jwtVerify(accessToken, jwks, {
            issuer,
            // Reject a token issued for a different project's API resource —
            // e.g. an NBA Central access token must not authorize Quizaroni
            // requests. See the auth migration plan's Security section.
            audience: apiResource,
        });

        // username comes from a Logto Custom JWT (Console > Custom JWT > User
        // access token) baking `context.user.username` into the access
        // token's claims, so this stays a local verify with no per-request
        // network call.
        const { sub, username } = payload as { sub?: string; username?: string };

        return {
            isAuthorized: true,
            context: {
                username,
                userAttributes: {},
                sub,
            },
        };
    } catch (err) {
        // Not the raw error: jose's claim errors carry the decoded token
        // claims on `payload` (#179).
        const { name, code, message } = (err ?? {}) as {
            name?: string;
            code?: string;
            message?: string;
        };
        console.error("Authorization failed:", JSON.stringify({ name, code, message }));

        return {
            isAuthorized: false,
            context: {},
        };
    }
};
