import { useTranslation } from 'react-i18next';
import { ForYouKind, ForYouTileData } from './forYou';
import {
    TileArticle,
    TileDescription,
    TileEyebrow,
    TileLink,
    TileMeta,
    TileTitle,
} from './ExploreStyles';

const KIND_LABEL_KEYS: Partial<Record<ForYouKind, string>> = {
    jumpBackIn: 'tile.jumpBackIn',
};

type Props = {
    tile: ForYouTileData;
    index: number;
};

const ForYouTile = ({ tile, index }: Props) => {
    const { t } = useTranslation('explore');
    const { studysetUUID, title, description, cards } = tile.studyset;
    const labelKey = KIND_LABEL_KEYS[tile.kind];
    // The list isn't schema-checked strictly, so don't trust the text fields.
    const name = typeof title === 'string' ? title.trim() : '';
    const blurb = typeof description === 'string' ? description.trim() : '';

    return (
        <TileArticle style={{ animationDelay: `${index * 50}ms` }}>
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
