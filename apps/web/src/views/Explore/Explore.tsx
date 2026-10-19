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
import { useGetAllStudysets } from 'state/api/studysetsAPI';
import { HomeContainer, HomePage, HomePaper } from 'views/Home/HomeStyles';
import {
    FOR_YOU_CAP,
    FOR_YOU_MAX_TILES,
    composeForYou,
    hasCompleteStudysets,
    selectJumpBackIn,
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

    const tiles = useMemo(
        () =>
            composeForYou(
                { jumpBackIn: selectJumpBackIn(data?.studysets) },
                cap
            ),
        [data, cap]
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
