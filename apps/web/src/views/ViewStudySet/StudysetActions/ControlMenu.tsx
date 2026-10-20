import {
    Menu,
    MenuItem,
    FormControlLabel,
    Switch,
    Typography,
} from '@mui/material';
import { SET_METADATA_FIELDS, ENABLED, DISABLED } from 'shared/constants';
import { Studyset, TODO } from 'shared/types';
import { useTheme } from 'theme/useTheme';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isPublishEnabled } from 'shared/featureFlags';

type Props = {
    anchorEl: Element | null;
    onClose: () => void;
    open: boolean;
    selectedStudyset: Studyset | undefined;
    updateMetadataState: any;
    onOpenPublish: () => void;
};

const ControlMenu = ({
    anchorEl,
    onClose,
    open,
    selectedStudyset,
    updateMetadataState,
    onOpenPublish,
}: Props) => {
    const { muiTheme } = useTheme();
    const { t } = useTranslation();

    const { metadata = {} } = selectedStudyset || {};
    const {
        // @ts-ignore
        backgroundColorVisible = false,
        // @ts-ignore
        publiclyViewable = false,
        // @ts-ignore
        textColorVisible = false,
        // @ts-ignore
        contentOnly = false,
    } = metadata;

    // A non-owner viewing someone else's set gets an empty selectedStudyset.
    const canPublish = isPublishEnabled() && !!selectedStudyset?.studysetUUID;

    const menuItems = useMemo(
        () => [
            {
                condition: textColorVisible,
                updateProperty: SET_METADATA_FIELDS.TEXT,
                label: 'Text Color',
                description:
                    'If enabled, text color for the term/definition will be applied/visible.',
            },
            {
                condition: backgroundColorVisible,
                updateProperty: SET_METADATA_FIELDS.BACKGROUND,
                label: 'Background Color',
                description:
                    'If enabled, background color for cards will be applied/visible.',
            },
            {
                condition: contentOnly,
                updateProperty: SET_METADATA_FIELDS.CONTENT_ONLY,
                label: 'Content Only',
                description:
                    'If enabled, buttons and labels on all cards will be hidden.',
            },
        ],
        [textColorVisible, backgroundColorVisible, contentOnly]
    );

    return (
        <Menu open={open} onClose={onClose} anchorEl={anchorEl}>
            {menuItems.map(
                ({ condition, updateProperty, label, description }) => {
                    return (
                        <MenuItem key={updateProperty}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        size="small"
                                        checked={condition}
                                        onChange={() =>
                                            updateMetadataState(updateProperty)
                                        }
                                    />
                                }
                                label={
                                    <Typography
                                        sx={{
                                            color: condition
                                                ? muiTheme.palette.success.main
                                                : muiTheme.palette.error.main,
                                        }}
                                    >
                                        {`${label}: ${
                                            condition ? ENABLED : DISABLED
                                        }`}
                                    </Typography>
                                }
                                title={description}
                            />
                        </MenuItem>
                    );
                }
            )}
            {canPublish && (
                <MenuItem onClick={onOpenPublish}>
                    {t(
                        publiclyViewable
                            ? 'publish.menuManage'
                            : 'publish.menuPublish'
                    )}
                </MenuItem>
            )}
        </Menu>
    );
};

export default ControlMenu;
