type LoggableRequest = {
    requestContext?: {
        requestId?: string;
        routeKey?: string;
        authorizer?: { lambda?: { sub?: string } };
    };
};

export const summarizeRequest = (event: LoggableRequest) => ({
    requestId: event?.requestContext?.requestId,
    routeKey: event?.requestContext?.routeKey,
    userUUID: event?.requestContext?.authorizer?.lambda?.sub,
});

/** Logs a summary only: the raw event carries the bearer token and the request body (#179). */
export const logRequest = (event: LoggableRequest): void => {
    console.log(JSON.stringify(summarizeRequest(event)));
};
