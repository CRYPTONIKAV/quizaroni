import { Button, Theme } from '@mui/material';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { STUDY_MODES } from 'shared/constants';
import type { EffectiveStreak } from 'shared/utilities/gamification';
import { DueSummary, ForYouTileData, SetTileKind } from './forYou';
import {
    TileArticle,
    TileDescription,
    TileEyebrow,
    TileFooter,
    TileLink,
    TileMeta,
    TileTitle,
} from './ExploreStyles';

const KIND_LABEL_KEYS: Partial<Record<SetTileKind, string>> = {
    jumpBackIn: 'tile.jumpBackIn',
};

// The theme's contained button lifts on hover and has no focus outline, so
// match the tile link's ring and drop the lift for reduced motion.
const reviewButtonSx = (theme: Theme) => ({
    '&.Mui-focusVisible': {
        outline: `2px solid ${theme.palette.other.primaryText}`,
        outlineOffset: '2px',
    },
    '@media (prefers-reduced-motion: reduce)': {
        transition: 'none',
        '&:hover': {
            transform: 'none',
        },
    },
});

type TileProps<T> = { data: T; delay: string };

const DueTile = ({ data, delay }: TileProps<DueSummary>) => {
    const { t } = useTranslation('explore');
    const headingId = useId();
    const { cardCount, setCount, studysetUUID } = data;

    return (
        <TileArticle style={{ animationDelay: delay }}>
            <TileEyebrow>{t('tile.due.eyebrow')}</TileEyebrow>
            <TileTitle id={headingId}>
                {t('tile.due.title', {
                    count: cardCount,
                    sets: t('tile.due.sets', { count: setCount }),
                })}
            </TileTitle>
            <TileFooter>
                <TileMeta>{t('tile.due.local')}</TileMeta>
                <Button
                    component={Link}
                    to={`/study/${studysetUUID}/${STUDY_MODES.REVIEW}`}
                    variant="contained"
                    size="small"
                    aria-describedby={headingId}
                    sx={reviewButtonSx}
                >
                    {t('tile.due.review')}
                </Button>
            </TileFooter>
        </TileArticle>
    );
};

const StreakTile = ({ data, delay }: TileProps<EffectiveStreak>) => {
    const { t } = useTranslation('explore');
    const { days, atRisk } = data;

    return (
        <TileArticle style={{ animationDelay: delay }}>
            <TileEyebrow>{t('tile.streak.eyebrow')}</TileEyebrow>
            <TileTitle>
                {atRisk
                    ? t('tile.streak.atRisk', { count: days })
                    : t('tile.streak.title', { count: days })}
            </TileTitle>
            <TileMeta>
                {atRisk
                    ? t('tile.streak.lastStudiedYesterday')
                    : t('tile.streak.studiedToday')}
            </TileMeta>
        </TileArticle>
    );
};

type Props = {
    tile: ForYouTileData;
    index: number;
};

const ForYouTile = ({ tile, index }: Props) => {
    const { t } = useTranslation('explore');
    const delay = `${index * 50}ms`;

    if (tile.kind === 'due') return <DueTile data={tile.due} delay={delay} />;
    if (tile.kind === 'streak') {
        return <StreakTile data={tile.streak} delay={delay} />;
    }

    const { studysetUUID, title, description, cards } = tile.studyset;
    const labelKey = KIND_LABEL_KEYS[tile.kind];
    // The list isn't schema-checked strictly, so don't trust the text fields.
    const name = typeof title === 'string' ? title.trim() : '';
    const blurb = typeof description === 'string' ? description.trim() : '';

    return (
        <TileArticle interactive style={{ animationDelay: delay }}>
            {labelKey && <TileEyebrow>{t(labelKey)}</TileEyebrow>}
            <TileTitle>
                <TileLink to={`/view/${studysetUUID}`}>
                    {name || t('tile.untitled')}
                </TileLink>
            </TileTitle>
            {blurb && <TileDescription>{blurb}</TileDescription>}
            <TileMeta>{t('tile.cardCount', { count: cards.length })}</TileMeta>
        </TileArticle>
    );
};

export default ForYouTile;
