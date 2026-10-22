// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DEFAULT_USER_RESPONSE } from 'shared/constants';
import Home from './Home';

const muiTheme = createTheme();

const ID = '11111111-1111-4111-8111-111111111111';
const OWNER = '33333333-3333-4333-8333-333333333333';
const NOW = '2026-10-01T12:00:00.000Z';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k }),
}));

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
        Link: FakeLink,
        NavLink: FakeLink,
    };
});

vi.mock('theme/useTheme', () => ({
    useTheme: () => ({ muiTheme }),
}));

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

const json = (status: number, body: unknown) =>
    Promise.resolve(
        new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' },
        })
    );

const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/users/get-user')) {
        return json(200, DEFAULT_USER_RESPONSE);
    }
    if (url.endsWith('/studysets/get-all-studysets')) {
        return json(200, {
            studysets: [
                validSet,
                { lastViewed: NOW, updatedAt: NOW, updatedBy: OWNER },
            ],
        });
    }
    return json(404, { message: 'not found' });
});

describe('Home', () => {
    beforeEach(() => {
        fetchMock.mockClear();
        vi.stubGlobal('fetch', fetchMock);
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        localStorage.clear();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it.each(['grid', 'html'])(
        'renders your sets when the list includes an item without cards (%s view)',
        async (view) => {
            localStorage.setItem('homeView', view);
            const qc = new QueryClient({
                defaultOptions: { queries: { retry: false } },
            });

            render(
                <ThemeProvider theme={muiTheme}>
                    <QueryClientProvider client={qc}>
                        <Home />
                    </QueryClientProvider>
                </ThemeProvider>
            );

            expect(await screen.findByText('Biology Basics')).toBeTruthy();
        }
    );
});
