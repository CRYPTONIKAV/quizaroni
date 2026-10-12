// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import StudyHeader from 'views/Study/shared/StudyHeader';
import SettingsDialog from 'views/Study/shared/SettingsDialog';
import MatchingStudy from 'views/Study/MatchingStudy';
import MultipleChoiceStudy from 'views/Study/MultipleChoiceStudy';
import enStudy from 'i18n/locales/en/study.json';
import esStudy from 'i18n/locales/es/study.json';
import type { StudySessionSettings } from 'shared/types';

const theme = createTheme();

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, _o?: unknown) => k }),
}));

vi.mock('react-router-dom', () => ({
    useLocation: () => ({ pathname: '/', state: null }),
    useNavigate: () => vi.fn(),
    Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
        <a href={to}>{children}</a>
    ),
    NavLink: ({ to, children }: { to: string; children: React.ReactNode }) => (
        <a href={to}>{children}</a>
    ),
}));

const cards = [
    { cardUUID: 'c1', term: 'hola', definition: 'hello' },
    { cardUUID: 'c2', term: 'gracias', definition: 'thanks' },
];

const sessionSettings: StudySessionSettings = {
    shuffleCards: false,
    timedMode: false,
    audioEnabled: false,
    autoAdvance: true,
    difficulty: 'medium',
    hideImages: false,
};

const session = {
    cards,
    currentCardIndex: 0,
    score: 10,
    streak: 3,
    settings: sessionSettings,
};

vi.mock('state/api/studysetsAPI', () => ({
    useGetStudyset: () => ({
        data: { studyset: { title: 'ES', cards } },
        isLoading: false,
    }),
}));

const startSession = vi.fn();
vi.mock('state/stores/studySession', () => ({
    useStudySessionStore: () => ({
        activeSession: session,
        startSession,
        endSession: vi.fn(),
        updateCurrentCard: vi.fn(),
        recordAnswer: vi.fn(),
        updateCardProgress: vi.fn(),
        incrementScore: vi.fn(),
        updateStreak: vi.fn(),
    }),
}));

vi.mock('shared/keyboard/useShortcuts', () => ({ useShortcuts: () => {} }));
vi.mock('shared/hooks/useHaptics', () => ({
    default: () => ({ light: vi.fn(), sessionComplete: vi.fn() }),
}));
vi.mock('shared/utilities/confetti', () => ({ fireConfetti: vi.fn() }));

const dialogProps = {
    open: true,
    settings: session.settings,
    onClose: vi.fn(),
    onSave: vi.fn(),
};

describe('study views use the study namespace (issue #81)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('StudyHeader renders keys, not hardcoded English', () => {
        render(
            <ThemeProvider theme={theme}>
                <StudyHeader
                    studysetTitle="ES"
                    studysetUUID="u"
                    currentCard={1}
                    totalCards={2}
                    score={10}
                    streak={3}
                    audioEnabled={false}
                    onToggleAudio={vi.fn()}
                    onSettings={vi.fn()}
                />
            </ThemeProvider>,
        );
        // Note: Tooltip titles (backToStudySet, audioOn/Off, settings) only
        // render on hover; visible texts carry the key assertions.
        for (const key of ['header.streak', 'header.score', 'header.progress']) {
            expect(screen.getByText(key)).toBeTruthy();
        }
    });

    it('SettingsDialog renders keys, not hardcoded English', () => {
        render(
            <ThemeProvider theme={theme}>
                <SettingsDialog {...dialogProps} />
            </ThemeProvider>,
        );
        for (const key of [
            'settings.title',
            'settings.cardSection',
            'settings.shuffleCards',
            'settings.audioSection',
            'settings.timerSection',
            'settings.difficultySection',
            'settings.cancel',
            'settings.saveSettings',
        ]) {
            expect(screen.getByText(key)).toBeTruthy();
        }
    });

    it('MatchingStudy renders section keys', () => {
        render(
            <ThemeProvider theme={theme}>
                <MatchingStudy studysetId="s" />
            </ThemeProvider>,
        );
        expect(screen.getByText('matching.terms')).toBeTruthy();
        expect(screen.getByText('matching.definitions')).toBeTruthy();
        expect(screen.getByText('matching.time')).toBeTruthy();
        expect(screen.getByText('matching.matched')).toBeTruthy();
    });

    it('MultipleChoiceStudy feedback renders keys after submit', () => {
        render(
            <ThemeProvider theme={theme}>
                <MultipleChoiceStudy studysetId="s" />
            </ThemeProvider>,
        );
        const radios = screen.getAllByRole('radio');
        fireEvent.click(radios[0]!);
        fireEvent.click(screen.getByText('multipleChoice.submitAnswer'));
        expect(
            screen.getByText(
                (content) =>
                    content.startsWith('multipleChoice.correctFeedback') ||
                    content.startsWith('multipleChoice.incorrectFeedback'),
            ),
        ).toBeTruthy();
    });

    it('study locale files define every rendered key in the same order', () => {
        expect(Object.keys(enStudy)).toEqual(Object.keys(esStudy));
        const keys = [
            'header.backToStudySet',
            'header.streak',
            'header.score',
            'header.progress',
            'header.audioOn',
            'header.audioOff',
            'header.settings',
            'matching.loading',
            'matching.time',
            'matching.matched',
            'matching.terms',
            'matching.definitions',
            'multipleChoice.loading',
            'multipleChoice.correctFeedback',
            'multipleChoice.incorrectFeedback',
            'multipleChoice.submitAnswer',
            'multipleChoice.optionPlaceholder',
            'settings.title',
            'settings.cardSection',
            'settings.shuffleCards',
            'settings.autoAdvance',
            'settings.hideImages',
            'settings.audioSection',
            'settings.tts',
            'settings.timerSection',
            'settings.timedMode',
            'settings.timePerCard',
            'settings.difficultySection',
            'settings.difficultyEasy',
            'settings.difficultyMedium',
            'settings.difficultyHard',
            'settings.difficultyEasyDesc',
            'settings.difficultyMediumDesc',
            'settings.difficultyHardDesc',
            'settings.cancel',
            'settings.saveSettings',
        ];
        const get = (root: Record<string, unknown>, dotted: string) => {
            const [head, ...rest] = dotted.split('.');
            let node: unknown = root[head!];
            for (const part of rest) node = (node as Record<string, unknown>)?.[part];
            return node;
        };
        for (const key of keys) {
            expect(get(enStudy, key)).toBeTruthy();
            expect(get(esStudy, key)).toBeTruthy();
        }
    });
});
