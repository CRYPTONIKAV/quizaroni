// @vitest-environment jsdom
import { describe, it, expect } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LoginMessage from 'views/LoginMessage/LoginMessage';
import enAuth from 'i18n/locales/en/auth.json';
import esAuth from 'i18n/locales/es/auth.json';

const theme = createTheme();

async function renderWithLocale(lng: 'en' | 'es', ui: React.ReactElement) {
    const instance = i18n.createInstance();
    await instance.use(initReactI18next).init({
        lng,
        fallbackLng: 'en',
        ns: ['auth'],
        defaultNS: 'auth',
        resources: {
            en: { auth: enAuth },
            es: { auth: esAuth },
        },
    });
    return render(
        <I18nextProvider i18n={instance}>
            <ThemeProvider theme={theme}>{ui}</ThemeProvider>
        </I18nextProvider>,
    );
}

describe('auth views with real i18n (issue #79)', () => {
    it('LoginMessage page=login resolves real English and Spanish strings', async () => {
        const { unmount } = await renderWithLocale('en', <LoginMessage page="login" />);
        expect(screen.getByText("You're already logged in!")).toBeTruthy();
        unmount();
        await renderWithLocale('es', <LoginMessage page="login" />);
        expect(screen.getByText('¡Ya has iniciado sesión!')).toBeTruthy();
    });
});
