import { Box, Button, Skeleton, Typography } from '@mui/material';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ForYouTileData } from './forYou';
import ForYouTile from './ForYouTile';
import { ForYouGrid, ForYouItem, VisuallyHidden } from './ExploreStyles';

type Props = {
    tiles: ForYouTileData[];
    isLoading: boolean;
    isError: boolean;
    onRetry: () => void;
    skeletonCount: number;
};

const ForYouSection = ({
    tiles,
    isLoading,
    isError,
    onRetry,
    skeletonCount,
}: Props) => {
    const { t } = useTranslation('explore');
    const headingId = useId();

    const renderBody = () => {
        if (isError) {
            return (
                <Box
                    role="alert"
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        flexWrap: 'wrap',
                    }}
                >
                    <Typography>{t('forYou.error')}</Typography>
                    {/* Contained: the light theme's text buttons fail 4.5:1. */}
                    <Button variant="contained" onClick={onRetry}>
                        {t('forYou.retry')}
                    </Button>
                </Box>
            );
        }
        if (isLoading) {
            return (
                <ForYouGrid aria-busy="true">
                    {Array.from({ length: skeletonCount }, (_, i) => (
                        <ForYouItem key={i} aria-hidden="true">
                            <Skeleton
                                variant="rectangular"
                                height="100%"
                                sx={{
                                    borderRadius: '0.75rem',
                                    '@media (prefers-reduced-motion: reduce)': {
                                        animation: 'none',
                                    },
                                }}
                            />
                        </ForYouItem>
                    ))}
                </ForYouGrid>
            );
        }
        return (
            <ForYouGrid aria-busy="false">
                {tiles.map((tile, i) => (
                    <ForYouItem key={tile.studyset.studysetUUID}>
                        <ForYouTile tile={tile} index={i} />
                    </ForYouItem>
                ))}
            </ForYouGrid>
        );
    };

    return (
        <section aria-labelledby={headingId}>
            <Typography
                component="h2"
                variant="h5"
                id={headingId}
                sx={{ mb: 2 }}
            >
                {t('forYou.heading')}
            </Typography>
            {/* Mounted for the section's whole life so screen readers notice
                the text change; the skeletons themselves are aria-hidden. */}
            <VisuallyHidden role="status">
                {isLoading ? t('forYou.loading') : ''}
            </VisuallyHidden>
            {renderBody()}
        </section>
    );
};

export default ForYouSection;
