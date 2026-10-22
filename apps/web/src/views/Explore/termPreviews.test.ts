import { describe, it, expect } from 'vite-plus/test';
import { buildTermPreviews } from './termPreviews';

const file = (association: 'term' | 'definition') => ({
    fileUUID: `${association}-img`,
    association,
});

describe('buildTermPreviews', () => {
    it('returns term and definition pairs in card order, at most n', () => {
        const cards = [
            { term: 'One', definition: '1' },
            { term: 'Two', definition: '2' },
            { term: 'Three', definition: '3' },
            { term: 'Four', definition: '4' },
        ];
        expect(buildTermPreviews(cards, 2, 80)).toEqual([
            { term: 'One', definition: '1' },
            { term: 'Two', definition: '2' },
        ]);
    });

    it('skips image-only cards and fills the slot with the next text card', () => {
        const cards = [
            {
                term: '',
                definition: '',
                files: [file('term'), file('definition')],
            },
            { term: '  ', definition: 'Has text', files: [file('term')] },
            { term: 'Cell', definition: 'Unit of life' },
        ];
        expect(buildTermPreviews(cards, 1, 80)).toEqual([
            { term: 'Cell', definition: 'Unit of life' },
        ]);
    });

    it('keeps a card whose definition is image-only', () => {
        const cards = [
            { term: 'Cell', definition: '', files: [file('definition')] },
        ];
        expect(buildTermPreviews(cards, 3, 80)).toEqual([
            { term: 'Cell', definition: '' },
        ]);
    });

    it('collapses whitespace and newlines', () => {
        const cards = [{ term: 'a\n\n  b ', definition: ' c\td ' }];
        expect(buildTermPreviews(cards, 1, 80)).toEqual([
            { term: 'a b', definition: 'c d' },
        ]);
    });

    it('leaves text of exactly maxChars alone', () => {
        const cards = [{ term: 'abcde', definition: '' }];
        expect(buildTermPreviews(cards, 1, 5)[0]!.term).toBe('abcde');
    });

    it('truncates longer text to maxChars including the ellipsis', () => {
        const cards = [{ term: 'abcdefghij', definition: 'klmnopqrst' }];
        expect(buildTermPreviews(cards, 1, 5)).toEqual([
            { term: 'abcd…', definition: 'klmn…' },
        ]);
    });

    it('trims a trailing space before the ellipsis', () => {
        const cards = [{ term: 'abc defgh', definition: '' }];
        expect(buildTermPreviews(cards, 1, 5)[0]!.term).toBe('abc…');
    });

    it("doesn't split surrogate pairs", () => {
        const cards = [{ term: '😀😀😀', definition: '' }];
        expect(buildTermPreviews(cards, 1, 2)[0]!.term).toBe('😀…');
    });

    it('skips malformed entries without throwing', () => {
        const cards = [
            null,
            'x',
            42,
            { term: 7 },
            { term: 'ok', definition: null },
        ];
        expect(buildTermPreviews(cards, 5, 80)).toEqual([
            { term: 'ok', definition: '' },
        ]);
    });

    it('returns nothing when n is 0', () => {
        expect(
            buildTermPreviews([{ term: 'a', definition: 'b' }], 0, 80)
        ).toEqual([]);
    });
});
