// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import StudyHeader from 'views/Study/shared/StudyHeader';
import enStudy from 'i18n/locales/en/study.json';
import esStudy from 'i18n/locales/es/study.json';

const theme = createTheme();

vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
}));

async function renderHeader(lng: 'en' | 'es') {
    const instance = i18n.createInstance();
    await instance.use(initReactI18next).init({
        lng,
        fallbackLng: 'en',
        ns: ['study'],
        defaultNS: 'study',
        resources: {
            en: { study: enStudy },
            es: { study: esStudy },
        },
    });
    return render(
        <I18nextProvider i18n={instance}>
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
            </ThemeProvider>
        </I18nextProvider>,
    );
}

describe('study header with real i18n (issue #81)', () => {
    it('interpolates streak/score/progress in English and Spanish', async () => {
        const { unmount } = await renderHeader('en');
        expect(screen.getByText('3 Streak')).toBeTruthy();
        expect(screen.getByText('Score: 10')).toBeTruthy();
        expect(screen.getByText('Card 1 of 2')).toBeTruthy();
        unmount();
        await renderHeader('es');
        expect(screen.getByText('Racha de 3')).toBeTruthy();
        expect(screen.getByText('Puntos: 10')).toBeTruthy();
        expect(screen.getByText('Tarjeta 1 de 2')).toBeTruthy();
    });
});
