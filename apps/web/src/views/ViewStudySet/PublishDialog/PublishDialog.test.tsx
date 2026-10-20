// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { SUBJECT_IDS } from '@quizaroni/shared-types';
import { PublishStudysetError } from 'state/api/studysetsAPI';
import { Studyset } from 'shared/types';
import PublishDialog from './PublishDialog';

const theme = createTheme();
const ID = '11111111-1111-4111-8111-111111111111';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (k: string, o?: object) => (o ? `${k} ${JSON.stringify(o)}` : k),
    }),
}));

// Mocked wholesale: the real react-router-dom can't load under React 18 here
// (see ImportCardsModal.test.tsx). AppStyles only uses Link for styling.
vi.mock('react-router-dom', () => ({
    Link: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('react-toastify', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        POSITION: { BOTTOM_LEFT: 'bottom-left' },
    },
}));

const publishMock = vi.fn();
const unpublishMock = vi.fn();
let publishPending = false;
vi.mock('state/api/studysetsAPI', async () => ({
    ...(await vi.importActual('state/api/studysetsAPI')),
    usePublishStudyset: () => ({ mutate: publishMock, isPending: publishPending }),
    useUnpublishStudyset: () => ({ mutate: unpublishMock, isPending: false }),
}));

const makeStudyset = (overrides: Partial<Studyset> = {}) =>
    ({
        studysetUUID: ID,
        metadata: { publiclyViewable: false },
        ...overrides,
    }) as unknown as Studyset;

const renderDialog = (studyset = makeStudyset()) => {
    const onClose = vi.fn();
    render(
        <ThemeProvider theme={theme}>
            <PublishDialog open onClose={onClose} studyset={studyset} />
        </ThemeProvider>
    );
    return { onClose };
};

const subjectSelect = () =>
    screen.getByLabelText('publish.subjectLabel') as HTMLSelectElement;

describe('PublishDialog', () => {
    beforeEach(() => {
        publishMock.mockReset();
        unpublishMock.mockReset();
        publishPending = false;
    });

    it('shows the disclosure and every subject, and needs a subject to publish', () => {
        renderDialog();

        expect(screen.getByText('publish.disclosure')).toBeTruthy();
        for (const id of SUBJECT_IDS) {
            expect(screen.getByRole('option', { name: `subjects.${id}` })).toBeTruthy();
        }
        const publishButton = screen.getByRole('button', { name: 'publish.publish' });
        expect((publishButton as HTMLButtonElement).disabled).toBe(true);

        fireEvent.change(subjectSelect(), { target: { value: 'math' } });
        expect((publishButton as HTMLButtonElement).disabled).toBe(false);

        fireEvent.click(publishButton);
        expect(publishMock).toHaveBeenCalledWith(
            { studysetUUID: ID, subject: 'math' },
            expect.anything()
        );
    });

    it('shows the gate errors the server returns and stays open', () => {
        publishMock.mockImplementation((_vars, options) =>
            options.onError(
                new PublishStudysetError(400, [
                    { code: 'notEnoughCards', required: 4, actual: 2 },
                ])
            )
        );
        const { onClose } = renderDialog();

        fireEvent.change(subjectSelect(), { target: { value: 'math' } });
        fireEvent.click(screen.getByRole('button', { name: 'publish.publish' }));

        expect(
            screen.getByText('publish.errors.notEnoughCards {"required":4,"actual":2}')
        ).toBeTruthy();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('offers Unpublish for a published set', () => {
        renderDialog(
            makeStudyset({
                subject: 'math',
                metadata: { publiclyViewable: true } as Studyset['metadata'],
            })
        );

        expect(subjectSelect().value).toBe('math');
        fireEvent.click(screen.getByRole('button', { name: 'publish.unpublish' }));
        expect(unpublishMock).toHaveBeenCalledWith(
            { studysetUUID: ID },
            expect.anything()
        );
    });

    it('disables both actions while a request is pending', () => {
        publishPending = true;
        renderDialog(
            makeStudyset({
                subject: 'math',
                metadata: { publiclyViewable: true } as Studyset['metadata'],
            })
        );

        const update = screen.getByRole('button', { name: 'publish.update' });
        const unpublish = screen.getByRole('button', { name: 'publish.unpublish' });
        expect((update as HTMLButtonElement).disabled).toBe(true);
        expect((unpublish as HTMLButtonElement).disabled).toBe(true);
    });
});
