import { Button, Theme } from '@mui/material';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { STUDY_MODES } from 'shared/constants';
import type { EffectiveStreak } from 'shared/utilities/gamification';
import {
    DueSummary,
    ForYouTileData,
    REVISIT_PREVIEW_CHARS,
    REVISIT_PREVIEW_COUNT,
    SetTileKind,
} from './forYou';
import {
    TileArticle,
    TileDescription,
    TileEyebrow,
    TileFooter,
    TileLink,
    TileMeta,
    TilePreviewItem,
    TilePreviewList,
    TilePreviewTerm,
    TileTitle,
} from './ExploreStyles';
import { buildTermPreviews } from './termPreviews';

const KIND_LABEL_KEYS: Partial<Record<SetTileKind, string>> = {
    jumpBackIn: 'tile.jumpBackIn',
    favorite: 'tile.favorite',
    revisit: 'tile.revisit',
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
    // Previews replace the description, and need the title kept to one line
    // to fit. A set with no text terms keeps the usual layout.
    const previews =
        tile.kind === 'revisit'
            ? buildTermPreviews(
                  cards,
                  REVISIT_PREVIEW_COUNT,
                  REVISIT_PREVIEW_CHARS
              )
            : [];
    const hasPreviews = previews.length > 0;

    return (
        <TileArticle interactive style={{ animationDelay: delay }}>
            {labelKey && <TileEyebrow>{t(labelKey)}</TileEyebrow>}
            <TileTitle lines={hasPreviews ? 1 : 2}>
                <TileLink to={`/view/${studysetUUID}`}>
                    {name || t('tile.untitled')}
                </TileLink>
            </TileTitle>
            {/* role="list": WebKit drops list semantics, and with them the
                label, from a ul with list-style: none. */}
            {hasPreviews && (
                <TilePreviewList role="list" aria-label={t('tile.previews')}>
                    {previews.map(({ term, definition }, i) => (
                        <TilePreviewItem key={i}>
                            <TilePreviewTerm>{term}</TilePreviewTerm>
                            {definition && ` — ${definition}`}
                        </TilePreviewItem>
                    ))}
                </TilePreviewList>
            )}
            {!hasPreviews && blurb && (
                <TileDescription>{blurb}</TileDescription>
            )}
            <TileMeta>{t('tile.cardCount', { count: cards.length })}</TileMeta>
        </TileArticle>
    );
};

export default ForYouTile;
