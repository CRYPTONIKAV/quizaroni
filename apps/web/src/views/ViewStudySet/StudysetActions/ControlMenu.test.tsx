// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { createTheme } from '@mui/material/styles';
import { Studyset } from 'shared/types';
import ControlMenu from './ControlMenu';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('theme/useTheme', () => ({
    useTheme: () => ({ muiTheme: createTheme() }),
}));

const ownSet = (metadata = {}) =>
    ({ studysetUUID: 'set-1', metadata }) as unknown as Studyset;

const renderMenu = (selectedStudyset: Studyset) => {
    const onOpenPublish = vi.fn();
    render(
        <ControlMenu
            open
            anchorEl={document.body}
            onClose={vi.fn()}
            selectedStudyset={selectedStudyset}
            updateMetadataState={vi.fn()}
            onOpenPublish={onOpenPublish}
        />
    );
    return { onOpenPublish };
};

describe('ControlMenu publish entry', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    // Stubbed explicitly so a local .env.local with the flag on can't flip it.
    it('is hidden while the flag is off', () => {
        vi.stubEnv('VITE_FEATURE_PUBLISH', '');
        renderMenu(ownSet());

        expect(screen.queryByText('publish.menuPublish')).toBeNull();
    });

    it('opens the publish dialog when the flag is on', () => {
        vi.stubEnv('VITE_FEATURE_PUBLISH', 'true');
        const { onOpenPublish } = renderMenu(ownSet());

        fireEvent.click(screen.getByText('publish.menuPublish'));
        expect(onOpenPublish).toHaveBeenCalled();
    });

    it('offers to manage publishing for a published set', () => {
        vi.stubEnv('VITE_FEATURE_PUBLISH', 'true');
        renderMenu(ownSet({ publiclyViewable: true }));

        expect(screen.getByText('publish.menuManage')).toBeTruthy();
    });

    it('is hidden when no owned set is loaded', () => {
        vi.stubEnv('VITE_FEATURE_PUBLISH', 'true');
        renderMenu({} as Studyset);

        expect(screen.queryByText('publish.menuPublish')).toBeNull();
    });
});
