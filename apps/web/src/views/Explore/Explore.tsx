import { Add } from '@mui/icons-material';
import {
    Box,
    Button,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import useBrowserTitle from 'hooks/useBrowserTitle';
import { useCreateStudysetAction } from 'hooks/useCreateStudysetAction';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDueCountsBySet } from 'shared/hooks/useDueCountsBySet';
import { useEffectiveStreak } from 'shared/hooks/useEffectiveStreak';
import { useLastStudiedBySet } from 'shared/hooks/useLastStudiedBySet';
import { isCompleteStudyset, useGetAllStudysets } from 'state/api/studysetsAPI';
import { HomeContainer, HomePage, HomePaper } from 'views/Home/HomeStyles';
import {
    FOR_YOU_CAP,
    FOR_YOU_MAX_TILES,
    composeForYou,
    hasCompleteStudysets,
    selectFavorites,
    selectJumpBackIn,
    selectRevisit,
    summarizeDue,
} from './forYou';
import ForYouSection from './ForYouSection';

const Explore = () => {
    const { t } = useTranslation('explore');
    useBrowserTitle(t('title'));

    const theme = useTheme();
    const isXs = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
    const cap = isXs ? FOR_YOU_CAP.xs : FOR_YOU_CAP.default;
    const skeletonCount = Math.min(cap, FOR_YOU_MAX_TILES);

    // Branch on `data`, not `isLoading`: a query paused offline isn't loading
    // and has no data, and must not read as "no sets".
    const { data, isError, refetch } = useGetAllStudysets();
    const { createAndOpen, isPending } = useCreateStudysetAction();

    // Memoised so the due lookup only reruns when the library changes.
    const librarySets = useMemo(
        () =>
            data === undefined
                ? undefined
                : Array.isArray(data.studysets)
                  ? data.studysets.filter(isCompleteStudyset)
                  : [],
        [data]
    );
    const dueCounts = useDueCountsBySet(librarySets);
    const lastStudied = useLastStudiedBySet();
    const { days, atRisk } = useEffectiveStreak();

    const tiles = useMemo(
        () =>
            composeForYou(
                {
                    due: dueCounts ? summarizeDue(dueCounts) : null,
                    streak: { days, atRisk },
                    jumpBackIn: selectJumpBackIn(librarySets),
                    favorite: selectFavorites(librarySets),
                    revisit: lastStudied
                        ? selectRevisit(librarySets, lastStudied, new Date())
                        : [],
                },
                cap
            ),
        [dueCounts, lastStudied, days, atRisk, librarySets, cap]
    );
    const hasSets = hasCompleteStudysets(data?.studysets);

    const renderContent = () => {
        if (data === undefined) {
            return (
                <ForYouSection
                    tiles={[]}
                    isLoading={!isError}
                    isError={isError}
                    skeletonCount={skeletonCount}
                    onRetry={() => void refetch()}
                />
            );
        }
        if (!hasSets) {
            return (
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 1,
                    }}
                >
                    <Typography component="h2" variant="h6">
                        {t('empty.heading')}
                    </Typography>
                    <Typography color="text.secondary">
                        {t('empty.body')}
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<Add />}
                        onClick={() => void createAndOpen()}
                        disabled={isPending}
                        sx={{ mt: 1 }}
                    >
                        {t('empty.createSet')}
                    </Button>
                </Box>
            );
        }
        // Wait for the due tile, which ranks first, so it doesn't push the
        // other tiles down when it arrives. Also wait for study history, or a
        // revisit tile could show for a set studied recently and then vanish.
        if (dueCounts === undefined || lastStudied === undefined) {
            return (
                <ForYouSection
                    tiles={[]}
                    isLoading
                    isError={false}
                    skeletonCount={skeletonCount}
                    onRetry={() => void refetch()}
                />
            );
        }
        return (
            tiles.length > 0 && (
                <ForYouSection
                    tiles={tiles}
                    isLoading={false}
                    isError={false}
                    skeletonCount={skeletonCount}
                    onRetry={() => void refetch()}
                />
            )
        );
    };

    return (
        <HomePage>
            <HomePaper>
                <HomeContainer>
                    <Typography
                        component="h1"
                        variant="h4"
                        fontWeight={700}
                        sx={{ mb: 3 }}
                    >
                        {t('title')}
                    </Typography>
                    {renderContent()}
                </HomeContainer>
            </HomePaper>
        </HomePage>
    );
};

export default Explore;
