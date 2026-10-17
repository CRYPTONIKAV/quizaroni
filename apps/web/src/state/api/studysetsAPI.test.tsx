// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isCompleteStudyset, useGetAllStudysets } from './studysetsAPI';

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
