import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { TypographyStyle } from '@mui/material/styles';
import { Link } from 'react-router-dom';

const TILE_RADIUS = '0.75rem';

// Spreading a whole theme variant doesn't type-check (it can carry @font-face).
const typeScale = ({
    fontFamily,
    fontSize,
    fontWeight,
    lineHeight,
    letterSpacing,
}: TypographyStyle) => ({
    fontFamily,
    fontSize,
    fontWeight,
    lineHeight,
    letterSpacing,
});

const tileEnter = keyframes({
    from: { opacity: 0, transform: 'translateY(0.75rem)' },
    to: { opacity: 1, transform: 'none' },
});

export const ForYouGrid = styled('ul')(({ theme }) => ({
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(min(16rem, 100%), 1fr))',
    // Fixed rows grow with the font-size setting (fontSize is 14 * scale).
    gridAutoRows: `${11 * (theme.typography.fontSize / 14)}rem`,
    gap: '1rem',
}));

export const VisuallyHidden = styled('span')({
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    whiteSpace: 'nowrap',
    border: 0,
});

export const ForYouItem = styled('li')({
    minWidth: 0,
});

// Only tiles that are links lift on hover; a lift on anything else would
// suggest it can be clicked.
export const TileArticle = styled('article', {
    shouldForwardProp: (prop) => prop !== 'interactive',
})<{ interactive?: boolean }>(({ theme, interactive }) => ({
    position: 'relative',
    height: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    padding: '1rem 1.25rem',
    borderRadius: TILE_RADIUS,
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow:
        theme.palette.mode === 'dark'
            ? '0 2px 8px rgba(0, 0, 0, 0.3)'
            : '0 2px 8px rgba(0, 0, 0, 0.06)',
    transition:
        'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s, border-color 0.3s, background 0.3s',
    // `backwards`, not `both`: a forwards fill would hold the last frame's
    // transform and override the hover lift.
    animation: `${tileEnter} 0.3s cubic-bezier(0.4, 0, 0.2, 1) backwards`,
    ...(interactive && {
        '&:hover': {
            transform: 'translateY(-4px)',
            borderColor: theme.palette.primary.main,
            background: theme.palette.action.hover,
            boxShadow:
                theme.palette.mode === 'dark'
                    ? '0 8px 24px rgba(0, 0, 0, 0.5)'
                    : '0 8px 24px rgba(0, 0, 0, 0.12)',
        },
    }),
    '@media (prefers-reduced-motion: reduce)': {
        animation: 'none',
        transition: 'none',
        ...(interactive && {
            '&:hover': {
                transform: 'none',
            },
        }),
    },
}));

export const TileEyebrow = styled('p')(({ theme }) => ({
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontSize: theme.typography.caption.fontSize,
    lineHeight: 1.5,
    fontWeight: 700,
    color: theme.palette.other.primaryText,
}));

export const TileTitle = styled('h3')(({ theme }) => ({
    ...typeScale(theme.typography.h6),
    margin: 0,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    overflowWrap: 'anywhere',
}));

// The ::after stretches the title link over the whole tile, and carries the
// focus ring so it outlines the tile rather than the title.
export const TileLink = styled(Link)(({ theme }) => ({
    color: theme.palette.text.primary,
    textDecoration: 'none',
    '&::after': {
        content: '""',
        position: 'absolute',
        inset: 0,
        borderRadius: TILE_RADIUS,
    },
    '&:hover': {
        color: theme.palette.other.primaryText,
    },
    '&:focus-visible': {
        outline: 'none',
    },
    '&:focus-visible::after': {
        outline: `2px solid ${theme.palette.other.primaryText}`,
        outlineOffset: '2px',
    },
}));

export const TileDescription = styled('p')(({ theme }) => ({
    ...typeScale(theme.typography.body2),
    margin: 0,
    color: theme.palette.text.secondary,
    display: '-webkit-box',
    WebkitLineClamp: 1,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    overflowWrap: 'anywhere',
}));

export const TileMeta = styled('p')(({ theme }) => ({
    ...typeScale(theme.typography.caption),
    margin: 0,
    marginTop: 'auto',
    color: theme.palette.text.secondary,
}));

export const TileFooter = styled('div')({
    marginTop: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    flexWrap: 'wrap',
    '& > p': {
        marginTop: 0,
    },
});
