import {
    FormatColorText,
    FormatColorFill,
    SwapHoriz,
    ContentCopy,
    Delete,
} from '@mui/icons-material';
import { Tooltip, IconButton } from '@mui/material';
import { BoldTypography, SpacedFlexContainer } from 'styles/AppStyles';
import CustomColorPicker from 'components/CustomColorPicker/CustomColorPicker';
import {
    swapCard,
    duplicateCard,
    deleteCard,
} from 'shared/utilities/createUtils';
import { CenterActions, RightActions } from '../CreateSetStyles';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { useTheme } from 'theme/useTheme';
import { ColorPickerType, TODO } from 'shared/types';

type Props = {
    actionsStack: TODO[];
    setActionsStack: Dispatch<SetStateAction<TODO[]>>;
    applyBackgroundColor: boolean;
    applyTextColor: boolean;
    createdSetCards: any[];
    index: number;
    localBackgroundColor: string;
    localTextColor: string;
    onColorChange: any;
    setApplyBackgroundColor: Dispatch<SetStateAction<boolean>>;
    setApplyTextColor: Dispatch<SetStateAction<boolean>>;
    setLocalBackgroundColor: Dispatch<SetStateAction<string>>;
    setLocalTextColor: Dispatch<SetStateAction<string>>;
    setStateCallback: Dispatch<SetStateAction<any>>;
    updateCardValue: any;
};
const NewCardHeader = ({
    applyBackgroundColor,
    applyTextColor,
    createdSetCards,
    index,
    localBackgroundColor,
    localTextColor,
    onColorChange,
    actionsStack,
    setActionsStack,
    setApplyBackgroundColor,
    setApplyTextColor,
    setLocalBackgroundColor,
    setLocalTextColor,
    setStateCallback,
    updateCardValue,
}: Props) => {
    const { muiTheme } = useTheme();
    const textColorButtonRef = useRef(null);
    const backgroundColorButtonRef = useRef(null);

    const [showTextColorPicker, setShowTextColorPicker] =
        useState<boolean>(false);
    const [showBackgroundColorPicker, setShowBackgroundColorPicker] =
        useState<boolean>(false);

    useEffect(() => {
        if (showTextColorPicker || showBackgroundColorPicker) {
            const elements = document.querySelectorAll('[id]');
            for (const el of elements) {
                if (el.id.startsWith('rc-editable-input')) {
                    const domElement = document.getElementById(el.id);
                    // @ts-ignore
                    domElement.style.color = muiTheme.palette.text.primary;
                    // @ts-ignore
                    domElement.style.background =
                        muiTheme.palette.background.paper;
                    break;
                }
            }
        }
    }, [showTextColorPicker, showBackgroundColorPicker, muiTheme]);

    const toggleBackgroundColorPicker = () => {
        setShowTextColorPicker(false);
        setShowBackgroundColorPicker(!showBackgroundColorPicker);
    };

    const toggleTextColorPicker = () => {
        setShowBackgroundColorPicker(false);
        setShowTextColorPicker(!showTextColorPicker);
    };

    const onColorPickerChange = (e, type: ColorPickerType) => {
        const localStateCallback =
            type === 'textColor' ? setLocalTextColor : setLocalBackgroundColor;
        onColorChange(e, type, index);
        localStateCallback(e.hex);
    };

    const resetColor = (type: ColorPickerType) => {
        const localStateCallback =
            type === 'textColor' ? setLocalTextColor : setLocalBackgroundColor;
        updateCardValue(index, type, '');
        localStateCallback('');
    };

    const toggleApplyColor = (type: ColorPickerType) => {
        if (type === 'textColor') {
            setApplyTextColor(!applyTextColor);
        } else {
            setApplyBackgroundColor(!applyBackgroundColor);
        }
    };

    const colorPickerActiveStyling = {
        backgroundColor: muiTheme.palette.action.hover,
    };

    return (
        <SpacedFlexContainer>
            <BoldTypography variant="h6" color="primary">
                Card {index + 1}
            </BoldTypography>
            <CenterActions>
                <Tooltip title="Change card text color" placement="top">
                    <IconButton
                        ref={textColorButtonRef}
                        onClick={toggleTextColorPicker}
                        aria-label="Change card text color"
                        sx={showTextColorPicker ? colorPickerActiveStyling : {}}
                    >
                        <FormatColorText fontSize="medium" />
                    </IconButton>
                </Tooltip>
                {showTextColorPicker && (
                    <CustomColorPicker
                        applyColor={applyTextColor}
                        color={localTextColor}
                        additionalRefs={[textColorButtonRef]}
                        onClose={() => setShowTextColorPicker(false)}
                        onChange={(e) => onColorPickerChange(e, 'textColor')}
                        onResetColor={() => resetColor('textColor')}
                        onApplyColor={() => toggleApplyColor('textColor')}
                    />
                )}
                <Tooltip title="Change card background color" placement="top">
                    <IconButton
                        ref={backgroundColorButtonRef}
                        onClick={toggleBackgroundColorPicker}
                        aria-label="Change card background color"
                        sx={
                            showBackgroundColorPicker
                                ? colorPickerActiveStyling
                                : {}
                        }
                    >
                        <FormatColorFill fontSize="medium" />
                    </IconButton>
                </Tooltip>
                {showBackgroundColorPicker && (
                    <CustomColorPicker
                        applyColor={applyBackgroundColor}
                        color={localBackgroundColor}
                        additionalRefs={[backgroundColorButtonRef]}
                        onClose={() => setShowBackgroundColorPicker(false)}
                        onChange={(e) =>
                            onColorPickerChange(e, 'backgroundColor')
                        }
                        onResetColor={() => resetColor('backgroundColor')}
                        onApplyColor={() => toggleApplyColor('backgroundColor')}
                        style={{
                            left: '4rem',
                        }}
                    />
                )}
                <Tooltip title="Swap term and definition" placement="top">
                    <IconButton
                        onClick={() =>
                            swapCard({
                                createdSetCards,
                                index,
                                setStateCallback,
                            })
                        }
                        aria-label="Swap term and definition"
                    >
                        <SwapHoriz fontSize="medium" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Duplicate" placement="top">
                    <IconButton
                        onClick={() =>
                            duplicateCard({
                                createdSetCards,
                                index,
                                setStateCallback,
                            })
                        }
                        aria-label="Duplicate card"
                    >
                        <ContentCopy />
                    </IconButton>
                </Tooltip>
            </CenterActions>
            <RightActions>
                <Tooltip title="Delete this card" placement="top">
                    <IconButton
                        onClick={() =>
                            deleteCard({
                                createdSetCards,
                                index,
                                setStateCallback,
                                actionsStack,
                                setActionsStack,
                            })
                        }
                        aria-label="Delete this card"
                    >
                        <Delete fontSize="medium" color="error" />
                    </IconButton>
                </Tooltip>
            </RightActions>
        </SpacedFlexContainer>
    );
};

export default NewCardHeader;
