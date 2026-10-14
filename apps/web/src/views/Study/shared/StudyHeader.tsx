import { ArrowBack, VolumeUp, Settings } from '@mui/icons-material';
import {
    AppBar,
    Toolbar,
    IconButton,
    Typography,
    Box,
    LinearProgress,
    Tooltip,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

type Props = {
    studysetTitle: string;
    studysetUUID: string;
    currentCard: number;
    totalCards: number;
    score: number;
    streak: number;
    audioEnabled: boolean;
    onToggleAudio: () => void;
    onSettings: () => void;
};

const StudyHeader = ({
    studysetTitle,
    studysetUUID,
    currentCard,
    totalCards,
    score,
    streak,
    audioEnabled,
    onToggleAudio,
    onSettings,
}: Props) => {
    const navigate = useNavigate();
    const { t } = useTranslation('study');
    const progress = totalCards > 0 ? (currentCard / totalCards) * 100 : 0;

    const handleBack = () => {
        navigate(`/view/${studysetUUID}`);
    };

    return (
        <AppBar
            position="sticky"
            sx={{
                top: 0,
                zIndex: (theme) => theme.zIndex.appBar,
                backgroundColor: 'background.paper',
                color: 'text.primary',
                boxShadow: 2,
                borderTop: '1px solid rgba(255, 160, 0, 0.2)',
            }}
        >
            <Toolbar
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                }}
            >
                <Box
                    sx={{ display: 'flex', alignItems: 'center', gap: '1rem' }}
                >
                    <Tooltip title={t('header.backToStudySet')}>
                        <IconButton onClick={handleBack} color="primary">
                            <ArrowBack />
                        </IconButton>
                    </Tooltip>
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 600,
                            maxWidth: '20rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {studysetTitle}
                    </Typography>
                </Box>

                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2rem',
                        flex: 1,
                        justifyContent: 'center',
                    }}
                >
                    {streak > 0 && (
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                px: '1rem',
                                py: '0.5rem',
                                borderRadius: '1.5rem',
                                backgroundColor: 'rgba(255, 107, 107, 0.1)',
                                border: '0.0625rem solid rgba(255, 107, 107, 0.3)',
                            }}
                        >
                            <Typography sx={{ fontSize: '1.25rem' }}>
                                🔥
                            </Typography>
                            <Typography
                                variant="body1"
                                sx={{ fontWeight: 600 }}
                            >
                                {t('header.streak', { count: streak })}
                            </Typography>
                        </Box>
                    )}

                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            px: '1rem',
                            py: '0.5rem',
                            borderRadius: '1.5rem',
                            backgroundColor: 'rgba(255, 160, 0, 0.1)',
                            border: '0.0625rem solid rgba(255, 160, 0, 0.3)',
                        }}
                    >
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {t('header.score', { score })}
                        </Typography>
                    </Box>

                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {t('header.progress', { current: currentCard, total: totalCards })}
                    </Typography>
                </Box>

                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                    }}
                >
                    <Tooltip title={t(audioEnabled ? 'header.audioOn' : 'header.audioOff')}>
                        <IconButton
                            onClick={onToggleAudio}
                            color={audioEnabled ? 'primary' : 'default'}
                        >
                            <VolumeUp />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t('header.settings')}>
                        <IconButton onClick={onSettings}>
                            <Settings />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Toolbar>

            <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                    height: '0.25rem',
                    '& .MuiLinearProgress-bar': {
                        transition: 'transform 0.3s ease',
                    },
                }}
            />
        </AppBar>
    );
};

export default StudyHeader;
