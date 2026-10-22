import {
    Box,
    Typography,
    ListItemText,
    Button,
    Collapse,
    Stack,
    Menu,
    MenuItem,
    ListItemIcon,
} from '@mui/material';
import {
    Delete as DeleteIcon,
    Download as DownloadIcon,
    CleaningServices as CleanIcon,
    DataObject as JsonIcon,
    Description as TxtIcon,
    TableChart as CsvIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { MetadataList, ErrorInfo } from 'shared/components/MetadataDialogs';
import { downloadFile } from 'shared/utilities/general';
import { useState, MouseEvent } from 'react';

type Props = {
    categories: string[];
    studysetTitle: string;
    editIndex: number | null;
    deleteIndices: number[];
    onEdit: (index: number) => void;
    onDelete: (index: number) => void;
    onSave: (index: number, value: string) => void;
    onCancel: () => void;
    validateFn: (value: string, index: number) => ErrorInfo;
    onDeleteSelected: () => void;
    onDeleteUnused: () => void;
    isLoading: boolean;
};

export const CategoriesManageTab = ({
    categories,
    studysetTitle,
    editIndex,
    deleteIndices,
    onEdit,
    onDelete,
    onSave,
    onCancel,
    validateFn,
    onDeleteSelected,
    onDeleteUnused,
    isLoading,
}: Props) => {
    const { t } = useTranslation();
    const [downloadMenuAnchor, setDownloadMenuAnchor] =
        useState<null | HTMLElement>(null);
    const categoryItems = categories.map((name) => ({ name }));

    const renderItem = (item: { name: string }) => (
        <ListItemText primary={item.name} />
    );

    const fileBase = `Quizaroni_${studysetTitle}_Categories`;

    const handleDownload = (format: 'json' | 'txt' | 'csv') => {
        setDownloadMenuAnchor(null);
        switch (format) {
            case 'json':
                downloadFile(
                    JSON.stringify(categories, null, 4),
                    `${fileBase}.json`,
                    'application/json'
                );
                break;
            case 'txt':
                downloadFile(
                    categories.join('\n'),
                    `${fileBase}.txt`,
                    'text/plain'
                );
                break;
            case 'csv':
                downloadFile(
                    categories.join(','),
                    `${fileBase}.csv`,
                    'text/csv'
                );
                break;
        }
    };

    return (
        <Box>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    mb: '1rem',
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <Typography variant="h6">
                        {t('categories.categoriesCount', {
                            count: categories.length,
                        })}
                    </Typography>
                    <Stack direction="row" spacing="0.5rem">
                        <Button
                            startIcon={<DownloadIcon />}
                            onClick={(e: MouseEvent<HTMLButtonElement>) =>
                                setDownloadMenuAnchor(e.currentTarget)
                            }
                            size="small"
                            disabled={categories.length === 0}
                        >
                            {t('categories.download')}
                        </Button>
                        <Menu
                            anchorEl={downloadMenuAnchor}
                            open={Boolean(downloadMenuAnchor)}
                            onClose={() => setDownloadMenuAnchor(null)}
                        >
                            <MenuItem onClick={() => handleDownload('json')}>
                                <ListItemIcon>
                                    <JsonIcon fontSize="small" />
                                </ListItemIcon>
                                JSON
                            </MenuItem>
                            <MenuItem onClick={() => handleDownload('txt')}>
                                <ListItemIcon>
                                    <TxtIcon fontSize="small" />
                                </ListItemIcon>
                                TXT
                            </MenuItem>
                            <MenuItem onClick={() => handleDownload('csv')}>
                                <ListItemIcon>
                                    <CsvIcon fontSize="small" />
                                </ListItemIcon>
                                CSV
                            </MenuItem>
                        </Menu>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<CleanIcon />}
                            onClick={onDeleteUnused}
                            disabled={categories.length === 0 || isLoading}
                        >
                            {t('categories.deleteUnused')}
                        </Button>
                    </Stack>
                </Box>
            </Box>

            <Collapse in={deleteIndices.length > 0} timeout={200}>
                <Box
                    sx={{
                        bgcolor: 'error.dark',
                        color: 'error.contrastText',
                        px: '1rem',
                        py: '0.5rem',
                        mb: '1rem',
                        borderRadius: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                    }}
                >
                    <Typography variant="body2" fontWeight={500}>
                        {t('categories.itemSelected', {
                            count: deleteIndices.length,
                        })}
                    </Typography>
                    <Button
                        color="inherit"
                        variant="outlined"
                        size="small"
                        startIcon={<DeleteIcon />}
                        onClick={onDeleteSelected}
                        sx={{
                            borderColor: 'currentColor',
                            fontSize: '0.75rem',
                            py: '0.25rem',
                            px: '0.75rem',
                            '&:hover': {
                                borderColor: 'currentColor',
                                bgcolor: 'rgba(255, 255, 255, 0.1)',
                            },
                        }}
                    >
                        {t('categories.delete')}
                    </Button>
                </Box>
            </Collapse>

            <MetadataList
                items={categoryItems}
                editIndex={editIndex}
                deleteIndices={deleteIndices}
                onEdit={onEdit}
                onDelete={onDelete}
                onSave={onSave}
                onCancel={onCancel}
                validateFn={validateFn}
                renderItem={renderItem}
                isLoading={isLoading}
                emptyMessage={t('categories.noCategoriesYet')}
                emptySubMessage={t('categories.createFirstCategory')}
            />
        </Box>
    );
};
