export type TermPreview = { term: string; definition: string };

const normalize = (value: unknown) =>
    typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

// Counts code points, not UTF-16 units, so an emoji isn't cut in half. The
// ellipsis counts toward maxChars.
const truncate = (text: string, maxChars: number) => {
    const chars = Array.from(text);
    if (chars.length <= maxChars) return text;
    return (
        chars
            .slice(0, maxChars - 1)
            .join('')
            .trimEnd() + '…'
    );
};

// A card whose term has no text (an image-only term) is skipped; an
// image-only definition keeps the card with an empty definition. Cards come
// from a loosely validated library, so anything that isn't an object is
// skipped too.
export const buildTermPreviews = (
    cards: readonly unknown[],
    n: number,
    maxChars: number
): TermPreview[] => {
    const previews: TermPreview[] = [];
    for (const card of cards) {
        if (previews.length >= n) break;
        if (typeof card !== 'object' || card === null) continue;
        const { term, definition } = card as Record<string, unknown>;
        const termText = normalize(term);
        if (!termText) continue;
        previews.push({
            term: truncate(termText, maxChars),
            definition: truncate(normalize(definition), maxChars),
        });
    }
    return previews;
};
