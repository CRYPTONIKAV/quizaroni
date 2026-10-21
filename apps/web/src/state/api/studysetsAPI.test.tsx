// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    isCompleteStudyset,
    PublishStudysetError,
    useGetAllStudysets,
    useGetStudyset,
    usePublishStudyset,
} from './studysetsAPI';
import { isHttpStatus } from './awsAPI';

const ID = '11111111-1111-4111-8111-111111111111';
const OWNER = '33333333-3333-4333-8333-333333333333';
const NOW = '2026-10-01T12:00:00.000Z';

const validSet = {
    cards: [],
    categories: [],
    createdAt: NOW,
    description: '',
    favorited: false,
    labels: [],
    lastViewed: NOW,
    metadata: {
        backgroundColorVisible: false,
        cardCountVisible: true,
        contentOnly: false,
        customLabelTerminology: '',
        customTerminology: '',
        labelTerminology: 'Card',
        notesDrawerInitial: 'open',
        notesDrawerPosition: 'right',
        publiclyViewable: false,
        terminology: 'Term/Definition',
        textColorVisible: false,
    },
    studysetUUID: ID,
    title: 'Biology Basics',
    username: 'owner',
    userUUID: OWNER,
    uuid: ID,
};

const lastViewedStub = { lastViewed: NOW, updatedAt: NOW, updatedBy: OWNER };

describe('isCompleteStudyset', () => {
    it.each([
        ['a full study set', validSet, true],
        ['a lastViewed stub', lastViewedStub, false],
        ['an item without cards', { studysetUUID: ID, labels: [] }, false],
        ['an item without studysetUUID', { cards: [] }, false],
        ['null', null, false],
    ])('%s -> %s', (_label, item, expected) => {
        expect(isCompleteStudyset(item)).toBe(expected);
    });
});

describe('useGetAllStudysets', () => {
    beforeEach(() => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() =>
                Promise.resolve(
                    new Response(
                        JSON.stringify({ studysets: [validSet, lastViewedStub] }),
                        { status: 200, headers: { 'Content-Type': 'application/json' } }
                    )
                )
            )
        );
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('drops items without cards or studysetUUID', async () => {
        const qc = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={qc}>{children}</QueryClientProvider>
        );

        const { result } = renderHook(() => useGetAllStudysets(), { wrapper });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.studysets).toEqual([validSet]);
    });

    it('drops stubs before validation so the remaining sets still validate', async () => {
        const qc = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={qc}>{children}</QueryClientProvider>
        );

        const { result } = renderHook(() => useGetAllStudysets(), { wrapper });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(console.error).not.toHaveBeenCalledWith(
            expect.stringContaining('validation failed'),
            expect.anything()
        );
    });
});

describe('useGetStudyset', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const renderGetStudyset = (status: number) => {
        const fetchMock = vi.fn(() =>
            Promise.resolve(new Response('{}', { status }))
        );
        vi.stubGlobal('fetch', fetchMock);
        // No retry default here, so the hook's own retry policy is what runs.
        const qc = new QueryClient({
            defaultOptions: { queries: { retryDelay: 0 } },
        });
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={qc}>{children}</QueryClientProvider>
        );
        const { result } = renderHook(
            () => useGetStudyset({ studysetUUID: ID }),
            { wrapper }
        );
        return { fetchMock, result };
    };

    it('does not retry a 404', async () => {
        const { fetchMock, result } = renderGetStudyset(404);

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(isHttpStatus(result.current.error, 404)).toBe(true);
    });

    it('still retries a server error', async () => {
        const { fetchMock, result } = renderGetStudyset(500);

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });
});

describe('usePublishStudyset', () => {
    const gateErrors = [{ code: 'notEnoughCards', required: 4, actual: 2 }];
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn(() =>
            Promise.resolve(
                new Response(
                    JSON.stringify({
                        message: 'Study set cannot be published',
                        errors: gateErrors,
                    }),
                    { status: 400, headers: { 'Content-Type': 'application/json' } }
                )
            )
        );
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('rejects with the gate errors the server returns', async () => {
        const qc = new QueryClient();
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={qc}>{children}</QueryClientProvider>
        );
        const { result } = renderHook(() => usePublishStudyset(), { wrapper });

        const error = await result.current
            .mutateAsync({ studysetUUID: ID, subject: 'math' })
            .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(PublishStudysetError);
        expect((error as PublishStudysetError).status).toBe(400);
        expect((error as PublishStudysetError).errors).toEqual(gateErrors);
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url.endsWith('/studysets/publish-studyset')).toBe(true);
        expect(init.body).toBe(JSON.stringify({ studysetUUID: ID, subject: 'math' }));
    });
});
