// @vitest-environment jsdom
import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    afterEach,
} from 'vite-plus/test';
import {
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createLightTheme } from 'shared/theme/themes';
import Explore from './Explore';

const OWNER = '33333333-3333-4333-8333-333333333333';
const OLDER_ID = '11111111-1111-4111-8111-111111111111';
const NEWER_ID = '22222222-2222-4222-8222-222222222222';

const createSpy = vi.fn();

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

vi.mock('hooks/useCreateStudysetAction', () => ({
    useCreateStudysetAction: () => ({
        createAndOpen: createSpy,
        isPending: false,
    }),
}));

const makeSet = (id: string, title: string, lastViewed: string) => ({
    cards: [],
    categories: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    description: '',
    favorited: false,
    labels: [],
    lastViewed,
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
    studysetUUID: id,
    title,
    username: 'owner',
    userUUID: OWNER,
    uuid: id,
});

const json = (status: number, body: unknown) =>
    Promise.resolve(
        new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' },
        })
    );

const withSets = () =>
    json(200, {
        studysets: [
            makeSet(OLDER_ID, 'Older Set', '2026-01-01T00:00:00.000Z'),
            makeSet(NEWER_ID, 'Newer Set', '2026-10-01T00:00:00.000Z'),
            {
                lastViewed: '2026-10-02T00:00:00.000Z',
                updatedAt: '2026-10-02T00:00:00.000Z',
                updatedBy: OWNER,
            },
        ],
    });

const fetchMock = vi.fn((_input: RequestInfo | URL) => withSets());

const renderExplore = () => {
    const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(
        <ThemeProvider theme={createLightTheme()}>
            <QueryClientProvider client={qc}>
                <Explore />
            </QueryClientProvider>
        </ThemeProvider>
    );
};

const allStyles = () =>
    Array.from(document.querySelectorAll('style'))
        .map(
            (style) =>
                style.textContent ||
                Array.from(style.sheet?.cssRules ?? [])
                    .map((rule) => rule.cssText)
                    .join('')
        )
        .join('');

const escapeRegExp = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('Explore', () => {
    beforeEach(() => {
        createSpy.mockClear();
        fetchMock.mockClear();
        fetchMock.mockImplementation(() => withSets());
        vi.stubGlobal('fetch', fetchMock);
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('renders each jump-back-in tile as an article whose H3 links to its set', async () => {
        renderExplore();

        const articles = await screen.findAllByRole('article');
        expect(articles).toHaveLength(2);

        const heading = within(articles[0]!).getByRole('heading', {
            level: 3,
        });
        const link = within(heading).getByRole('link');
        expect(link.getAttribute('href')).toBe(`/view/${NEWER_ID}`);
        expect(link.textContent).toBe('Newer Set');

        expect(
            screen.getByRole('heading', { level: 1, name: 'title' })
        ).toBeTruthy();
        expect(
            screen.getByRole('heading', { level: 2, name: 'forYou.heading' })
        ).toBeTruthy();
    });

    it('hides For you and shows the create-set empty state when there are no sets', async () => {
        fetchMock.mockImplementation(() => json(200, { studysets: [] }));
        renderExplore();

        const button = await screen.findByRole('button', {
            name: 'empty.createSet',
        });
        expect(
            screen.queryByRole('heading', { name: 'forYou.heading' })
        ).toBeNull();
        expect(screen.queryByRole('article')).toBeNull();

        fireEvent.click(button);
        expect(createSpy).toHaveBeenCalledTimes(1);
    });

    it('marks the list busy and hides skeletons while loading', () => {
        fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
        renderExplore();

        const list = screen.getByRole('list', { hidden: true });
        expect(list.getAttribute('aria-busy')).toBe('true');
        // Jump back in is the only source, so at most 3 tiles can load.
        const items = list.querySelectorAll('li');
        expect(items).toHaveLength(3);
        items.forEach((item) =>
            expect(item.getAttribute('aria-hidden')).toBe('true')
        );
        expect(screen.queryByRole('article')).toBeNull();
        expect(screen.getByRole('status').textContent).toBe('forYou.loading');
    });

    it('falls back to the untitled label for a blank title', async () => {
        fetchMock.mockImplementation(() =>
            json(200, {
                studysets: [
                    makeSet(NEWER_ID, '   ', '2026-10-01T00:00:00.000Z'),
                ],
            })
        );
        renderExplore();

        const [article] = await screen.findAllByRole('article');
        expect(within(article!).getByRole('link').textContent).toBe(
            'tile.untitled'
        );
    });

    it('leaves out the description when it is only whitespace', async () => {
        fetchMock.mockImplementation(() =>
            json(200, {
                studysets: [
                    {
                        ...makeSet(
                            NEWER_ID,
                            'Biology',
                            '2026-10-01T00:00:00.000Z'
                        ),
                        description: '  \n ',
                    },
                ],
            })
        );
        renderExplore();

        const [article] = await screen.findAllByRole('article');
        // Eyebrow and card count only.
        expect(article!.querySelectorAll('p')).toHaveLength(2);
    });

    it('shows a retry when loading fails', async () => {
        // The first studysets request fails; the retry hangs so its loading
        // state can be checked.
        let studysetCalls = 0;
        fetchMock.mockImplementation((input: RequestInfo | URL) => {
            const url = input instanceof Request ? input.url : input.toString();
            if (!url.endsWith('/studysets/get-all-studysets')) {
                return json(404, { message: 'not found' });
            }
            studysetCalls += 1;
            return studysetCalls === 1
                ? json(500, { message: 'boom' })
                : new Promise<Response>(() => {});
        });
        renderExplore();

        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toContain('forYou.error');

        const retry = within(alert).getByRole('button', {
            name: 'forYou.retry',
        });
        expect(retry.className).toContain('MuiButton-contained');
        const status = screen.getByRole('status');
        expect(status.textContent).toBe('');

        const callsBefore = fetchMock.mock.calls.length;
        fireEvent.click(retry);
        await waitFor(() =>
            expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore)
        );
        // With no data yet, a refetch resets the query to pending, so the
        // skeletons replace the error while it runs.
        expect(screen.queryByRole('alert')).toBeNull();
        // Same live region, new text, so screen readers announce it.
        expect(screen.getByRole('status')).toBe(status);
        expect(status.textContent).toBe('forYou.loading');
    });

    it('disables the hover lift and entry animation for reduced motion', async () => {
        renderExplore();

        const [article] = await screen.findAllByRole('article');
        const cls = Array.from(article!.classList).find((c) =>
            c.startsWith('css-')
        );
        expect(cls).toBeTruthy();
        const c = escapeRegExp(cls!);
        const css = allStyles();

        expect(css).toMatch(
            new RegExp(
                `@media \\(prefers-reduced-motion: ?reduce\\) ?\\{[^@]*\\.${c} ?\\{[^}]*animation: ?none`
            )
        );
        expect(css).toMatch(
            new RegExp(
                `@media \\(prefers-reduced-motion: ?reduce\\) ?\\{[^@]*\\.${c}:hover ?\\{[^}]*transform: ?none`
            )
        );
        expect(css).toMatch(
            new RegExp(`\\.${c} ?\\{[^}]*animation: ?[^;}]*backwards`)
        );
    });
});
