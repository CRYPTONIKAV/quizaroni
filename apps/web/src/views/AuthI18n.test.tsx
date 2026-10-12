// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Login from 'views/Login/Login';
import Signup from 'views/Signup/Signup';
import LoginMessage from 'views/LoginMessage/LoginMessage';
import enAuth from 'i18n/locales/en/auth.json';
import esAuth from 'i18n/locales/es/auth.json';

const theme = createTheme();

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k }),
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

vi.mock('@logto/react', () => ({
    useLogto: () => ({ isAuthenticated: false, signIn: vi.fn() }),
}));

vi.mock('hooks/useBrowserTitle', () => ({
    default: () => {},
}));

describe('auth views use the auth namespace (issue #79)', () => {
    it('Login renders the redirect key, not hardcoded English', () => {
        render(
            <ThemeProvider theme={theme}>
                <Login />
            </ThemeProvider>,
        );
        expect(screen.getByText('redirectingToSignIn')).toBeTruthy();
    });

    it('Signup renders the redirect key, not hardcoded English', () => {
        render(
            <ThemeProvider theme={theme}>
                <Signup />
            </ThemeProvider>,
        );
        expect(screen.getByText('redirectingToSignUp')).toBeTruthy();
    });

    it.each([
        ['login', 'messages.alreadyLoggedIn'],
        ['createSet', 'messages.createSet'],
        ['signup', 'messages.logoutToSignup'],
        ['profile', 'messages.loginToViewProfile'],
        ['home', 'messages.loginToViewHome'],
    ])('LoginMessage renders the messages key for page=%s', (page, key) => {
        render(
            <ThemeProvider theme={theme}>
                <LoginMessage page={page} />
            </ThemeProvider>,
        );
        expect(screen.getByText(key)).toBeTruthy();
    });

    it('auth locale files define every rendered key', () => {        expect(enAuth.redirectingToSignIn).toBeTruthy();
        expect(enAuth.redirectingToSignUp).toBeTruthy();
        expect(esAuth.redirectingToSignIn).toBeTruthy();
        expect(esAuth.redirectingToSignUp).toBeTruthy();
        const pairs: Array<[Record<string, string>, string]> = [
            [enAuth.messages, 'createSet'],
            [enAuth.messages, 'alreadyLoggedIn'],
            [enAuth.messages, 'logoutToSignup'],
            [enAuth.messages, 'loginToViewProfile'],
            [enAuth.messages, 'loginToViewHome'],
            [esAuth.messages, 'createSet'],
            [esAuth.messages, 'alreadyLoggedIn'],
            [esAuth.messages, 'logoutToSignup'],
            [esAuth.messages, 'loginToViewProfile'],
            [esAuth.messages, 'loginToViewHome'],
        ];
        for (const [ns, key] of pairs) {
            expect(ns[key]).toBeTruthy();
        }
    });
});
