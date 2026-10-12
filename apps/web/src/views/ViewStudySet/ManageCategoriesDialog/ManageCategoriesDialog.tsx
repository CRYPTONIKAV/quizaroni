import { Box, SelectChangeEvent } from '@mui/material';
import { Studyset } from 'shared/types';
import {
    ChangeEvent,
    useState,
    useCallback,
    SyntheticEvent,
    useRef,
    useEffect,
} from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { useUpdateStudyset } from 'state/api/studysetsAPI';
import AssignTabView from './AssignTabView';
import { CategoriesCreateTab } from './CategoriesCreateTab';
import { CategoriesManageTab } from './CategoriesManageTab';
import ImportTabView from './ImportTabView';
import { TABS } from './constants';
import {
    MetadataDialogShell,
    TabConfig,
    ErrorInfo,
} from 'shared/components/MetadataDialogs';
import {
    Edit as EditIcon,
    SwapHoriz as ImportIcon,
    Label as AssignIcon,
} from '@mui/icons-material';

type Props = {
    open: boolean;
    onClose: () => void;
    selectedStudyset: Studyset;
    studysets: Studyset[];
};

const ManageCategoriesDialog = (props: Props) => {
    const { open, onClose, selectedStudyset, studysets } = props;

    const { t } = useTranslation();

    const {
        cards = [],
        categories = [],
        title: studysetTitle = '',
        studysetUUID = '',
    } = selectedStudyset;

    const { mutate: updateStudySet } = useUpdateStudyset();

    const [selectedTab, setSelectedTab] = useState<string>(TABS.MANAGE);
    const [errorInfo, setErrorInfo] = useState<ErrorInfo>(null);
    const [categoryName, setCategoryName] = useState<string>('');
    const [editIndex, setEditIndex] = useState<number | null>(null);
    const [deleteIndices, setDeleteIndices] = useState<number[]>([]);
    const [selectedStudysetUUID, setSelectedStudysetUUID] =
        useState<string>('');
    const [selectedCardUUID, setSelectedCardUUID] = useState<string>('');
    const [assignedCategoriesSelection, setAssignedCategoriesSelection] =
        useState<string[]>([]);
    const [isUpdating, setIsUpdating] = useState(false);

    const assignDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
        null
    );
    const cardsRef = useRef(cards);
    cardsRef.current = cards;
    const studysetUUIDRef = useRef(studysetUUID);
    studysetUUIDRef.current = studysetUUID;
    const selectedCardUUIDRef = useRef(selectedCardUUID);
    selectedCardUUIDRef.current = selectedCardUUID;

    useEffect(() => {
        // Use cardsRef to avoid dependency on cards array reference
        const card = cardsRef.current.find(
            (c) => c.cardUUID === selectedCardUUID
        );
        setAssignedCategoriesSelection(card?.categories ?? []);
        // Only run when selectedCardUUID or open changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCardUUID, open]);

    useEffect(
        () => () => {
            if (assignDebounceRef.current) {
                clearTimeout(assignDebounceRef.current);
            }
        },
        []
    );

    const tabs: TabConfig[] = [
        {
            value: TABS.MANAGE,
            label: t('categories.manage'),
            icon: <EditIcon />,
        },
        {
            value: TABS.IMPORT,
            label: t('categories.import'),
            icon: <ImportIcon />,
        },
        {
            value: TABS.ASSIGN,
            label: t('categories.assign'),
            icon: <AssignIcon />,
        },
    ];

    const isManageTab = selectedTab === TABS.MANAGE;
    const isImportTab = selectedTab === TABS.IMPORT;
    const isAssignTab = selectedTab === TABS.ASSIGN;

    const onTabChange = (_e: SyntheticEvent, newTab: string) => {
        setSelectedTab(newTab);
    };

    // Validation
    const validateCategory = useCallback(
        (value: string, excludeIndex?: number): ErrorInfo => {
            if (!value.trim()) {
                return { helperText: t('categories.nameCannotBeEmpty') };
            }
            const isDuplicate = categories.some(
                (cat, i) => cat === value && i !== excludeIndex
            );
            if (isDuplicate) {
                return { helperText: t('categories.categoryAlreadyExists') };
            }
            return null;
        },
        [categories, t]
    );

    // Create Category
    const onCreateCategoryChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            const category = e.target.value;
            setCategoryName(category);
            const error = validateCategory(category);
            setErrorInfo(error);
        },
        [validateCategory]
    );

    const createCategory = useCallback(() => {
        if (!studysetUUID || !categoryName.trim() || errorInfo) {
            return;
        }
        const newCategories = [...categories, categoryName.trim()];
        setIsUpdating(true);
        updateStudySet(
            {
                studysetUUID,
                updates: {
                    categories: newCategories,
                },
            },
            {
                onSuccess: () => {
                    setCategoryName('');
                    setErrorInfo(null);
                    setIsUpdating(false);
                },
                onError: () => {
                    setIsUpdating(false);
                },
            }
        );
    }, [
        studysetUUID,
        categoryName,
        errorInfo,
        categories,
        updateStudySet,
        validateCategory,
    ]);

    // Edit Category (inline)
    const handleEditStart = useCallback((index: number) => {
        setEditIndex(index);
        setDeleteIndices([]);
    }, []);

    const handleEditCancel = useCallback(() => {
        setEditIndex(null);
    }, []);

    const handleEdit = useCallback(
        (index: number, newName: string) => {
            const oldCategoryName = categories[index];
            if (!oldCategoryName || newName === oldCategoryName) {
                setEditIndex(null);
                return;
            }

            const categoriesAfterEdit = [...categories];
            categoriesAfterEdit[index] = newName.trim();

            // Update category name in all affected cards
            const modifiedCards = cards.map((card) => ({
                ...card,
                categories: card.categories.map((cat) =>
                    cat === oldCategoryName ? newName.trim() : cat
                ),
            }));

            setIsUpdating(true);
            updateStudySet(
                {
                    studysetUUID,
                    updates: {
                        cards: modifiedCards,
                        categories: categoriesAfterEdit,
                    },
                },
                {
                    onSuccess: () => {
                        setEditIndex(null);
                        setIsUpdating(false);
                    },
                    onError: () => {
                        setIsUpdating(false);
                    },
                }
            );
        },
        [studysetUUID, categories, cards, updateStudySet]
    );

    // Delete Categories
    const handleDeleteToggle = useCallback((index: number) => {
        setDeleteIndices((prev) =>
            prev.includes(index)
                ? prev.filter((i) => i !== index)
                : [...prev, index]
        );
        setEditIndex(null);
    }, []);

    const handleDelete = useCallback(() => {
        if (deleteIndices.length === 0) return;

        const categoriesToDelete = deleteIndices.map((i) => categories[i]);
        const filteredCategories = categories.filter(
            (_, i) => !deleteIndices.includes(i)
        );

        // Remove categories from all cards
        const modifiedCards = cards.map((card) => ({
            ...card,
            categories: card.categories.filter(
                (cat) => !categoriesToDelete.includes(cat)
            ),
        }));

        setIsUpdating(true);
        updateStudySet(
            {
                studysetUUID,
                updates: {
                    cards: modifiedCards,
                    categories: filteredCategories,
                },
            },
            {
                onSuccess: () => {
                    setDeleteIndices([]);
                    setIsUpdating(false);
                },
                onError: () => {
                    setIsUpdating(false);
                },
            }
        );
    }, [studysetUUID, deleteIndices, categories, cards, updateStudySet]);

    const onAssignedCategoriesChange = (e: SelectChangeEvent<string[]>) => {
        const raw = e.target.value;
        const newCategories =
            typeof raw === 'string'
                ? (raw as string).split(',')
                : (raw as string[]);
        setAssignedCategoriesSelection(newCategories);

        if (assignDebounceRef.current) {
            clearTimeout(assignDebounceRef.current);
        }
        assignDebounceRef.current = setTimeout(() => {
            const snapshotCards = cardsRef.current;
            const targetCardUUID = selectedCardUUIDRef.current;
            const modifiedCards = snapshotCards.map((card) =>
                card.cardUUID === targetCardUUID
                    ? { ...card, categories: newCategories }
                    : card
            );
            updateStudySet({
                studysetUUID: studysetUUIDRef.current,
                updates: {
                    cards: modifiedCards,
                },
            });
            assignDebounceRef.current = null;
        }, 400);
    };

    const handleImport = () => {
        if (!selectedStudysetUUID) {
            return;
        }
        const importSetCategories =
            studysets.find(
                (studySet) => studySet.studysetUUID === selectedStudysetUUID
            )?.categories ?? [];

        // Ensure no duplicates, filter out categories that already exist
        const categoriesToImport = importSetCategories.filter(
            (category) => !categories.includes(category)
        );

        const combinedCategories = categories.concat(categoriesToImport);
        updateStudySet({
            studysetUUID,
            updates: {
                categories: combinedCategories,
            },
        });
    };

    const handleFileImport = useCallback(
        (newCategories: string[]) => {
            const combinedCategories = categories.concat(newCategories);
            updateStudySet({
                studysetUUID,
                updates: {
                    categories: combinedCategories,
                },
            });
        },
        [studysetUUID, categories, updateStudySet]
    );

    // Delete Unused Categories
    const handleDeleteUnused = useCallback(() => {
        const usedCategories = new Set(
            cards.flatMap((card) => card.categories)
        );
        const unusedCategories = categories.filter(
            (cat) => !usedCategories.has(cat)
        );

        if (unusedCategories.length === 0) {
            toast.error(t('categories.noUnusedCategories'));
            return;
        }

        const filteredCategories = categories.filter((cat) =>
            usedCategories.has(cat)
        );

        setIsUpdating(true);
        updateStudySet(
            {
                studysetUUID,
                updates: {
                    categories: filteredCategories,
                },
            },
            {
                onSuccess: () => {
                    setIsUpdating(false);
                },
                onError: () => {
                    setIsUpdating(false);
                },
            }
        );
    }, [studysetUUID, categories, cards, updateStudySet]);

    return (
        <MetadataDialogShell
            open={open}
            onClose={onClose}
            title={t('categories.manageCategories')}
            tabs={tabs}
            selectedTab={selectedTab}
            onTabChange={setSelectedTab}
            maxWidth="lg"
        >
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns:
                        selectedTab === TABS.MANAGE ? '1fr 1fr' : '1fr',
                    gap: '1.25rem',
                    '@media (max-width: 900px)': {
                        gridTemplateColumns: '1fr',
                    },
                }}
            >
                {/* MANAGE tab: 2 columns (form + list) */}
                {isManageTab && (
                    <>
                        {/* Left: Create form */}
                        <Box>
                            <CategoriesCreateTab
                                categoryName={categoryName}
                                errorInfo={errorInfo}
                                onCategoryChange={onCreateCategoryChange}
                                onSubmit={createCategory}
                                isLoading={isUpdating}
                            />
                        </Box>

                        {/* Right: Categories List */}
                        <Box>
                            <CategoriesManageTab
                                categories={categories}
                                studysetTitle={studysetTitle}
                                editIndex={editIndex}
                                deleteIndices={deleteIndices}
                                onEdit={handleEditStart}
                                onDelete={handleDeleteToggle}
                                onSave={handleEdit}
                                onCancel={handleEditCancel}
                                validateFn={validateCategory}
                                onDeleteSelected={handleDelete}
                                onDeleteUnused={handleDeleteUnused}
                                isLoading={isUpdating}
                            />
                        </Box>
                    </>
                )}

                {/* IMPORT tab: 1 column */}
                {isImportTab && (
                    <ImportTabView
                        selectedStudysetUUID={selectedStudysetUUID}
                        studysets={studysets}
                        selectedStudyset={selectedStudyset}
                        setSelectedStudysetUUID={setSelectedStudysetUUID}
                        handleImport={handleImport}
                        onFileImport={handleFileImport}
                    />
                )}

                {/* ASSIGN tab: 1 column */}
                {isAssignTab && (
                    <AssignTabView
                        selectedCardUUID={selectedCardUUID}
                        setSelectedCardUUID={setSelectedCardUUID}
                        selectedStudyset={selectedStudyset}
                        assignedCategories={assignedCategoriesSelection}
                        onAssignedCategoriesChange={onAssignedCategoriesChange}
                    />
                )}
            </Box>
        </MetadataDialogShell>
    );
};

export default ManageCategoriesDialog;
