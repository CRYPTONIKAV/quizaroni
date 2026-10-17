import { Add, DragIndicator, AddPhotoAlternate } from '@mui/icons-material';
import FileUpload from 'components/FileUpload/FileUpload';
import type { Card, TODO } from 'shared/types';
import {
    Dispatch,
    DragEvent,
    SetStateAction,
    useMemo,
    useState,
    useRef,
    useCallback,
} from 'react';
import ImagePreview from './ImagePreview';
import {
    AddCardBelowButton,
    BottomActions,
    NewCard,
    NewCardDefinition,
    NewCardInputField,
    NewCardInputs,
    NewCardLabel,
    NewCardRow,
    NewCardTerm,
} from '../CreateSetStyles';
import useFileUpload from 'hooks/useFileUpload';
import NewCardHeader from './NewCardHeader';
import { addCard } from 'shared/utilities/createUtils';
import { useParams } from 'react-router-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    IconButton,
    Tooltip,
} from '@mui/material';
import { SimpleFlexContainer } from 'shared/styles/AppStyles';
import { styled } from '@mui/system';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { useGetUser } from 'state/api/usersAPI';
import { DEFAULT_USER_RESPONSE } from 'shared/constants';

const ImagePreviewGrid = styled('div')({
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
    marginTop: '0.75rem',
});

type Props = {
    actionsStack: TODO[];
    card: Card;
    createdSetCards: Card[];
    index: number;
    onColorChange: (event: any, property: string, index: number) => void;
    setActionsStack: Dispatch<SetStateAction<TODO[]>>;
    setCreatedSetCards: Dispatch<SetStateAction<Card[]>>;
    updateCardValue: (index: number, property: string, value: any) => void;
};
const NewCardInput = ({
    actionsStack,
    card,
    createdSetCards,
    index,
    onColorChange,
    setActionsStack,
    setCreatedSetCards,
    updateCardValue,
}: Props) => {
    const { t } = useTranslation();
    const {
        data: {
            user: { metadata: { confirmDestructiveActions = true } = {} } = {},
        } = DEFAULT_USER_RESPONSE,
    } = useGetUser();
    const {
        cardUUID,
        term,
        definition,
        backgroundColor = '',
        textColor = '',
    } = card;

    const { id: studysetUUID = '' } = useParams();

    const setStateCallback = setCreatedSetCards;

    const { uploadFile } = useFileUpload({
        cardUUID,
        studysetUUID,
    });

    const termFileInputRef = useRef<HTMLInputElement>(null);
    const definitionFileInputRef = useRef<HTMLInputElement>(null);

    const handleTermFileClick = () => {
        termFileInputRef.current?.click();
    };

    const handleDefinitionFileClick = () => {
        definitionFileInputRef.current?.click();
    };

    const handleFileUpload = useCallback(
        async (files: File[], association: 'term' | 'definition') => {
            try {
                await uploadFile(files, association);
                toast.success(
                    t('create.imageUploaded', { count: files.length })
                );
            } catch {
                toast.error(t('create.imageUploadFailed'));
            }
        },
        [uploadFile, t]
    );

    const handleTermFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileUpload([...e.target.files], 'term');
            e.target.value = '';
        }
    };

    const handleDefinitionFileChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileUpload([...e.target.files], 'definition');
            e.target.value = '';
        }
    };

    // Drag-and-drop state
    const [termDragActive, setTermDragActive] = useState(false);
    const [definitionDragActive, setDefinitionDragActive] = useState(false);

    const handleDrag = useCallback(
        (association: 'term' | 'definition') =>
            (e: DragEvent<HTMLDivElement>) => {
                e.preventDefault();
                e.stopPropagation();
                const setter =
                    association === 'term'
                        ? setTermDragActive
                        : setDefinitionDragActive;
                if (e.type === 'dragenter' || e.type === 'dragover') {
                    setter(true);
                } else if (e.type === 'dragleave') {
                    setter(false);
                }
            },
        []
    );

    const handleDrop = useCallback(
        (association: 'term' | 'definition') =>
            (e: DragEvent<HTMLDivElement>) => {
                e.preventDefault();
                e.stopPropagation();
                const setter =
                    association === 'term'
                        ? setTermDragActive
                        : setDefinitionDragActive;
                setter(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    const imageFiles = [...e.dataTransfer.files].filter((f) =>
                        f.type.startsWith('image/')
                    );
                    if (imageFiles.length > 0) {
                        handleFileUpload(imageFiles, association);
                    }
                }
            },
        [handleFileUpload]
    );

    const [localTextColor, setLocalTextColor] = useState(textColor);
    const [localBackgroundColor, setLocalBackgroundColor] =
        useState(backgroundColor);

    const [applyTextColor, setApplyTextColor] = useState<boolean>(false);
    const [applyBackgroundColor, setApplyBackgroundColor] =
        useState<boolean>(false);
    const displayBackgroundColor = applyBackgroundColor && localBackgroundColor;
    const displayTextColor = applyTextColor && localTextColor;

    // Filter files by association
    const termFiles = useMemo(
        () => (card.files || []).filter((f) => f.association === 'term'),
        [card.files]
    );
    const definitionFiles = useMemo(
        () => (card.files || []).filter((f) => f.association === 'definition'),
        [card.files]
    );

    // Delete handler with confirmation
    const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(
        null
    );
    const fileToDelete = useMemo(
        () => (card.files || []).find((f) => f.key === deleteConfirmKey),
        [card.files, deleteConfirmKey]
    );

    const handleDeleteFile = (fileKey: string) => {
        if (confirmDestructiveActions) {
            setDeleteConfirmKey(fileKey);
        } else {
            const updatedFiles = (card.files || []).filter(
                (f) => f.key !== fileKey
            );
            updateCardValue(index, 'files', updatedFiles);
        }
    };

    const confirmDeleteFile = () => {
        if (deleteConfirmKey) {
            const updatedFiles = (card.files || []).filter(
                (f) => f.key !== deleteConfirmKey
            );
            updateCardValue(index, 'files', updatedFiles);
            setDeleteConfirmKey(null);
            // After the deleted image unmounts, move focus somewhere sensible:
            // the next image's Delete button, or the card's file input when
            // no images are left (keyboard delete otherwise drops focus to
            // <body>).
            setTimeout(() => {
                const deleteBtn = document.querySelector<HTMLButtonElement>(
                    '[aria-label="Delete image"]'
                );
                if (deleteBtn) {
                    deleteBtn.focus();
                    return;
                }
                (termFileInputRef.current ?? definitionFileInputRef.current)
                    ?.focus();
            }, 0);
        }
    };

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: cardUUID });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <NewCard
            ref={setNodeRef}
            style={style}
            raised
            key={cardUUID}
            sx={{
                background: displayBackgroundColor
                    ? localBackgroundColor
                    : undefined,
            }}
        >
            <SimpleFlexContainer
                style={{
                    gap: '0.5rem',
                    padding: '0 1.5rem',
                }}
            >
                <Tooltip title={t('create.dragToReorder')} placement="left">
                    <IconButton
                        {...attributes}
                        {...listeners}
                        sx={{
                            cursor: isDragging ? 'grabbing' : 'grab',
                            padding: '0.25rem',
                        }}
                    >
                        <DragIndicator />
                    </IconButton>
                </Tooltip>
                <div style={{ flex: 1 }}>
                    <NewCardHeader
                        actionsStack={actionsStack}
                        setActionsStack={setActionsStack}
                        applyBackgroundColor={applyBackgroundColor}
                        applyTextColor={applyTextColor}
                        createdSetCards={createdSetCards}
                        index={index}
                        localBackgroundColor={localBackgroundColor}
                        localTextColor={localTextColor}
                        onColorChange={onColorChange}
                        setApplyBackgroundColor={setApplyBackgroundColor}
                        setApplyTextColor={setApplyTextColor}
                        setLocalBackgroundColor={setLocalBackgroundColor}
                        setLocalTextColor={setLocalTextColor}
                        setStateCallback={setStateCallback}
                        updateCardValue={updateCardValue}
                    />
                </div>
            </SimpleFlexContainer>
            <NewCardInputs>
                <NewCardRow>
                    <NewCardTerm
                        onDragEnter={handleDrag('term')}
                        onDragLeave={handleDrag('term')}
                        onDragOver={handleDrag('term')}
                        onDrop={handleDrop('term')}
                        sx={{
                            ...(termDragActive && {
                                outline: '2px dashed',
                                outlineColor: 'primary.main',
                                outlineOffset: '0.25rem',
                                borderRadius: '0.5rem',
                            }),
                        }}
                    >
                        <SimpleFlexContainer
                            style={{
                                gap: '0.5rem',
                                alignItems: 'center',
                                marginBottom: '0.25rem',
                            }}
                        >
                            <NewCardLabel variant="subtitle1">
                                {t('create.term')}
                            </NewCardLabel>
                            <Tooltip
                                title={t('create.uploadImage')}
                                placement="top"
                            >
                                <IconButton
                                    onClick={handleTermFileClick}
                                    size="small"
                                    sx={{
                                        opacity: 0.6,
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            opacity: 1,
                                            backgroundColor: 'action.hover',
                                        },
                                    }}
                                >
                                    <AddPhotoAlternate fontSize="small" />
                                </IconButton>
                            </Tooltip>
                            <input
                                type="file"
                                ref={termFileInputRef}
                                onChange={handleTermFileChange}
                                accept="image/*"
                                style={{ display: 'none' }}
                            />
                        </SimpleFlexContainer>
                        <NewCardInputField
                            variant="standard"
                            placeholder={t('create.enterTerm')}
                            onChange={(e) =>
                                updateCardValue(index, 'term', e.target.value)
                            }
                            multiline
                            maxRows={4}
                            value={term}
                            InputProps={{
                                style: {
                                    color: displayTextColor
                                        ? localTextColor
                                        : undefined,
                                },
                            }}
                        />
                        {termFiles.length > 0 && (
                            <ImagePreviewGrid>
                                {termFiles.map((file) => (
                                    <ImagePreview
                                        key={file.key}
                                        file={file}
                                        onDelete={handleDeleteFile}
                                    />
                                ))}
                            </ImagePreviewGrid>
                        )}
                    </NewCardTerm>
                    <NewCardDefinition
                        onDragEnter={handleDrag('definition')}
                        onDragLeave={handleDrag('definition')}
                        onDragOver={handleDrag('definition')}
                        onDrop={handleDrop('definition')}
                        sx={{
                            ...(definitionDragActive && {
                                outline: '2px dashed',
                                outlineColor: 'primary.main',
                                outlineOffset: '0.25rem',
                                borderRadius: '0.5rem',
                            }),
                        }}
                    >
                        <SimpleFlexContainer
                            style={{
                                gap: '0.5rem',
                                alignItems: 'center',
                                marginBottom: '0.25rem',
                            }}
                        >
                            <NewCardLabel variant="subtitle1">
                                {t('create.definition')}
                            </NewCardLabel>
                            <Tooltip
                                title={t('create.uploadImage')}
                                placement="top"
                            >
                                <IconButton
                                    onClick={handleDefinitionFileClick}
                                    size="small"
                                    sx={{
                                        opacity: 0.6,
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            opacity: 1,
                                            backgroundColor: 'action.hover',
                                        },
                                    }}
                                >
                                    <AddPhotoAlternate fontSize="small" />
                                </IconButton>
                            </Tooltip>
                            <input
                                type="file"
                                ref={definitionFileInputRef}
                                onChange={handleDefinitionFileChange}
                                accept="image/*"
                                style={{ display: 'none' }}
                            />
                        </SimpleFlexContainer>
                        <NewCardInputField
                            variant="standard"
                            placeholder={t('create.enterDefinition')}
                            onChange={(e) =>
                                updateCardValue(
                                    index,
                                    'definition',
                                    e.target.value
                                )
                            }
                            multiline
                            maxRows={4}
                            value={definition}
                            InputProps={{
                                style: {
                                    color: displayTextColor
                                        ? localTextColor
                                        : undefined,
                                },
                            }}
                        />
                        {definitionFiles.length > 0 && (
                            <ImagePreviewGrid>
                                {definitionFiles.map((file) => (
                                    <ImagePreview
                                        key={file.key}
                                        file={file}
                                        onDelete={handleDeleteFile}
                                    />
                                ))}
                            </ImagePreviewGrid>
                        )}
                    </NewCardDefinition>
                </NewCardRow>
                <BottomActions>
                    {index !== createdSetCards.length - 1 && (
                        <AddCardBelowButton
                            onClick={() =>
                                addCard({
                                    actionsStack,
                                    createdSetCards,
                                    index,
                                    setStateCallback,
                                    setActionsStack,
                                })
                            }
                            title={t('create.addCardBelow')}
                        >
                            <Add fontSize="medium" />
                        </AddCardBelowButton>
                    )}
                </BottomActions>
            </NewCardInputs>

            {/* Delete image confirmation dialog */}
            <Dialog
                open={Boolean(deleteConfirmKey)}
                onClose={() => setDeleteConfirmKey(null)}
            >
                <DialogTitle>{t('create.deleteImageTitle')}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {t('create.deleteImageMessage', {
                            name: fileToDelete?.name ?? '',
                        })}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirmKey(null)}>
                        {t('buttons.cancel')}
                    </Button>
                    <Button
                        onClick={confirmDeleteFile}
                        color="error"
                        variant="contained"
                    >
                        {t('buttons.delete')}
                    </Button>
                </DialogActions>
            </Dialog>
        </NewCard>
    );
};

export default NewCardInput;
