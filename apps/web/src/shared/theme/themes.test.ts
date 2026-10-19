import { describe, it, expect } from 'vite-plus/test';
import {
    decomposeColor,
    getContrastRatio,
    rgbToHex,
} from '@mui/material/styles';
import { createDarkTheme, createLightTheme } from './themes';

// Composites a translucent rgba() over an opaque background, as the browser
// paints action.hover on top of the paper.
const over = (fg: string, bg: string) => {
    const { values: f } = decomposeColor(fg);
    const { values: b } = decomposeColor(bg);
    const alpha = f[3] ?? 1;
    const mix = b
        .slice(0, 3)
        .map((bv, i) => Math.round((f[i] ?? 0) * alpha + bv * (1 - alpha)));
    return rgbToHex(`rgb(${mix.join(', ')})`);
};

describe.each([
    ['light', createLightTheme()],
    ['dark', createDarkTheme()],
])('%s theme primary text', (_name, theme) => {
    const { other, background, action } =
        theme.palette as typeof theme.palette & {
            other: { primaryText: string };
        };

    it('reaches 4.5:1 on paper and default backgrounds', () => {
        expect(
            getContrastRatio(other.primaryText, background.paper)
        ).toBeGreaterThanOrEqual(4.5);
        expect(
            getContrastRatio(other.primaryText, background.default)
        ).toBeGreaterThanOrEqual(4.5);
    });

    it('reaches 4.5:1 on the hover tint', () => {
        const tint = over(action.hover, background.paper);
        expect(
            getContrastRatio(other.primaryText, tint)
        ).toBeGreaterThanOrEqual(4.5);
    });
});
