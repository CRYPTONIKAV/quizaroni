// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createLightTheme } from 'shared/theme/themes';
import { getDateKey, getYesterdayKey } from 'shared/utilities/gamification';
import StreakBadge from './StreakBadge';

let gam: { currentStreak: number; lastStudyDate: string | null };

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('state/stores/gamification', () => ({
    useGamificationStore: <T,>(sel: (s: { state: typeof gam }) => T) =>
        sel({ state: gam }),
}));

const renderBadge = () =>
    render(
        <ThemeProvider theme={createLightTheme()}>
            <StreakBadge />
        </ThemeProvider>
    );

describe('StreakBadge', () => {
    beforeEach(() => {
        gam = { currentStreak: 0, lastStudyDate: null };
    });

    it('shows the streak when the last study day is today', () => {
        gam = { currentStreak: 4, lastStudyDate: getDateKey() };
        const { container } = renderBadge();
        expect(container.textContent).toBe('4');
    });

    it('still shows the streak when the last study day was yesterday', () => {
        gam = { currentStreak: 4, lastStudyDate: getYesterdayKey() };
        const { container } = renderBadge();
        expect(container.textContent).toBe('4');
    });

    it('hides a streak that a missed day has broken', () => {
        gam = {
            currentStreak: 4,
            lastStudyDate: getDateKey(new Date(Date.now() - 3 * 86_400_000)),
        };
        const { container } = renderBadge();
        expect(container.firstChild).toBeNull();
    });
});
