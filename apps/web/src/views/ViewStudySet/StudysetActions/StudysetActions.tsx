import {
    ContentCopyRounded,
    Delete,
    Download,
    Edit,
    EditNotifications,
    MenuOpen,
    MergeType,
    Print,
    Settings,
    Share,
} from '@mui/icons-material/';
import { IconButton, Tooltip } from '@mui/material/';
import CustomIconButton from 'components/CustomIconButton/CustomIconButton';
import { Studyset } from 'shared/types';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useGlobalStore } from 'state/stores/global';
import { useViewSetsStore } from 'state/stores/viewSets';
import {
    STUDYSET_CONFIRM_DIALOGS,
    VIEW_SET_DIALOGS,
    type ViewSetDialog,
} from 'shared/constants';
import { ActionButtonsRow } from '../styles';
import ControlMenu from './ControlMenu';
import PublishDialog from '../PublishDialog/PublishDialog';
import { isPublishEnabled } from 'shared/featureFlags';

type Props = {
    updateMetadataField: any;
    selectedStudyset: Studyset | undefined;
};

const StudysetActions = (props: Props) => {
    const { updateMetadataField, selectedStudyset } = props;

    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id: studySetUUID } = useParams();

    const { showConfirmDialog } = useGlobalStore();
    const { setSelectedDialog } = useViewSetsStore();

    const [showControlMenu, setShowControlMenu] = useState<boolean>(false);
    const [showPublishDialog, setShowPublishDialog] = useState(false);
    const controlAnchorRef = useRef(null);

    const handleOpenControlMenu = () => {
        setShowControlMenu(true);
    };

    const handleCloseControlMenu = () => {
        setShowControlMenu(false);
    };

    const updateMetadataState = (property: string) => {
        if (!selectedStudyset) return;

        let newValue;
        switch (property) {
            default:
                newValue = !selectedStudyset.metadata[property];
                break;
        }
        updateMetadataField(property, newValue);
    };

    const handleEditClick = () => {
        navigate(`/edit/${studySetUUID}`);
    };

    const handleShowDialog = (dialog: ViewSetDialog) => {
        setSelectedDialog(dialog);
    };

    /**
     * Displays the confirmation dialog for deleting or duplicating a studyset
     */
    const handleConfirmAction = (action: string) => {
        if (!selectedStudyset) {
            return;
        }

        showConfirmDialog({
            type: action,
            studysets: [selectedStudyset],
        });
    };

    /*
        Former Implementation of tooltip buttons:
        <Tooltip title="Edit Study Set">
            <IconButton color="primary" onClick={handleEditClick}>
                <Edit />
            </IconButton>
        </Tooltip
    */

    return (
        <>
            <ActionButtonsRow>
                {/* <CustomIconButton
                    title={"Control Menu"}
                    color="primary"
                    icon={<MenuOpen />}
                    onClick={handleOpenControlMenu}
                    ref={controlAnchorRef}
                /> */}
                <CustomIconButton
                    iconButtonProps={{
                        color: 'primary',
                        icon: <Edit />,
                        onClick: handleEditClick,
                    }}
                    tooltipProps={{
                        title: t('actions.editStudySet'),
                    }}
                />
                <CustomIconButton
                    iconButtonProps={{
                        color: 'primary',
                        icon: <MergeType />,
                        onClick: () => navigate(`/combine/${studySetUUID}`),
                    }}
                    tooltipProps={{
                        title: 'Combine Study Sets',
                    }}
                />
                <CustomIconButton
                    iconButtonProps={{
                        color: 'primary',
                        icon: <Download />,
                        onClick: () =>
                            handleShowDialog(VIEW_SET_DIALOGS.DOWNLOAD),
                    }}
                    tooltipProps={{
                        title: t('actions.download'),
                    }}
                />
                <CustomIconButton
                    iconButtonProps={{
                        color: 'primary',
                        icon: <EditNotifications />,
                        onClick: () =>
                            handleShowDialog(VIEW_SET_DIALOGS.NOTIFICATIONS),
                    }}
                    tooltipProps={{
                        title: t('actions.manageNotifications'),
                    }}
                />
                <CustomIconButton
                    iconButtonProps={{
                        color: 'primary',
                        icon: <MenuOpen />,
                        onClick: handleOpenControlMenu,
                    }}
                    tooltipProps={{
                        title: t('actions.controlMenu'),
                    }}
                    ref={controlAnchorRef}
                />
                <CustomIconButton
                    iconButtonProps={{
                        color: 'primary',
                        icon: <Print />,
                        onClick: () => handleShowDialog(VIEW_SET_DIALOGS.PRINT),
                    }}
                    tooltipProps={{
                        title: t('actions.print'),
                    }}
                />
                <CustomIconButton
                    iconButtonProps={{
                        color: 'primary',
                        icon: <Delete />,
                        onClick: () =>
                            handleConfirmAction(
                                STUDYSET_CONFIRM_DIALOGS.DELETE
                            ),
                    }}
                    tooltipProps={{
                        title: t('actions.deleteStudySet'),
                    }}
                />
                <CustomIconButton
                    iconButtonProps={{
                        color: 'primary',
                        icon: <ContentCopyRounded />,
                        onClick: () =>
                            handleConfirmAction(
                                STUDYSET_CONFIRM_DIALOGS.DUPLICATE
                            ),
                    }}
                    tooltipProps={{
                        title: t('actions.duplicateStudySet'),
                    }}
                />
                <CustomIconButton
                    iconButtonProps={{
                        color: 'primary',
                        icon: <Settings />,
                        onClick: () =>
                            handleShowDialog(VIEW_SET_DIALOGS.SETTINGS),
                    }}
                    tooltipProps={{
                        title: t('actions.studySetSettings'),
                    }}
                />
                <CustomIconButton
                    iconButtonProps={{
                        color: 'primary',
                        icon: <Share />,
                        onClick: () => handleShowDialog(VIEW_SET_DIALOGS.SHARE),
                    }}
                    tooltipProps={{
                        title: t('actions.share'),
                    }}
                />
            </ActionButtonsRow>
            <ControlMenu
                open={showControlMenu}
                onClose={handleCloseControlMenu}
                anchorEl={controlAnchorRef.current}
                selectedStudyset={selectedStudyset}
                updateMetadataState={updateMetadataState}
                onOpenPublish={() => {
                    setShowControlMenu(false);
                    setShowPublishDialog(true);
                }}
            />
            {isPublishEnabled() && selectedStudyset?.studysetUUID && (
                <PublishDialog
                    open={showPublishDialog}
                    onClose={() => setShowPublishDialog(false)}
                    studyset={selectedStudyset}
                />
            )}
        </>
    );
};

export default StudysetActions;
