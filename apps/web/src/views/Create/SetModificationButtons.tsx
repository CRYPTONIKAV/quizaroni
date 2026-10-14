import {
    KeyboardArrowLeftRounded,
    KeyboardArrowRightRounded,
    KeyboardRounded,
    SwapHoriz,
    Sync,
    UndoRounded,
    UploadFile,
} from '@mui/icons-material';
import {
    Button,
    IconButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Tooltip,
    Typography,
    useMediaQuery,
} from '@mui/material';
import {
    SetModificationsContainer,
    KeysToPressContainer,
} from './CreateSetStyles';
import {
    handleReverse,
    swapAllCards,
} from '../../shared/utilities/createUtils';
import { Dispatch, MouseEvent, SetStateAction, useState } from 'react';
import { Card } from 'shared/types';
import { useTranslation } from 'react-i18next';

type Props = {
    studysetCards: Card[];
    setCardsCallback: Dispatch<SetStateAction<Card[]>>;
    setShowImportModal: Dispatch<SetStateAction<boolean>>;
};

const SetModificationButtons = ({
    studysetCards = [],
    setCardsCallback = () => {},
    setShowImportModal = () => {},
}: Props) => {
    const { t } = useTranslation();
    const hideButtonTextQuery = useMediaQuery(
        'only screen and (max-width:1280px)'
    );
    const [expanded, setExpanded] = useState<boolean>(true);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const keyboardShortcutsOpen = Boolean(anchorEl);

    const expandButtonTitle = expanded
        ? t('create.hideButtons')
        : t('create.expandButtons');

    const onImportClick = (_e: MouseEvent<HTMLButtonElement>) => {
        setShowImportModal(true);
    };

    const onSwapAllClick = (_e: MouseEvent<HTMLButtonElement>) => {
        swapAllCards({
            createdSetCards: studysetCards,
            setStateCallback: setCardsCallback,
        });
    };

    const onReverseClick = (_e: MouseEvent<HTMLButtonElement>) => {
        handleReverse({
            createdSetCards: studysetCards,
            setStateCallback: setCardsCallback,
        });
    };

    const onToggleExpanded = () => {
        setExpanded(!expanded);
    };

    const handleOpenShortcutsMenu = (
        event: React.MouseEvent<HTMLButtonElement>
    ) => {
        setAnchorEl(event.currentTarget);
    };

    const handleCloseShortcutsMenu = () => {
        setAnchorEl(null);
    };

    return (
        <SetModificationsContainer
            sx={{ gap: hideButtonTextQuery ? '0.5rem' : undefined }}
        >
            <Tooltip title={t('create.keyboardShortcuts')}>
                <IconButton
                    onClick={handleOpenShortcutsMenu}
                    aria-label={t('create.keyboardShortcuts')}
                >
                    <KeyboardRounded color="primary" fontSize="medium" />
                </IconButton>
            </Tooltip>
            <Menu
                id="keyboard-shortcuts-menu"
                anchorEl={anchorEl}
                open={keyboardShortcutsOpen}
                onClose={handleCloseShortcutsMenu}
                MenuListProps={{
                    'aria-labelledby': 'basic-button',
                }}
                disableScrollLock
            >
                <MenuItem onClick={handleCloseShortcutsMenu}>
                    <ListItemIcon>
                        <UndoRounded />
                    </ListItemIcon>
                    <ListItemText>{t('create.undo')}</ListItemText>
                    <KeysToPressContainer>
                        <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>Z</kbd>
                    </KeysToPressContainer>
                </MenuItem>
            </Menu>
            <IconButton
                onClick={onToggleExpanded}
                title={`${expandButtonTitle}`}
                aria-label={`${expandButtonTitle}`}
            >
                {expanded ? (
                    <KeyboardArrowLeftRounded fontSize="medium" />
                ) : (
                    <KeyboardArrowRightRounded fontSize="medium" />
                )}
            </IconButton>
            {expanded && (
                <>
                    <Tooltip title={t('create.importCards')}>
                        {hideButtonTextQuery ? (
                            <IconButton
                                onClick={onImportClick}
                                aria-label={t('create.importCards')}
                            >
                                <UploadFile color="primary" fontSize="medium" />
                            </IconButton>
                        ) : (
                            <Button
                                variant="outlined"
                                startIcon={<UploadFile fontSize="medium" />}
                                onClick={onImportClick}
                            >
                                {t('create.importCards')}
                            </Button>
                        )}
                    </Tooltip>
                    <Tooltip title={t('create.swapAll')}>
                        {hideButtonTextQuery ? (
                            <IconButton
                                onClick={onSwapAllClick}
                                aria-label={t('create.swapAll')}
                            >
                                <SwapHoriz color="primary" fontSize="medium" />
                            </IconButton>
                        ) : (
                            <Button
                                variant="outlined"
                                startIcon={<SwapHoriz fontSize="medium" />}
                                onClick={onSwapAllClick}
                            >
                                {t('create.swapAll')}
                            </Button>
                        )}
                    </Tooltip>
                    <Tooltip title={t('create.reverseCards')}>
                        {hideButtonTextQuery ? (
                            <IconButton
                                onClick={onReverseClick}
                                aria-label={t('create.reverseCards')}
                            >
                                <Sync color="primary" fontSize="medium" />
                            </IconButton>
                        ) : (
                            <Button
                                variant="outlined"
                                startIcon={<Sync fontSize="medium" />}
                                onClick={onReverseClick}
                            >
                                {t('create.reverseCards')}
                            </Button>
                        )}
                    </Tooltip>
                </>
            )}
        </SetModificationsContainer>
    );
};

export default SetModificationButtons;
