// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DEFAULT_USER_RESPONSE } from 'shared/constants';
import ViewStudySet from './ViewStudySet';

const muiTheme = createTheme();

const ID1 = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';
const OWNER = '33333333-3333-4333-8333-333333333333';
const NOW = '2026-10-01T12:00:00.000Z';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k }),
}));

let routeId = ID1;
// Mocked like the other component tests until #102 moves them to MemoryRouter.
vi.mock('react-router-dom', () => {
    const FakeLink = ({
        to,
        children,
        ...rest
    }: {
        to: string;
        children: React.ReactNode;
    }) => (
        <a href={to} {...rest}>
            {children}
        </a>
    );
    return {
        useNavigate: () => vi.fn(),
        useParams: () => ({ id: routeId }),
        Link: FakeLink,
        NavLink: FakeLink,
    };
});

vi.mock('theme/useTheme', () => ({
    useTheme: () => ({ muiTheme }),
}));

vi.mock('./DownloadSetModal/DownloadSetModal', () => ({ default: () => null }));
vi.mock('./ManageCategoriesDialog/ManageCategoriesDialog', () => ({
    default: () => null,
}));
vi.mock('./NotificationsDialog/NotificationsDialog', () => ({
    default: () => null,
}));
vi.mock('./PrintDialog.tsx/PrintDialog', () => ({ default: () => null }));
vi.mock('./StudysetActions/StudysetActions', () => ({ default: () => null }));
vi.mock('./StudysetSettings/StudysetSettings', () => ({ default: () => null }));
vi.mock('./ViewStudySetCard', () => ({ default: () => null }));
vi.mock('./ViewStudySetCardGrid', () => ({ default: () => null }));
vi.mock('./ViewStudysetFilters/ViewStudysetFilters', () => ({
    default: () => null,
}));
vi.mock('./StudyModesGrid/StudyModesGrid', () => ({ default: () => null }));
vi.mock('./NotesDrawer/NotesDrawer', () => ({ default: () => null }));
vi.mock('./AIChatPanel/AIChatPanel', () => ({ default: () => null }));
vi.mock('components/ScrollToTopFab/ScrollToTopFab', () => ({
    default: () => null,
}));

const ownedSet = (studysetUUID: string) => ({
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
    studysetUUID,
    title: 'Owned set',
    username: 'owner',
    userUUID: OWNER,
    uuid: studysetUUID,
});

const json = (status: number, body: unknown) =>
    Promise.resolve(
        new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' },
        })
    );

type GetStudysetHandler = (requestedId: string) => Promise<Response>;
let getStudyset: GetStudysetHandler;

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/users/get-user')) {
        return json(200, DEFAULT_USER_RESPONSE);
    }
    if (url.endsWith('/studysets/get-all-studysets')) {
        return json(200, { studysets: [] });
    }
    if (url.endsWith('/studysets/get-studyset')) {
        const { studysetUUID } = JSON.parse(String(init?.body ?? '{}'));
        return getStudyset(studysetUUID);
    }
    if (url.endsWith('/studysets/update-studyset')) {
        const { studysetUUID } = JSON.parse(String(init?.body ?? '{}'));
        return json(200, { message: 'ok', studyset: ownedSet(studysetUUID) });
    }
    return json(404, { message: 'not found' });
});

const callsTo = (suffix: string) =>
    fetchMock.mock.calls.filter(([input]) => String(input).endsWith(suffix));
const updateCalls = () => callsTo('/studysets/update-studyset');
const updateBody = (index: number) =>
    JSON.parse(String(updateCalls()[index]?.[1]?.body));

// staleTime mirrors state/queryClient.ts so cached data behaves as in the app.
const renderView = (seed?: (qc: QueryClient) => void) => {
    const qc = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 1000 * 60 * 5 } },
    });
    seed?.(qc);
    const tree = () => (
        <ThemeProvider theme={muiTheme}>
            <QueryClientProvider client={qc}>
                <ViewStudySet />
            </QueryClientProvider>
        </ThemeProvider>
    );
    const result = render(tree());
    return { qc, container: result.container, rerender: () => result.rerender(tree()) };
};

describe('ViewStudySet lastViewed', () => {
    beforeEach(() => {
        routeId = ID1;
        fetchMock.mockClear();
        vi.stubGlobal('fetch', fetchMock);
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('does not call update-studyset when the set is not in your library', async () => {
        getStudyset = () => json(500, { message: 'Studyset not found' });
        const { qc, container } = renderView();

        await waitFor(() =>
            expect(callsTo('/studysets/get-studyset').length).toBeGreaterThan(0)
        );
        await waitFor(() =>
            expect(container.querySelector('.MuiSkeleton-root')).toBeNull()
        );
        expect(qc.getMutationCache().getAll()).toHaveLength(0);
        expect(updateCalls()).toHaveLength(0);
    });

    it('does not call update-studyset when get-studyset returns a stub without that id', async () => {
        getStudyset = () =>
            json(200, {
                studyset: { lastViewed: NOW, updatedAt: NOW, updatedBy: OWNER },
            });
        const { qc, container } = renderView();

        await waitFor(() =>
            expect(callsTo('/studysets/get-studyset').length).toBeGreaterThan(0)
        );
        await waitFor(() =>
            expect(container.querySelector('.MuiSkeleton-root')).toBeNull()
        );
        expect(qc.getMutationCache().getAll()).toHaveLength(0);
        expect(updateCalls()).toHaveLength(0);
    });

    // Regression guard for the happy path: green before and after the fix.
    it('records lastViewed once after your own set loads', async () => {
        getStudyset = () => json(200, { studyset: ownedSet(ID1) });
        renderView();

        await waitFor(() => expect(updateCalls()).toHaveLength(1));
        expect(updateBody(0)).toEqual({
            studysetUUID: ID1,
            updates: { lastViewed: expect.any(String) },
        });
        await waitFor(() => expect(callsTo('/studysets/get-studyset')).toHaveLength(2));
        expect(updateCalls()).toHaveLength(1);
    });

    it('does not trust a cached copy of a set that has since been deleted', async () => {
        getStudyset = () => json(500, { message: 'Studyset not found' });
        const { qc } = renderView((client) =>
            client.setQueryData(['studysets', ID1], { studyset: ownedSet(ID1) })
        );

        await waitFor(() =>
            expect(qc.getQueryState(['studysets', ID1])?.status).toBe('error')
        );
        expect(qc.getMutationCache().getAll()).toHaveLength(0);
        expect(updateCalls()).toHaveLength(0);
    });

    it('records lastViewed after refetching a fresh cached set', async () => {
        getStudyset = () => json(200, { studyset: ownedSet(ID1) });
        renderView((client) =>
            client.setQueryData(['studysets', ID1], { studyset: ownedSet(ID1) })
        );

        await waitFor(() => expect(updateCalls()).toHaveLength(1));
        expect(updateBody(0)).toEqual({
            studysetUUID: ID1,
            updates: { lastViewed: expect.any(String) },
        });
        expect(callsTo('/studysets/get-studyset').length).toBeGreaterThan(0);
    });

    it('records lastViewed again when the route switches to another owned set', async () => {
        getStudyset = (requestedId) => json(200, { studyset: ownedSet(requestedId) });
        const { rerender } = renderView();

        await waitFor(() => expect(updateCalls()).toHaveLength(1));
        routeId = ID2;
        rerender();

        await waitFor(() => expect(updateCalls()).toHaveLength(2));
        expect(updateBody(1)).toMatchObject({ studysetUUID: ID2 });
    });
});
