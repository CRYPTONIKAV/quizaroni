import { useState, useRef } from 'react';
import { Dialog, CircularProgress } from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import StandardDialogTitle from 'components/StandardDialogTitle/StandardDialogTitle';
import SettingsToggle from 'components/SettingsToggle/SettingsToggle';
import { useUpdateStudyset } from 'state/api/studysetsAPI';
import { Studyset, PrintConfig } from 'shared/types';
import {
    PRINT_LAYOUT_OPTIONS,
    PRINT_INCLUDE_NOTES_OPTIONS,
    PRINT_INCLUDE_FILES_OPTIONS,
    PRINT_INCLUDE_CATEGORIES_OPTIONS,
    PRINT_SHOW_COLORS_OPTIONS,
    PRINT_IMPORTANT_ONLY_OPTIONS,
    PRINT_LAYOUTS,
} from 'shared/constants';
import {
    StyledDialogContent,
    PreviewPanel,
    SettingsPanel,
    PrintButton,
    PrintPreviewContainer,
} from './styles';
import PrintPreview from './PrintPreview';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';

type Props = {
    open: boolean;
    onClose: () => void;
    studyset: Studyset | undefined;
};

const PrintDialog = ({ open, onClose, studyset }: Props) => {
    const { t } = useTranslation();
    const { mutate: updateStudySet } = useUpdateStudyset();
    const printRef = useRef<HTMLDivElement>(null);

    const defaultPrintConfig: PrintConfig = {
        layout: studyset?.metadata?.printConfig?.layout ?? PRINT_LAYOUTS.LIST,
        includeNotes: studyset?.metadata?.printConfig?.includeNotes ?? true,
        includeFiles: studyset?.metadata?.printConfig?.includeFiles ?? true,
        includeCategories:
            studyset?.metadata?.printConfig?.includeCategories ?? true,
        showColors: studyset?.metadata?.printConfig?.showColors ?? false,
        importantOnly: studyset?.metadata?.printConfig?.importantOnly ?? false,
    };

    const [printSettings, setPrintSettings] =
        useState<PrintConfig>(defaultPrintConfig);
    const [isGenerating, setIsGenerating] = useState(false);

    const handleSettingChange = (
        _event: React.MouseEvent<HTMLElement, MouseEvent>,
        value: any,
        property?: string
    ) => {
        if (!property || !studyset?.studysetUUID) {
            return;
        }

        const newPrintConfig = { ...printSettings, [property]: value };
        setPrintSettings(newPrintConfig);

        updateStudySet({
            studysetUUID: studyset.studysetUUID,
            updates: { printConfig: newPrintConfig },
            isMetadataUpdate: true,
        });
    };

    const handleDownloadPdf = async () => {
        if (!studyset) return;

        setIsGenerating(true);

        try {
            // Load the PDF generators (and jsPDF) on demand so the library only
            // downloads when the user actually generates a PDF.
            const { getPdfGenerator } = await import('./pdfGenerators');
            const generator = getPdfGenerator(printSettings.layout);
            const cards = printSettings.importantOnly
                ? studyset.cards.filter((c) => c.important)
                : studyset.cards;

            const doc = await generator.generate(
                studyset,
                cards,
                printSettings
            );

            const filename = `${studyset.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
            doc.save(filename);
        } catch (error) {
            console.error('PDF generation failed:', error);
            toast.error(t('dialogs.print.failedToGenerate'));
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullScreen>
            <StandardDialogTitle
                title={t('dialogs.print.title')}
                onClose={onClose}
            />
            <StyledDialogContent>
                <PreviewPanel>
                    <PrintPreviewContainer ref={printRef}>
                        <PrintPreview
                            studyset={studyset}
                            settings={printSettings}
                        />
                    </PrintPreviewContainer>
                </PreviewPanel>

                <SettingsPanel>
                    <SettingsToggle
                        label={t('dialogs.print.layoutStyle')}
                        options={PRINT_LAYOUT_OPTIONS}
                        selectedValue={printSettings.layout}
                        property="layout"
                        onChange={handleSettingChange}
                    />
                    <SettingsToggle
                        label={t('dialogs.print.includeNotes')}
                        options={PRINT_INCLUDE_NOTES_OPTIONS}
                        selectedValue={printSettings.includeNotes}
                        property="includeNotes"
                        onChange={handleSettingChange}
                    />
                    <SettingsToggle
                        label={t('dialogs.print.includeFileAttachments')}
                        options={PRINT_INCLUDE_FILES_OPTIONS}
                        selectedValue={printSettings.includeFiles}
                        property="includeFiles"
                        onChange={handleSettingChange}
                    />
                    <SettingsToggle
                        label={t('dialogs.print.includeCategories')}
                        options={PRINT_INCLUDE_CATEGORIES_OPTIONS}
                        selectedValue={printSettings.includeCategories}
                        property="includeCategories"
                        onChange={handleSettingChange}
                    />
                    <SettingsToggle
                        label={t('dialogs.print.showCardColors')}
                        options={PRINT_SHOW_COLORS_OPTIONS}
                        selectedValue={printSettings.showColors}
                        property="showColors"
                        onChange={handleSettingChange}
                    />
                    <SettingsToggle
                        label={t('dialogs.print.cardsToPrint')}
                        options={PRINT_IMPORTANT_ONLY_OPTIONS}
                        selectedValue={printSettings.importantOnly}
                        property="importantOnly"
                        onChange={handleSettingChange}
                    />

                    <PrintButton
                        variant="contained"
                        startIcon={
                            isGenerating ? (
                                <CircularProgress size={20} color="inherit" />
                            ) : (
                                <DownloadIcon />
                            )
                        }
                        onClick={handleDownloadPdf}
                        disabled={isGenerating || !studyset}
                    >
                        {isGenerating
                            ? t('dialogs.print.generatingPdf')
                            : t('dialogs.print.downloadPdf')}
                    </PrintButton>
                </SettingsPanel>
            </StyledDialogContent>
        </Dialog>
    );
};

export default PrintDialog;
