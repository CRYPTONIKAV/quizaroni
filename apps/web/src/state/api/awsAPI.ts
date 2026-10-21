import { FileMetadata, Part, UUID } from 'shared/types';

export const BASE_API_URL = import.meta.env.VITE_API_BASE_URL;
if (!BASE_API_URL) {
    throw new Error('VITE_API_BASE_URL env var is not set');
}

// Wired up by App.tsx on mount, once useLogto() is available inside a
// component's render tree (this module isn't one). Before that happens — or
// if the user isn't signed in — requests simply go out unauthenticated, same
// as today; apiAuthorizer.ts is what actually enforces auth.
type AccessTokenGetter = () => Promise<string | undefined>;
let getAccessToken: AccessTokenGetter | undefined;

export const setAccessTokenGetter = (getter: AccessTokenGetter): void => {
    getAccessToken = getter;
};

export class HttpError extends Error {
    constructor(
        public status: number,
        message: string
    ) {
        super(message);
        this.name = 'HttpError';
    }
}

export const isHttpStatus = (error: unknown, status: number): boolean =>
    error instanceof HttpError && error.status === status;

// A non-2xx response was being parsed as if it were success data at nearly
// every call site (only studysetsAPI.ts's update-studyset checked
// response.ok), then handed to validate(), which logs-and-swallows schema
// mismatches by default — so an error body just silently fell through as a
// "successful" mutation. fetchJson() centralizes that check for call sites
// that don't need bespoke error handling (a few, like useGetPublicStudyset
// and pushGamificationToServer, still check response.ok by hand on purpose).
export const fetchJson = async <T>(
    url: string,
    init?: RequestInit
): Promise<T> => {
    const response = await fetch(url, init);
    if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        throw new HttpError(
            response.status,
            `Request to ${url} failed with status ${response.status}${
                bodyText ? `: ${bodyText}` : ''
            }`
        );
    }
    return response.json();
};

export const getCommonPostRequestProps = async (): Promise<RequestInit> => {
    const accessToken = await getAccessToken?.();

    return {
        credentials: 'omit',
        headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        },
        method: 'POST',
    };
};

type InitiateMultipartUploadProps = {
    contentType: string;
    fileName: string;
    studysetUUID?: UUID;
};

type InitiateMultipartUploadResponse = {
    key: string;
    uploadId: string | undefined;
};
export const initiateMultipartUpload = async ({
    contentType,
    fileName,
    studysetUUID = '',
}: InitiateMultipartUploadProps): Promise<InitiateMultipartUploadResponse> => {
    const url = `${BASE_API_URL}/files/initiate-multipart-upload`;
    return await fetchJson(url, {
        body: JSON.stringify({ studysetUUID, fileName, contentType }),
        ...(await getCommonPostRequestProps()),
    });
};

type GetMultipartSignedUploadUrlsProps = {
    key: string;
    numParts: number;
    uploadId: string;
};

type GetMultipartSignedUploadUrlsResponse = {
    signedURLs: Record<number, string>;
};
export const getMultipartSignedUploadUrls = async ({
    key,
    numParts,
    uploadId,
}: GetMultipartSignedUploadUrlsProps): Promise<GetMultipartSignedUploadUrlsResponse> => {
    const url = `${BASE_API_URL}/files/get-multipart-signed-upload-urls`;
    return await fetchJson(url, {
        body: JSON.stringify({ key, uploadId, numParts }),
        ...(await getCommonPostRequestProps()),
    });
};

type CompleteMultipartUploadProps = {
    association?: 'term' | 'definition';
    cardUUID?: string;
    key: string;
    parts: Part[];
    studysetUUID?: UUID;
    uploadId: string;
};

type CompleteMultipartUploadResponse = FileMetadata;
export const completeMultipartUpload = async ({
    association,
    cardUUID,
    key,
    parts,
    studysetUUID,
    uploadId,
}: CompleteMultipartUploadProps): Promise<CompleteMultipartUploadResponse> => {
    const url = `${BASE_API_URL}/files/complete-multipart-upload`;
    return await fetchJson(url, {
        body: JSON.stringify({
            association,
            cardUUID,
            key,
            parts,
            studysetUUID,
            uploadId,
        }),
        ...(await getCommonPostRequestProps()),
    });
};

type DeleteFileProps = {
    key: string;
};
export const deleteFile = async ({ key }: DeleteFileProps) => {
    const url = `${BASE_API_URL}/files/delete-file`;
    return await fetchJson(url, {
        body: JSON.stringify({ key }),
        ...(await getCommonPostRequestProps()),
    });
};

type SendFeedbackProps = {
    key: string;
};
export const sendFeedback = async ({ key }: SendFeedbackProps) => {
    const url = `${BASE_API_URL}/files/sendFeedback`;
    return await fetchJson(url, {
        body: JSON.stringify({ key }),
        ...(await getCommonPostRequestProps()),
    });
};
