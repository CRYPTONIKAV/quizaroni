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
import { getDateKey, getYesterdayKey } from 'shared/utilities/gamification';
import Explore from './Explore';

const OWNER = '33333333-3333-4333-8333-333333333333';
const OLDER_ID = '11111111-1111-4111-8111-111111111111';
const NEWER_ID = '22222222-2222-4222-8222-222222222222';

const createSpy = vi.fn();
const dueSpy = vi.fn();
let gam: { currentStreak: number; lastStudyDate: string | null };

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

vi.mock('state/local/repositories', () => ({
    cardProgressRepository: {
        getDueCountsBySet: (...args: unknown[]) => dueSpy(...args),
    },
}));

vi.mock('state/stores/gamification', () => ({
    useGamificationStore: <T,>(sel: (s: { state: typeof gam }) => T) =>
        sel({ state: gam }),
}));

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

const cssClass = (el: Element) => {
    const cls = Array.from(el.classList).find((c) => c.startsWith('css-'));
    expect(cls).toBeTruthy();
    return escapeRegExp(cls!);
};

const daysAgo = (n: number) =>
    getDateKey(new Date(Date.now() - n * 86_400_000));

const stubXs = () =>
    vi.stubGlobal('matchMedia', (media: string) => ({
        matches: true,
        media,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
    }));

describe('Explore', () => {
    beforeEach(() => {
        createSpy.mockClear();
        dueSpy.mockReset();
        dueSpy.mockResolvedValue(new Map());
        gam = { currentStreak: 0, lastStudyDate: null };
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
        // At most 5 tiles can load: due, streak and 3 jump back in.
        const items = list.querySelectorAll('li');
        expect(items).toHaveLength(5);
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

    it('shows a due tile whose Review button opens the set with the most cards due', async () => {
        dueSpy.mockResolvedValue(
            new Map([
                [OLDER_ID, 2],
                [NEWER_ID, 5],
            ])
        );
        renderExplore();

        const articles = await screen.findAllByRole('article');
        expect(articles).toHaveLength(3);
        const due = articles[0]!;
        expect(due.textContent).toContain('tile.due.eyebrow');
        const heading = within(due).getByRole('heading', { level: 3 });
        expect(heading.textContent).toBe('tile.due.title');
        expect(within(heading).queryByRole('link')).toBeNull();
        expect(due.textContent).toContain('tile.due.local');
        const review = within(due).getByRole('link', {
            name: 'tile.due.review',
        });
        expect(review.getAttribute('href')).toBe(`/study/${NEWER_ID}/review`);
        expect(review.getAttribute('aria-describedby')).toBe(heading.id);

        // Only complete sets are checked; the stub row is left out.
        const [sets, now] = dueSpy.mock.calls[0]!;
        expect(
            (sets as { studysetUUID: string }[]).map((s) => s.studysetUUID)
        ).toEqual([OLDER_ID, NEWER_ID]);
        expect(now).toBeInstanceOf(Date);
    });

    it.each([
        [
            'today',
            () => getDateKey(),
            'tile.streak.title',
            'tile.streak.studiedToday',
        ],
        [
            'yesterday',
            () => getYesterdayKey(),
            'tile.streak.atRisk',
            'tile.streak.lastStudiedYesterday',
        ],
    ])(
        'shows the streak tile when the last study day is %s',
        async (_when, lastStudyDate, title, meta) => {
            gam = { currentStreak: 4, lastStudyDate: lastStudyDate() };
            renderExplore();

            const articles = await screen.findAllByRole('article');
            expect(articles).toHaveLength(3);
            const streak = articles[0]!;
            expect(streak.textContent).toContain('tile.streak.eyebrow');
            expect(
                within(streak).getByRole('heading', { level: 3 }).textContent
            ).toBe(title);
            expect(streak.textContent).toContain(meta);
            expect(within(streak).queryByRole('link')).toBeNull();
        }
    );

    it('leaves out a streak that a missed day has broken', async () => {
        gam = { currentStreak: 4, lastStudyDate: daysAgo(3) };
        renderExplore();

        const articles = await screen.findAllByRole('article');
        expect(articles).toHaveLength(2);
        expect(screen.queryByText('tile.streak.eyebrow')).toBeNull();
    });

    it('caps For you at 3 tiles on extra-small screens', async () => {
        stubXs();
        dueSpy.mockResolvedValue(new Map([[OLDER_ID, 1]]));
        gam = { currentStreak: 2, lastStudyDate: getDateKey() };
        renderExplore();

        const articles = await screen.findAllByRole('article');
        expect(articles).toHaveLength(3);
        expect(articles[0]!.textContent).toContain('tile.due.eyebrow');
        expect(articles[1]!.textContent).toContain('tile.streak.eyebrow');
        expect(within(articles[2]!).getByRole('link').textContent).toBe(
            'Newer Set'
        );
    });

    it('still shows jump back in when the due lookup fails, and logs why', async () => {
        const failure = new Error('IndexedDB unavailable');
        dueSpy.mockRejectedValue(failure);
        renderExplore();

        const articles = await screen.findAllByRole('article');
        expect(articles).toHaveLength(2);
        expect(screen.queryByText('tile.due.eyebrow')).toBeNull();
        expect(screen.getByRole('list').getAttribute('aria-busy')).toBe(
            'false'
        );
        expect(console.error).toHaveBeenCalledWith(
            'Failed to count due cards:',
            failure
        );
    });

    it('stays loading until the due lookup finishes', async () => {
        dueSpy.mockReturnValue(new Promise(() => {}));
        renderExplore();

        await waitFor(() => expect(dueSpy).toHaveBeenCalled());
        const list = screen.getByRole('list', { hidden: true });
        expect(list.getAttribute('aria-busy')).toBe('true');
        expect(screen.queryByRole('article')).toBeNull();
    });

    it('gives the Review button a focus ring and no hover lift for reduced motion', async () => {
        dueSpy.mockResolvedValue(new Map([[NEWER_ID, 1]]));
        renderExplore();

        const review = await screen.findByRole('link', {
            name: 'tile.due.review',
        });
        const c = cssClass(review);
        const css = allStyles();

        expect(css).toMatch(
            new RegExp(
                `@media \\(prefers-reduced-motion: ?reduce\\) ?\\{[^@]*\\.${c}:hover ?\\{[^}]*transform: ?none`
            )
        );
        expect(css).toMatch(
            new RegExp(
                `\\.${c}\\.Mui-focusVisible ?\\{[^}]*outline: ?2px solid`
            )
        );
    });

    it('only lifts tiles that are links on hover', async () => {
        dueSpy.mockResolvedValue(new Map([[NEWER_ID, 1]]));
        renderExplore();

        const [due, set] = await screen.findAllByRole('article');
        const css = allStyles();
        const lifts = (el: Element) =>
            new RegExp(
                `\\.${cssClass(el)}:hover ?\\{[^}]*transform: ?translateY`
            ).test(css);
        expect(lifts(set!)).toBe(true);
        expect(lifts(due!)).toBe(false);
    });
});
