import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Box,
    Button,
    IconButton,
    Typography,
    CircularProgress,
    TextField,
    InputAdornment,
    FormControlLabel,
    Switch,
    Paper,
} from '@mui/material';
import { Add, Remove, ArrowBack, MergeType, Search } from '@mui/icons-material';
import {
    useGetAllStudysets,
    useCreateStudyset,
    useUpdateStudyset,
} from 'state/api/studysetsAPI';
import { Studyset } from 'shared/types';
import {
    CombineSetsContainer,
    CombineSetsHeader,
    ColumnContainer,
    SetItem,
    ScrollableList,
} from './styles';
import useBrowserTitle from 'hooks/useBrowserTitle';
import { BoldTypography, SpacedFlexContainer } from 'styles/AppStyles';

const CombineSets = () => {
    const { id: baseSetUUID = '' } = useParams();
    const navigate = useNavigate();
    const { t } = useTranslation();
    useBrowserTitle('Combine Sets');

    const { data: studysetsResponse } = useGetAllStudysets();
    const allSets = studysetsResponse?.studysets ?? [];

    const { mutateAsync: createStudyset } = useCreateStudyset();
    const { mutateAsync: updateStudyset } = useUpdateStudyset();

    const [combinedSets, setCombinedSets] = useState<Studyset[]>([]);
    const [availableSets, setAvailableSets] = useState<Studyset[]>([]);
    const [isCombining, setIsCombining] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [customTitle, setCustomTitle] = useState('');
    const [customDescription, setCustomDescription] = useState('');
    const [shuffleCards, setShuffleCards] = useState(false);
    const [keepCategories, setKeepCategories] = useState(true);
    const [keepImportant, setKeepImportant] = useState(true);

    const defaultTitle =
        combinedSets.length > 0
            ? 'Combined: ' + combinedSets.map((s) => s.title).join(' + ')
            : 'Combined Studyset';
    const defaultDescription =
        combinedSets.length > 0
            ? 'A combination of: ' + combinedSets.map((s) => s.title).join(', ')
            : '';

    const filteredAvailableSets = availableSets.filter((set) =>
        set.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        if (allSets.length > 0) {
            const baseSet = allSets.find((s) => s.studysetUUID === baseSetUUID);
            if (baseSet) {
                setCombinedSets([baseSet]);
                setAvailableSets(allSets.filter((s) => s !== baseSet));
            } else {
                setAvailableSets(allSets);
            }
        }
    }, [allSets, baseSetUUID]);

    const handleAdd = (set: Studyset) => {
        setCombinedSets([...combinedSets, set]);
        setAvailableSets(
            availableSets.filter((s) => s.studysetUUID !== set.studysetUUID)
        );
    };

    const handleRemove = (set: Studyset) => {
        setAvailableSets([set, ...availableSets]);
        setCombinedSets(
            combinedSets.filter((s) => s.studysetUUID !== set.studysetUUID)
        );
    };

    const handleGo = async () => {
        if (combinedSets.length < 2) return;
        setIsCombining(true);
        try {
            const newSetResponse = await createStudyset();
            const newUUID = newSetResponse?.studyset?.studysetUUID;

            if (!newUUID) {
                console.error(
                    'Could not get new studyset UUID',
                    newSetResponse
                );
                setIsCombining(false);
                return;
            }

            let allCards: any[] = [];
            combinedSets.forEach((set) => {
                if (set.cards) {
                    allCards = [...allCards, ...set.cards];
                }
            });

            if (shuffleCards) {
                for (let i = allCards.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
                }
            }

            const cleanedCards = allCards.map((c) => {
                const { cardUUID, categories, important, ...rest } = c;
                return {
                    ...rest,
                    categories: keepCategories ? categories || [] : [],
                    important: keepImportant ? important || false : false,
                    cardUUID: crypto.randomUUID(),
                    studysetUUID: newUUID,
                };
            });

            const finalTitle = customTitle.trim() || defaultTitle;
            const finalDescription =
                customDescription.trim() || defaultDescription;
            const combinedLabels = keepCategories
                ? Array.from(
                      new Set(combinedSets.flatMap((s) => s.labels || []))
                  )
                : [];
            const baseMetadata = combinedSets[0]?.metadata || {};

            await updateStudyset({
                studysetUUID: newUUID,
                updates: {
                    title: finalTitle.substring(0, 100),
                    cards: cleanedCards,
                    description: finalDescription,
                    labels: combinedLabels,
                    metadata: baseMetadata,
                },
            });
            navigate(`/view/${newUUID}`);
        } catch (e) {
            console.error(e);
            setIsCombining(false);
        }
    };

    const totalCards = combinedSets.reduce(
        (sum, set) => sum + (set.cards?.length || 0),
        0
    );

    return (
        <CombineSetsContainer>
            <CombineSetsHeader>
                <SpacedFlexContainer>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                        }}
                    >
                        <IconButton
                            onClick={() => navigate(-1)}
                            color="primary"
                            aria-label={t('combineSets.goBack')}
                        >
                            <ArrowBack />
                        </IconButton>
                        <Box>
                            <BoldTypography variant="h4">
                                Combine sets
                            </BoldTypography>
                            <Typography
                                variant="subtitle1"
                                color="text.secondary"
                            >
                                Currently Combining — {combinedSets.length}{' '}
                                {combinedSets.length === 1 ? 'set' : 'sets'} •{' '}
                                {totalCards} cards
                            </Typography>
                        </Box>
                    </Box>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleGo}
                        disabled={combinedSets.length < 2 || isCombining}
                        startIcon={
                            isCombining ? (
                                <CircularProgress size={20} />
                            ) : (
                                <MergeType />
                            )
                        }
                    >
                        Combine & Go
                    </Button>
                </SpacedFlexContainer>
            </CombineSetsHeader>

            <Box
                sx={{
                    display: 'flex',
                    gap: '2rem',
                    mt: '2rem',
                    flexDirection: { xs: 'column', md: 'row' },
                }}
            >
                <ColumnContainer>
                    <BoldTypography variant="h6" sx={{ mb: 2 }}>
                        Currently Combining
                    </BoldTypography>
                    <ScrollableList>
                        {combinedSets.map((set) => (
                            <SetItem key={set.studysetUUID} elevation={2}>
                                <Box>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        {set.cards?.length || 0} cards
                                    </Typography>
                                    <BoldTypography variant="body1">
                                        {set.title}
                                    </BoldTypography>
                                </Box>
                                <IconButton
                                    onClick={() => handleRemove(set)}
                                    aria-label={t('combineSets.removeSet', {
                                        title: set.title,
                                    })}
                                    disabled={
                                        combinedSets.length === 1 &&
                                        set.studysetUUID === baseSetUUID
                                    }
                                >
                                    <Remove />
                                </IconButton>
                            </SetItem>
                        ))}
                    </ScrollableList>

                    <BoldTypography variant="h6" sx={{ mb: 1, mt: 2 }}>
                        Combine Options
                    </BoldTypography>
                    <Paper
                        sx={{
                            p: 3,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3,
                        }}
                        elevation={2}
                    >
                        <TextField
                            label="Combined Set Title"
                            fullWidth
                            value={customTitle}
                            onChange={(e) => setCustomTitle(e.target.value)}
                            placeholder={defaultTitle}
                            variant="outlined"
                        />
                        <TextField
                            label="Description"
                            fullWidth
                            multiline
                            rows={2}
                            value={customDescription}
                            onChange={(e) =>
                                setCustomDescription(e.target.value)
                            }
                            placeholder={defaultDescription}
                            variant="outlined"
                        />
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1,
                            }}
                        >
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={shuffleCards}
                                        onChange={(e) =>
                                            setShuffleCards(e.target.checked)
                                        }
                                        color="primary"
                                    />
                                }
                                label={
                                    <Typography variant="body1">
                                        Shuffle cards
                                    </Typography>
                                }
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={keepCategories}
                                        onChange={(e) =>
                                            setKeepCategories(e.target.checked)
                                        }
                                        color="primary"
                                    />
                                }
                                label={
                                    <Typography variant="body1">
                                        Keep card categories
                                    </Typography>
                                }
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={keepImportant}
                                        onChange={(e) =>
                                            setKeepImportant(e.target.checked)
                                        }
                                        color="primary"
                                    />
                                }
                                label={
                                    <Typography variant="body1">
                                        Keep important stars
                                    </Typography>
                                }
                            />
                        </Box>
                    </Paper>
                </ColumnContainer>

                <ColumnContainer>
                    <SpacedFlexContainer sx={{ mb: 2 }}>
                        <BoldTypography variant="h6">Your Sets</BoldTypography>
                        <Typography variant="body2" color="text.secondary">
                            {filteredAvailableSets.length} sets
                        </Typography>
                    </SpacedFlexContainer>

                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Search sets..."
                        variant="outlined"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        sx={{ mb: 2 }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search />
                                </InputAdornment>
                            ),
                        }}
                    />

                    <ScrollableList>
                        {filteredAvailableSets.length === 0 ? (
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ p: 2, textAlign: 'center' }}
                            >
                                No sets found matching "{searchTerm}"
                            </Typography>
                        ) : (
                            filteredAvailableSets.map((set) => (
                                <SetItem key={set.studysetUUID} elevation={2}>
                                    <Box>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                        >
                                            {set.cards?.length || 0} cards
                                        </Typography>
                                        <BoldTypography variant="body1">
                                            {set.title}
                                        </BoldTypography>
                                    </Box>
                                    <IconButton
                                        onClick={() => handleAdd(set)}
                                        color="primary"
                                        aria-label={t('combineSets.addSet', {
                                            title: set.title,
                                        })}
                                    >
                                        <Add />
                                    </IconButton>
                                </SetItem>
                            ))
                        )}
                    </ScrollableList>
                </ColumnContainer>
            </Box>
        </CombineSetsContainer>
    );
};

export default CombineSets;
