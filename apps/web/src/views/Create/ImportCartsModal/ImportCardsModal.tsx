import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogContent,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
    Paper,
} from '@mui/material/';
import {
    UploadFile,
    Restore as RestoreIcon,
    CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import { styled } from '@mui/system';
import { StyledDialogActions } from 'styles/AppStyles';
import StandardDialogTitle from 'components/StandardDialogTitle/StandardDialogTitle';
import {
    Dispatch,
    SetStateAction,
    useCallback,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Card } from 'shared/types';
import { processImport, ImportFormat } from 'utilities/importUtils';
import { parseApkg, ApkgErrorKey, MAX_APKG_BYTES } from 'utilities/ankiApkg';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import ImportPreviewTable from './ImportPreviewTable';

type Props = {
    setShowImportModal: Dispatch<SetStateAction<boolean>>;
    onImportCards: (cards: Card[]) => void;
    existingCards?: Card[];
};

const EditorContainer = styled(Box)({
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
});

const EditorHeader = styled(Box)({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.75rem',
});

const ActionsRow = styled(Box)({
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
});

const StyledTextarea = styled('textarea')<{
    hasError: boolean;
    isDragging: boolean;
}>(({ theme, hasError, isDragging }) => ({
    width: '100%',
    minHeight: '18rem',
    padding: '1rem',
    fontFamily:
        '"Fira Code", "Cascadia Code", "JetBrains Mono", "Consolas", monospace',
    fontSize: '0.875rem',
    lineHeight: '1.5',
    tabSize: 4,
    backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5',
    color: theme.palette.mode === 'dark' ? '#d4d4d4' : '#1e1e1e',
    border: `2px dashed ${
        isDragging
            ? theme.palette.primary.main
            : hasError
              ? theme.palette.error.main
              : theme.palette.divider
    }`,
    borderRadius: '0.5rem',
    outline: 'none',
    resize: 'vertical',
    transition: 'border-color 0.2s ease, background-color 0.2s ease',
    '&:focus': {
        borderColor: hasError
            ? theme.palette.error.main
            : isDragging
              ? theme.palette.primary.main
              : theme.palette.primary.main,
        boxShadow: `0 0 0 2px ${hasError ? theme.palette.error.main + '33' : theme.palette.primary.main + '33'}`,
    },
    '&::selection': {
        backgroundColor: theme.palette.primary.main + '44',
    },
}));

const DropOverlay = styled(Paper)(({ theme }) => ({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
        theme.palette.mode === 'dark'
            ? 'rgba(30, 30, 30, 0.95)'
            : 'rgba(245, 245, 245, 0.95)',
    borderRadius: '0.5rem',
    pointerEvents: 'none',
    zIndex: 10,
    animation: 'pulse 1.5s ease-in-out infinite',
    '@keyframes pulse': {
        '0%, 100%': {
            backgroundColor:
                theme.palette.mode === 'dark'
                    ? 'rgba(30, 30, 30, 0.95)'
                    : 'rgba(245, 245, 245, 0.95)',
        },
        '50%': {
            backgroundColor:
                theme.palette.mode === 'dark'
                    ? 'rgba(25, 118, 210, 0.15)'
                    : 'rgba(25, 118, 210, 0.08)',
        },
    },
}));

// Separator presets offered for Quizlet imports. Values are descriptors the
// importUtils parser understands (named tokens, a literal, or 'custom').
const FIELD_SEPARATORS: { value: string; labelKey: string }[] = [
    { value: 'tab', labelKey: 'create.sepTab' },
    { value: 'comma', labelKey: 'create.sepComma' },
    { value: 'space', labelKey: 'create.sepSpace' },
    { value: ' - ', labelKey: 'create.sepDash' },
    { value: 'custom', labelKey: 'create.sepCustom' },
];

// Maps parseApkg's stable, locale-independent error identifiers to i18n
// keys, so .apkg failures are localized like every other import format
// instead of showing the developer-facing English message from ankiApkg.ts.
const APKG_ERROR_KEY_TO_I18N: Record<ApkgErrorKey, string> = {
    tooLarge: 'create.apkgTooLarge',
    archiveUnreadable: 'create.apkgArchiveUnreadable',
    noCollection: 'create.apkgNoCollection',
    decompressFailed: 'create.apkgDecompressFailed',
    invalidCollection: 'create.apkgInvalidCollection',
    noCards: 'create.apkgNoCards',
};

const ROW_SEPARATORS: { value: string; labelKey: string }[] = [
    { value: 'newline', labelKey: 'create.sepNewline' },
    { value: 'semicolon', labelKey: 'create.sepSemicolon' },
    { value: 'blankline', labelKey: 'create.sepBlankLine' },
    { value: 'custom', labelKey: 'create.sepCustom' },
];

const validateLive = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
        JSON.parse(trimmed);
        return null;
    } catch (e) {
        return (e as Error).message;
    }
};

const ImportCardsModal = ({
    setShowImportModal,
    onImportCards,
    existingCards = [],
}: Props) => {
    const { t } = useTranslation();
    const [jsonInputText, setJsonInputText] = useState<string>('');
    const [selectedFileName, setSelectedFileName] = useState<string | null>(
        null
    );
    const [liveError, setLiveError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragCounterRef = useRef<number>(0);

    const [format, setFormat] = useState<ImportFormat>('json');
    const [fieldSep, setFieldSep] = useState<string>('tab');
    const [fieldSepCustom, setFieldSepCustom] = useState<string>('');
    const [rowSep, setRowSep] = useState<string>('newline');
    const [rowSepCustom, setRowSepCustom] = useState<string>('');
    const [apkgBytes, setApkgBytes] = useState<Uint8Array | null>(null);

    // Preview step: null while the user is still editing/uploading source
    // content; set once parsing succeeds, so the parsed cards can be
    // reviewed and individually deselected before onImportCards commits them.
    const [previewCards, setPreviewCards] = useState<Card[] | null>(null);
    const [selectedRows, setSelectedRows] = useState<boolean[]>([]);
    const [mediaSkippedCount, setMediaSkippedCount] = useState<number>(0);

    const resolvedFieldSep = fieldSep === 'custom' ? fieldSepCustom : fieldSep;
    const resolvedRowSep = rowSep === 'custom' ? rowSepCustom : rowSep;

    // Rebuilding these on every render (e.g. a single row checkbox toggle)
    // would re-walk the full existingCards/previewCards arrays each time -
    // memoized so the PREVIEW_ROW_LIMIT truncation's cost savings aren't
    // undone by an unbounded recompute on every interaction.
    const existingTermSet = useMemo(
        () =>
            new Set(
                existingCards.map((card) => card.term.trim().toLowerCase())
            ),
        [existingCards]
    );
    const duplicateFlags = useMemo(
        () =>
            (previewCards ?? []).map((card) =>
                existingTermSet.has(card.term.trim().toLowerCase())
            ),
        [previewCards, existingTermSet]
    );

    const resetPreview = useCallback(() => {
        setPreviewCards(null);
        setSelectedRows([]);
        setMediaSkippedCount(0);
    }, []);

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            const value = e.target.value;
            setJsonInputText(value);
            // Live syntax validation only applies to JSON; delimited formats
            // are validated on import.
            setLiveError(format === 'json' ? validateLive(value) : null);
            setSubmitError(null);
        },
        [format]
    );

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current += 1;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current -= 1;
        if (dragCounterRef.current === 0) {
            setIsDragging(false);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
    }, []);

    const handleFileUpload = useCallback(
        (file: File) => {
            if (format === 'json' && !file.name.endsWith('.json')) {
                setSubmitError(t('create.pleaseUploadJson'));
                return;
            }
            if (format === 'apkg' && !file.name.endsWith('.apkg')) {
                setSubmitError(t('create.pleaseUploadApkg'));
                return;
            }
            // Reject oversized files before reading them fully into memory
            // (parseApkg's own size guard runs after that read, too late to
            // avoid it).
            if (format === 'apkg' && file.size > MAX_APKG_BYTES) {
                setSubmitError(t('create.apkgTooLarge'));
                return;
            }
            setSubmitError(null);
            setSelectedFileName(file.name);
            resetPreview();

            if (format === 'apkg') {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const buffer = e.target?.result as ArrayBuffer;
                    setApkgBytes(new Uint8Array(buffer));
                };
                reader.onerror = () => {
                    setSubmitError(t('create.failedToReadFile'));
                    setSelectedFileName(null);
                    setApkgBytes(null);
                };
                reader.readAsArrayBuffer(file);
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const text = (e.target?.result as string) ?? '';
                // Pretty-print JSON uploads; leave delimited text untouched.
                if (format === 'json') {
                    try {
                        const parsed = JSON.parse(text);
                        setJsonInputText(JSON.stringify(parsed, null, 4));
                        setLiveError(null);
                    } catch {
                        setJsonInputText(text);
                        setLiveError(validateLive(text));
                    }
                } else {
                    setJsonInputText(text);
                    setLiveError(null);
                }
            };
            reader.onerror = () => {
                setSubmitError(t('create.failedToReadFile'));
                setSelectedFileName(null);
            };
            reader.readAsText(file);
        },
        [format, t, resetPreview]
    );

    const handleFormatChange = useCallback(
        (_e: React.MouseEvent<HTMLElement>, next: ImportFormat | null) => {
            if (!next) return;
            setFormat(next);
            setSubmitError(null);
            setApkgBytes(null);
            setSelectedFileName(null);
            resetPreview();
            // Re-run live validation under the new format's rules.
            setLiveError(next === 'json' ? validateLive(jsonInputText) : null);
        },
        [jsonInputText, resetPreview]
    );

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            dragCounterRef.current = 0;

            // Ignore drops while an import is already in flight (mirrors the
            // upload IconButton's disabled={isProcessing}), so a mid-parse
            // drop can't clobber the bytes/file the current import is using.
            if (isProcessing) return;

            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                const file = files.item(0);
                if (!file) return;
                // handleFileUpload enforces the .json requirement for JSON imports.
                handleFileUpload(file);
            }
        },
        [handleFileUpload, isProcessing]
    );

    const handleReset = useCallback(() => {
        setJsonInputText('');
        setSelectedFileName(null);
        setLiveError(null);
        setSubmitError(null);
        setApkgBytes(null);
        resetPreview();
    }, [resetPreview]);

    // Parses the current source (text or .apkg bytes) into cards and moves
    // the dialog into the preview step, rather than importing immediately -
    // onImportCards is only called once the user confirms from the preview.
    const handleParse = useCallback(async () => {
        setIsProcessing(true);
        setSubmitError(null);

        const seedSelection = (cards: Card[]) => {
            setPreviewCards(cards);
            setSelectedRows(
                cards.map(
                    (card) =>
                        !existingTermSet.has(card.term.trim().toLowerCase())
                )
            );
        };

        if (format === 'apkg') {
            if (!apkgBytes) {
                setSubmitError(t('create.pleaseUploadApkg'));
                setIsProcessing(false);
                return;
            }

            const {
                cards,
                error: importError,
                errorKey,
                mediaSkippedCount: skippedCount,
            } = await parseApkg(apkgBytes);
            if (importError) {
                setSubmitError(
                    t(
                        errorKey
                            ? APKG_ERROR_KEY_TO_I18N[errorKey]
                            : 'create.apkgParseFailed'
                    )
                );
                setIsProcessing(false);
                return;
            }

            seedSelection(cards);
            setMediaSkippedCount(skippedCount);
            setIsProcessing(false);
            return;
        }

        const sourceText = jsonInputText.trim();
        if (!sourceText) {
            setSubmitError(t('create.provideJsonContent'));
            setIsProcessing(false);
            return;
        }

        const { cards, error: importError } = processImport(
            sourceText,
            format,
            {
                fieldSeparator: resolvedFieldSep,
                rowSeparator: resolvedRowSep,
            }
        );
        if (importError) {
            setSubmitError(importError);
            setIsProcessing(false);
            return;
        }
        if (cards.length === 0) {
            setSubmitError(t('create.noValidCardsFound'));
            setIsProcessing(false);
            return;
        }

        seedSelection(cards);
        setIsProcessing(false);
    }, [
        jsonInputText,
        format,
        resolvedFieldSep,
        resolvedRowSep,
        apkgBytes,
        existingTermSet,
        t,
    ]);

    const handleConfirmImport = useCallback(() => {
        if (!previewCards) return;
        const cardsToImport = previewCards.filter(
            (_, index) => selectedRows[index]
        );
        if (cardsToImport.length === 0) return;

        onImportCards(cardsToImport);
        toast.success(
            t('create.successfullyImported', { count: cardsToImport.length })
        );
        setShowImportModal(false);
    }, [previewCards, selectedRows, onImportCards, setShowImportModal, t]);

    const handleBackToEdit = useCallback(() => {
        resetPreview();
    }, [resetPreview]);

    const handleToggleRow = useCallback((index: number) => {
        setSelectedRows((prev) => {
            const next = [...prev];
            next[index] = !next[index];
            return next;
        });
    }, []);

    const handleToggleAllRows = useCallback(
        (next: boolean) => {
            setSelectedRows(
                Array.from({ length: previewCards?.length ?? 0 }, () => next)
            );
        },
        [previewCards]
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (jsonInputText.trim() && !liveError) {
                    void handleParse();
                }
                return;
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                const target = e.target as HTMLTextAreaElement;
                const start = target.selectionStart;
                const end = target.selectionEnd;
                const newValue =
                    jsonInputText.substring(0, start) +
                    '    ' +
                    jsonInputText.substring(end);
                setJsonInputText(newValue);
                requestAnimationFrame(() => {
                    target.selectionStart = target.selectionEnd = start + 4;
                });
            }
        },
        [handleParse, jsonInputText, liveError]
    );

    const onClose = () => setShowImportModal(false);

    const isPreviewStep = previewCards !== null;

    const parseDisabled =
        isProcessing ||
        Boolean(liveError) ||
        (format === 'apkg' ? !apkgBytes : !jsonInputText.trim());

    const selectedCount = selectedRows.filter(Boolean).length;

    const fileAccept =
        format === 'json'
            ? '.json'
            : format === 'apkg'
              ? '.apkg'
              : format === 'markdown'
                ? '.md,.markdown,.txt,.text'
                : '.txt,.csv,.tsv,.text';

    const placeholder =
        format === 'json'
            ? `${t('create.pasteJsonPlaceholder') || 'Paste JSON here...'}\n\n💡 ${t('create.dragDropHint')}`
            : format === 'quizlet'
              ? t('create.pastePlaceholderQuizlet')
              : format === 'markdown'
                ? t('create.pastePlaceholderMarkdown')
                : t('create.pastePlaceholderAnki');

    return (
        <Dialog open={true} onClose={onClose} fullWidth maxWidth="md">
            <StandardDialogTitle
                title={t('create.importCards')}
                onClose={onClose}
            />
            <DialogContent>
                <EditorContainer>
                    {isPreviewStep ? (
                        <>
                            <Typography variant="body2" color="text.secondary">
                                {t('create.previewFoundCards', {
                                    count: previewCards.length,
                                })}
                                {duplicateFlags.some(Boolean) && (
                                    <>
                                        {' '}
                                        •{' '}
                                        {t('create.previewDuplicateCount', {
                                            count: duplicateFlags.filter(
                                                Boolean
                                            ).length,
                                        })}
                                    </>
                                )}
                            </Typography>
                            {mediaSkippedCount > 0 && (
                                <Alert severity="info">
                                    {t('create.apkgMediaSkipped', {
                                        count: mediaSkippedCount,
                                    })}
                                </Alert>
                            )}
                            <ImportPreviewTable
                                cards={previewCards}
                                selected={selectedRows}
                                duplicateFlags={duplicateFlags}
                                onToggle={handleToggleRow}
                                onToggleAll={handleToggleAllRows}
                            />
                        </>
                    ) : (
                        <>
                            <ToggleButtonGroup
                                value={format}
                                exclusive
                                onChange={handleFormatChange}
                                size="small"
                                color="primary"
                                fullWidth
                                disabled={isProcessing}
                            >
                                <ToggleButton value="json">
                                    {t('create.formatJson')}
                                </ToggleButton>
                                <ToggleButton value="quizlet">
                                    {t('create.formatQuizlet')}
                                </ToggleButton>
                                <ToggleButton value="anki">
                                    {t('create.formatAnki')}
                                </ToggleButton>
                                <ToggleButton value="markdown">
                                    {t('create.formatMarkdown')}
                                </ToggleButton>
                                <ToggleButton value="apkg">
                                    {t('create.formatApkg')}
                                </ToggleButton>
                            </ToggleButtonGroup>

                            {format === 'quizlet' && (
                                <Box
                                    sx={{
                                        display: 'flex',
                                        gap: '1rem',
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <FormControl
                                        size="small"
                                        sx={{ minWidth: 180, flex: 1 }}
                                    >
                                        <InputLabel>
                                            {t('create.termDefSeparator')}
                                        </InputLabel>
                                        <Select
                                            label={t('create.termDefSeparator')}
                                            value={fieldSep}
                                            onChange={(e) =>
                                                setFieldSep(
                                                    e.target.value as string
                                                )
                                            }
                                        >
                                            {FIELD_SEPARATORS.map((opt) => (
                                                <MenuItem
                                                    key={opt.value}
                                                    value={opt.value}
                                                >
                                                    {t(opt.labelKey)}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    {fieldSep === 'custom' && (
                                        <TextField
                                            size="small"
                                            label={t('create.customSeparator')}
                                            value={fieldSepCustom}
                                            onChange={(e) =>
                                                setFieldSepCustom(
                                                    e.target.value
                                                )
                                            }
                                            sx={{ width: 140 }}
                                        />
                                    )}
                                    <FormControl
                                        size="small"
                                        sx={{ minWidth: 180, flex: 1 }}
                                    >
                                        <InputLabel>
                                            {t('create.rowSeparatorLabel')}
                                        </InputLabel>
                                        <Select
                                            label={t(
                                                'create.rowSeparatorLabel'
                                            )}
                                            value={rowSep}
                                            onChange={(e) =>
                                                setRowSep(
                                                    e.target.value as string
                                                )
                                            }
                                        >
                                            {ROW_SEPARATORS.map((opt) => (
                                                <MenuItem
                                                    key={opt.value}
                                                    value={opt.value}
                                                >
                                                    {t(opt.labelKey)}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    {rowSep === 'custom' && (
                                        <TextField
                                            size="small"
                                            label={t('create.customSeparator')}
                                            value={rowSepCustom}
                                            onChange={(e) =>
                                                setRowSepCustom(e.target.value)
                                            }
                                            sx={{ width: 140 }}
                                        />
                                    )}
                                </Box>
                            )}

                            <EditorHeader>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                >
                                    {selectedFileName
                                        ? t('create.selectedFile', {
                                              filename: selectedFileName,
                                          })
                                        : format === 'json'
                                          ? t('create.pasteOrUploadJson')
                                          : format === 'quizlet'
                                            ? t('create.quizletHint')
                                            : format === 'markdown'
                                              ? t('create.markdownHint')
                                              : format === 'apkg'
                                                ? t('create.apkgHint')
                                                : t('create.ankiHint')}
                                </Typography>
                                <ActionsRow>
                                    <Tooltip title={t('create.uploadJsonFile')}>
                                        <IconButton
                                            size="small"
                                            onClick={() =>
                                                fileInputRef.current?.click()
                                            }
                                            disabled={isProcessing}
                                        >
                                            <UploadFile />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title={t('create.clearEditor')}>
                                        <span>
                                            <IconButton
                                                size="small"
                                                aria-label={t(
                                                    'create.clearEditor'
                                                )}
                                                onClick={handleReset}
                                                disabled={
                                                    isProcessing ||
                                                    !jsonInputText
                                                }
                                            >
                                                <RestoreIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept={fileAccept}
                                        hidden
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleFileUpload(file);
                                            e.target.value = '';
                                        }}
                                    />
                                </ActionsRow>
                            </EditorHeader>

                            {format === 'apkg' ? (
                                <Box
                                    onClick={() =>
                                        !isProcessing &&
                                        fileInputRef.current?.click()
                                    }
                                    onDragEnter={handleDragEnter}
                                    onDragLeave={handleDragLeave}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                    sx={{
                                        position: 'relative',
                                        minHeight: '18rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.75rem',
                                        border: '2px dashed',
                                        borderColor: isDragging
                                            ? 'primary.main'
                                            : 'divider',
                                        borderRadius: '0.5rem',
                                        cursor: isProcessing
                                            ? 'default'
                                            : 'pointer',
                                        transition: 'border-color 0.2s ease',
                                    }}
                                >
                                    <CloudUploadIcon
                                        sx={{
                                            fontSize: 48,
                                            color: isDragging
                                                ? 'primary.main'
                                                : 'text.secondary',
                                        }}
                                    />
                                    <Typography
                                        variant="body2"
                                        color={
                                            isDragging
                                                ? 'primary.main'
                                                : 'text.secondary'
                                        }
                                        align="center"
                                    >
                                        {t('create.apkgDropPrompt')}
                                    </Typography>
                                    {isProcessing && (
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                        >
                                            {t('create.parsingApkg')}
                                        </Typography>
                                    )}
                                </Box>
                            ) : (
                                <Box sx={{ position: 'relative' }}>
                                    <StyledTextarea
                                        value={jsonInputText}
                                        onChange={handleChange}
                                        onKeyDown={handleKeyDown}
                                        hasError={Boolean(liveError)}
                                        isDragging={isDragging}
                                        spellCheck={false}
                                        autoComplete="off"
                                        autoCorrect="off"
                                        autoCapitalize="off"
                                        placeholder={placeholder}
                                        disabled={isProcessing}
                                        onDragEnter={handleDragEnter}
                                        onDragLeave={handleDragLeave}
                                        onDragOver={handleDragOver}
                                        onDrop={handleDrop}
                                    />
                                    {isDragging && (
                                        <DropOverlay elevation={0}>
                                            <CloudUploadIcon
                                                sx={{
                                                    fontSize: 56,
                                                    color: 'primary.main',
                                                    mb: 1,
                                                }}
                                            />
                                            <Typography
                                                variant="h6"
                                                color="primary.main"
                                                fontWeight="medium"
                                            >
                                                {t('create.dropJsonFile') ||
                                                    'Drop JSON file here'}
                                            </Typography>
                                        </DropOverlay>
                                    )}
                                </Box>
                            )}

                            {liveError && (
                                <Alert severity="warning" variant="outlined">
                                    <Typography
                                        variant="caption"
                                        sx={{ fontFamily: 'monospace' }}
                                    >
                                        {liveError}
                                    </Typography>
                                </Alert>
                            )}
                        </>
                    )}

                    {submitError && (
                        <Alert severity="error">{submitError}</Alert>
                    )}
                </EditorContainer>
            </DialogContent>
            <StyledDialogActions>
                {isPreviewStep ? (
                    <>
                        <Button onClick={handleBackToEdit}>
                            {t('create.previewBack')}
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleConfirmImport}
                            disabled={selectedCount === 0}
                        >
                            {selectedCount > 0
                                ? t('create.previewImportCount', {
                                      count: selectedCount,
                                  })
                                : t('create.previewNoneSelected')}
                        </Button>
                    </>
                ) : (
                    <Button
                        variant="contained"
                        onClick={() => void handleParse()}
                        disabled={parseDisabled}
                        startIcon={
                            isProcessing ? (
                                <CircularProgress size={20} color="inherit" />
                            ) : undefined
                        }
                    >
                        {isProcessing
                            ? t('create.importing')
                            : t('create.preview')}
                    </Button>
                )}
            </StyledDialogActions>
        </Dialog>
    );
};

export default ImportCardsModal;
