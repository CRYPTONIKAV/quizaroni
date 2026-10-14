import { Button, IconButton, TextField, Typography, Box } from '@mui/material';
import { BoldTypography, SimpleFlexContainer } from 'styles/AppStyles';
import {
    AdvancedSection,
    BlankInputsContainer,
    BlankInputsField,
} from './CreateSetStyles';
import {
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    Add as AddIcon,
    DeleteSweep as DeleteSweepIcon,
    SwapVert as SwapVertIcon,
} from '@mui/icons-material';
import { useCreateSetStore } from 'state/stores/createSet';
import { useTranslation } from 'react-i18next';

type Props = {
    onBlankInputsSubmit: any;
    onClearEmptyCards?: () => void;
    onReverseAllCards?: () => void;
    cardsCount?: number;
};

const HeaderAdvancedSection = ({
    onBlankInputsSubmit = null,
    onClearEmptyCards,
    onReverseAllCards,
    cardsCount = 0,
}: Props) => {
    const { t } = useTranslation();
    const { advancedSectionProps, setAdvancedSectionProps } =
        useCreateSetStore();

    const { blankCardsCount, expanded } = advancedSectionProps;

    const onBlankInputsChange = (e: any) => {
        const value = parseInt(e.target.value, 10);
        setAdvancedSectionProps({
            blankCardsCount: isNaN(value)
                ? 0
                : Math.max(0, Math.min(100, value)),
            expanded,
        });
    };

    const onToggleExpanded = () => {
        setAdvancedSectionProps({
            blankCardsCount,
            expanded: !expanded,
        });
    };

    const handleBlankInputsSubmit = () => {
        onBlankInputsSubmit();
    };

    return (
        <AdvancedSection>
            <SimpleFlexContainer
                onClick={onToggleExpanded}
                style={{
                    cursor: 'pointer',
                    userSelect: 'none',
                    gap: '0.25rem',
                }}
            >
                <BoldTypography>
                    {t('create.advanced', { defaultValue: 'Advanced' })}
                </BoldTypography>
                <IconButton
                    size="small"
                    aria-expanded={expanded}
                    aria-label={
                        expanded
                            ? t('create.collapseAdvanced', {
                                  defaultValue: 'Collapse advanced',
                              })
                            : t('create.expandAdvanced', {
                                  defaultValue: 'Expand advanced',
                              })
                    }
                >
                    {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
            </SimpleFlexContainer>
            {expanded && (
                <BlankInputsContainer
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        alignItems: 'flex-start',
                        mt: '0.5rem',
                    }}
                >
                    {/* Add blank cards */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            width: '100%',
                        }}
                    >
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ textAlign: 'left' }}
                        >
                            {t('create.addBlankCards', {
                                defaultValue: 'Add blank cards:',
                            })}
                        </Typography>
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                            }}
                        >
                            <TextField
                                type="number"
                                size="small"
                                value={blankCardsCount}
                                onChange={onBlankInputsChange}
                                inputProps={{
                                    min: 0,
                                    max: 100,
                                    style: {
                                        width: '3rem',
                                        textAlign: 'center',
                                        MozAppearance: 'textfield',
                                    },
                                }}
                                sx={{
                                    '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button':
                                        {
                                            WebkitAppearance: 'none',
                                            margin: 0,
                                        },
                                }}
                            />
                            <Button
                                variant="contained"
                                size="small"
                                onClick={handleBlankInputsSubmit}
                                disabled={
                                    !blankCardsCount || blankCardsCount <= 0
                                }
                                startIcon={<AddIcon />}
                                sx={{ minWidth: 'auto' }}
                            >
                                {t('create.add', { defaultValue: 'Add' })}
                            </Button>
                        </Box>
                    </Box>

                    {/* Clear empty cards */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            width: '100%',
                        }}
                    >
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ textAlign: 'left' }}
                        >
                            {t('create.clearEmptyCards', {
                                defaultValue: 'Clear empty cards:',
                            })}
                        </Typography>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={onClearEmptyCards}
                            disabled={!onClearEmptyCards || cardsCount === 0}
                            startIcon={<DeleteSweepIcon />}
                            sx={{ minWidth: 'auto' }}
                        >
                            {t('create.clear', { defaultValue: 'Clear' })}
                        </Button>
                    </Box>

                    {/* Reverse all cards */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            width: '100%',
                        }}
                    >
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ textAlign: 'left' }}
                        >
                            {t('create.reverseAllCards', {
                                defaultValue: 'Reverse all cards:',
                            })}
                        </Typography>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={onReverseAllCards}
                            disabled={!onReverseAllCards || cardsCount === 0}
                            startIcon={<SwapVertIcon />}
                            sx={{ minWidth: 'auto' }}
                        >
                            {t('create.reverse', { defaultValue: 'Reverse' })}
                        </Button>
                    </Box>
                </BlankInputsContainer>
            )}
        </AdvancedSection>
    );
};

export default HeaderAdvancedSection;
