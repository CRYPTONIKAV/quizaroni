import { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    LinearProgress,
    Zoom,
    Grow,
} from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import { fireConfetti } from 'shared/utilities/confetti';
import { useGetStudyset } from 'state/api/studysetsAPI';
import { useStudySessionStore } from 'state/stores/studySession';
import { Card as CardType, Studyset, StudySessionResult } from 'shared/types';
import { STUDY_MODES, SCORING } from 'shared/constants';
import StudyHeader from './shared/StudyHeader';
import StudyResults from './shared/StudyResults';
import SettingsDialog from './shared/SettingsDialog';
import { BasePage } from 'styles/AppStyles';
import { useShortcuts } from 'shared/keyboard/useShortcuts';
import useHaptics from 'shared/hooks/useHaptics';
import { useTranslation } from 'react-i18next';

type Props = {
    studysetId: string;
};

type MatchCard = {
    id: string;
    text: string;
    type: 'term' | 'definition';
    cardUUID: string;
    matched: boolean;
};

const MatchingStudy = ({ studysetId }: Props) => {
    const { t } = useTranslation('study');
    const { data: studysetResponse, isLoading } = useGetStudyset({
        studysetUUID: studysetId,
    });
    const studyset = studysetResponse?.studyset ?? ({} as Studyset);

    const {
        activeSession,
        startSession,
        endSession,
        updateCardProgress,
        incrementScore,
        recordAnswer,
    } = useStudySessionStore();

    const { light: hapticLight, sessionComplete: hapticSessionComplete } =
        useHaptics();

    const [termCards, setTermCards] = useState<MatchCard[]>([]);
    const [definitionCards, setDefinitionCards] = useState<MatchCard[]>([]);
    const [selectedCards, setSelectedCards] = useState<MatchCard[]>([]);
    const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());
    const [timeElapsed, setTimeElapsed] = useState(0);
    const [showResults, setShowResults] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [sessionResult, setSessionResult] =
        useState<StudySessionResult | null>(null);
    const [incorrectAttempts, setIncorrectAttempts] = useState(0);
    const [highlightIndex, setHighlightIndex] = useState(0);

    // Initialize session
    useEffect(() => {
        if (studyset?.cards?.length > 0 && !activeSession) {
            startSession({
                studysetUUID: studysetId,
                mode: STUDY_MODES.MATCHING,
                cards: studyset.cards,
                settings: {
                    shuffleCards: false,
                    timedMode: false,
                    audioEnabled: false,
                    autoAdvance: true,
                    difficulty: 'medium',
                    hideImages: false,
                },
            });
        }
    }, [studyset?.cards, studysetId, activeSession]);

    // Initialize cards when session is ready
    useEffect(() => {
        const cards = activeSession?.cards;
        if (cards?.length) {
            initializeCards(cards);
        }
    }, [activeSession?.cards?.length]);

    // Timer
    useEffect(() => {
        if (!activeSession || showResults) return;

        const interval = setInterval(() => {
            setTimeElapsed((prev) => prev + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [activeSession, showResults]);

    const initializeCards = (cards: CardType[]) => {
        const terms: MatchCard[] = cards.map((card) => ({
            id: `term-${card.cardUUID}`,
            text: card.term,
            type: 'term',
            cardUUID: card.cardUUID,
            matched: false,
        }));

        const definitions: MatchCard[] = cards.map((card) => ({
            id: `def-${card.cardUUID}`,
            text: card.definition,
            type: 'definition',
            cardUUID: card.cardUUID,
            matched: false,
        }));

        setTermCards(terms);
        setDefinitionCards([...definitions].sort(() => Math.random() - 0.5));
    };

    const handleCardClick = (card: MatchCard) => {
        if (card.matched || selectedCards.some((c) => c.id === card.id)) return;

        const newSelected = [...selectedCards, card];
        setSelectedCards(newSelected);

        if (newSelected.length === 2) {
            const [first, second] = newSelected;
            if (first && second) {
                checkMatch(first, second);
            }
        }
    };

    const checkMatch = (card1: MatchCard, card2: MatchCard) => {
        const isMatch =
            card1.cardUUID === card2.cardUUID && card1.type !== card2.type;

        if (isMatch) {
            // Correct match
            hapticLight();
            const newMatched = new Set(matchedPairs);
            newMatched.add(card1.cardUUID);
            setMatchedPairs(newMatched);

            // Update cards as matched
            setTermCards((prev) =>
                prev.map((c) =>
                    c.cardUUID === card1.cardUUID ? { ...c, matched: true } : c
                )
            );
            setDefinitionCards((prev) =>
                prev.map((c) =>
                    c.cardUUID === card1.cardUUID ? { ...c, matched: true } : c
                )
            );

            // Calculate score with time bonus
            const baseScore = SCORING.CORRECT_ANSWER;
            const timeBonus = Math.max(0, SCORING.TIME_BONUS_MAX - timeElapsed);
            incrementScore(baseScore + timeBonus);

            // Update card progress
            updateCardProgress(card1.cardUUID, 4);

            // Record answer
            recordAnswer({
                cardUUID: card1.cardUUID,
                correct: true,
                timeSpent: timeElapsed,
                hintsUsed: 0,
            });

            // Check if all matched
            if (newMatched.size === termCards.length) {
                setTimeout(() => {
                    handleGameComplete();
                }, 1000);

                // Trigger confetti
                fireConfetti({
                    particleCount: 150,
                    spread: 100,
                    origin: { y: 0.6 },
                    colors: [
                        '#FFA000',
                        '#FF6B6B',
                        '#4ECDC4',
                        '#FFD93D',
                        '#95E1D3',
                    ],
                });
            }

            setSelectedCards([]);
        } else {
            // Incorrect match
            setIncorrectAttempts((prev) => prev + 1);
            setTimeout(() => {
                setSelectedCards([]);
            }, 800);
        }
    };

    const handleGameComplete = () => {
        if (!activeSession) return;

        hapticSessionComplete();
        const result = endSession();
        setSessionResult(result);
        setShowResults(true);
    };

    // Combined, linear view of both columns (terms first, then definitions)
    // so number keys and arrow highlight can address every tile by index.
    const matchTiles = [...termCards, ...definitionCards];

    useShortcuts([
        {
            id: 'matching.select',
            keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
            scope: 'study:matching',
            descriptionKey: 'shortcuts.actions.selectTile',
            handler: (e) => {
                const tile = matchTiles[Number(e.key) - 1];
                if (tile) handleCardClick(tile);
            },
        },
        {
            id: 'matching.move',
            keys: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'],
            scope: 'study:matching',
            descriptionKey: 'shortcuts.actions.moveHighlight',
            handler: (e) => {
                setHighlightIndex((i) => {
                    if (matchTiles.length === 0) return 0;
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                        return (i - 1 + matchTiles.length) % matchTiles.length;
                    }
                    return (i + 1) % matchTiles.length;
                });
            },
        },
        {
            id: 'matching.confirm',
            keys: ['Enter'],
            scope: 'study:matching',
            descriptionKey: 'shortcuts.actions.confirm',
            handler: () => {
                const tile = matchTiles[highlightIndex];
                if (tile) handleCardClick(tile);
            },
        },
    ]);

    const handleAudioToggle = () => {
        if (!activeSession) return;
        const newSettings = {
            ...activeSession.settings,
            audioEnabled: !activeSession.settings.audioEnabled,
        };
        startSession({
            studysetUUID: studysetId,
            mode: STUDY_MODES.MATCHING,
            cards: studyset.cards,
            settings: newSettings,
        });
    };

    const handleSettingsSave = (newSettings) => {
        startSession({
            studysetUUID: studysetId,
            mode: STUDY_MODES.MATCHING,
            cards: studyset.cards,
            settings: newSettings,
        });
    };

    const handleStudyAgain = () => {
        setShowResults(false);
        setSessionResult(null);
        setMatchedPairs(new Set());
        setSelectedCards([]);
        setTimeElapsed(0);
        setIncorrectAttempts(0);
        startSession({
            studysetUUID: studysetId,
            mode: STUDY_MODES.MATCHING,
            cards: studyset.cards,
            settings: {
                shuffleCards: false,
                timedMode: false,
                audioEnabled: false,
                autoAdvance: true,
                difficulty: 'medium',
                hideImages: false,
            },
        });
    };

    const getTimerColor = () => {
        const avgTimePerCard =
            timeElapsed / Math.max(1, matchedPairs.size || 1);
        if (avgTimePerCard < 5) return 'success';
        if (avgTimePerCard < 10) return 'warning';
        return 'error';
    };

    const progress =
        termCards.length > 0 ? (matchedPairs.size / termCards.length) * 100 : 0;

    if (
        isLoading ||
        !activeSession ||
        !activeSession.cards ||
        activeSession.cards.length === 0
    ) {
        return (
            <BasePage>
                <Typography>{t('matching.loading')}</Typography>
            </BasePage>
        );
    }

    // Don't render if cards haven't been initialized yet
    if (termCards.length === 0 || definitionCards.length === 0) {
        return (
            <BasePage>
                <Typography>{t('matching.loading')}</Typography>
            </BasePage>
        );
    }

    return (
        <BasePage
            sx={{
                mt: 0,
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                overflow: 'hidden',
                backgroundColor: 'background.default',
            }}
        >
            <StudyHeader
                studysetTitle={studyset.title || ''}
                studysetUUID={studysetId}
                currentCard={matchedPairs.size}
                totalCards={termCards.length}
                score={activeSession.score}
                streak={activeSession.streak}
                audioEnabled={activeSession.settings.audioEnabled}
                onToggleAudio={handleAudioToggle}
                onSettings={() => setShowSettings(true)}
            />

            {/* Timer and Progress */}
            <Box sx={{ px: '2rem', py: '1rem' }}>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        mb: '0.5rem',
                    }}
                >
                    <Typography variant="body2" color="text.secondary">
                        {t('matching.time', {
                            time: `${Math.floor(timeElapsed / 60)}:${(timeElapsed % 60).toString().padStart(2, '0')}`,
                        })}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t('matching.matched', {
                            matched: matchedPairs.size,
                            total: termCards.length,
                        })}
                    </Typography>
                </Box>
                <LinearProgress
                    variant="determinate"
                    value={progress}
                    color={getTimerColor()}
                    sx={{
                        height: '0.5rem',
                        borderRadius: '0.25rem',
                    }}
                />
            </Box>

            {/* Matching Grid */}
            <Box
                sx={{
                    flex: 1,
                    px: '2rem',
                    pt: '4rem',
                    pb: 'max(1rem, var(--safe-area-bottom))',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '2rem',
                    alignItems: 'start',
                    maxWidth: '80rem',
                    mx: 'auto',
                    width: '100%',
                }}
            >
                {/* Terms Column */}
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                    }}
                >
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 600,
                            textAlign: 'center',
                            mb: '0.5rem',
                        }}
                    >
                        {t('matching.terms')}
                    </Typography>
                    {termCards.map((card, index) => (
                        <Grow in key={card.id} timeout={300 + index * 50}>
                            <Card
                                onClick={() => handleCardClick(card)}
                                sx={{
                                    outline:
                                        highlightIndex === index
                                            ? '3px solid'
                                            : undefined,
                                    outlineColor: 'secondary.main',
                                    outlineOffset: '2px',
                                    cursor: card.matched
                                        ? 'default'
                                        : 'pointer',
                                    transition: 'all 0.3s ease',
                                    borderRadius: '0.75rem',
                                    backgroundColor: card.matched
                                        ? 'rgba(76, 175, 80, 0.1)'
                                        : selectedCards.some(
                                                (c) => c.id === card.id
                                            )
                                          ? 'primary.main'
                                          : 'background.paper',
                                    color: selectedCards.some(
                                        (c) => c.id === card.id
                                    )
                                        ? 'primary.contrastText'
                                        : 'text.primary',
                                    opacity: card.matched ? 0.6 : 1,
                                    border: card.matched
                                        ? '2px solid'
                                        : '1px solid',
                                    borderColor: card.matched
                                        ? 'success.main'
                                        : 'divider',
                                    transform: selectedCards.some(
                                        (c) => c.id === card.id
                                    )
                                        ? 'scale(1.05)'
                                        : 'scale(1)',
                                    '&:hover': {
                                        transform: card.matched
                                            ? 'scale(1)'
                                            : 'scale(1.02)',
                                        boxShadow: card.matched ? undefined : 4,
                                    },
                                }}
                            >
                                <CardContent
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        minHeight: '4rem',
                                    }}
                                >
                                    <Typography
                                        variant="body1"
                                        sx={{
                                            fontWeight: 500,
                                            wordBreak: 'break-word',
                                            flex: 1,
                                        }}
                                    >
                                        {card.text}
                                    </Typography>
                                    <Zoom in={card.matched}>
                                        <CheckCircle
                                            sx={{
                                                color: 'success.main',
                                                ml: '0.5rem',
                                            }}
                                        />
                                    </Zoom>
                                </CardContent>
                            </Card>
                        </Grow>
                    ))}
                </Box>

                {/* Definitions Column */}
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                    }}
                >
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 600,
                            textAlign: 'center',
                            mb: '0.5rem',
                        }}
                    >
                        {t('matching.definitions')}
                    </Typography>
                    {definitionCards.map((card, index) => (
                        <Grow in key={card.id} timeout={300 + index * 50}>
                            <Card
                                onClick={() => handleCardClick(card)}
                                sx={{
                                    outline:
                                        highlightIndex ===
                                        termCards.length + index
                                            ? '3px solid'
                                            : undefined,
                                    outlineColor: 'secondary.main',
                                    outlineOffset: '2px',
                                    cursor: card.matched
                                        ? 'default'
                                        : 'pointer',
                                    transition: 'all 0.3s ease',
                                    borderRadius: '0.75rem',
                                    backgroundColor: card.matched
                                        ? 'rgba(76, 175, 80, 0.1)'
                                        : selectedCards.some(
                                                (c) => c.id === card.id
                                            )
                                          ? 'primary.main'
                                          : 'background.paper',
                                    color: selectedCards.some(
                                        (c) => c.id === card.id
                                    )
                                        ? 'primary.contrastText'
                                        : 'text.primary',
                                    opacity: card.matched ? 0.6 : 1,
                                    border: card.matched
                                        ? '2px solid'
                                        : '1px solid',
                                    borderColor: card.matched
                                        ? 'success.main'
                                        : 'divider',
                                    transform: selectedCards.some(
                                        (c) => c.id === card.id
                                    )
                                        ? 'scale(1.05)'
                                        : 'scale(1)',
                                    '&:hover': {
                                        transform: card.matched
                                            ? 'scale(1)'
                                            : 'scale(1.02)',
                                        boxShadow: card.matched ? undefined : 4,
                                    },
                                }}
                            >
                                <CardContent
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        minHeight: '4rem',
                                    }}
                                >
                                    <Typography
                                        variant="body1"
                                        sx={{
                                            fontWeight: 500,
                                            wordBreak: 'break-word',
                                            flex: 1,
                                        }}
                                    >
                                        {card.text}
                                    </Typography>
                                    <Zoom in={card.matched}>
                                        <CheckCircle
                                            sx={{
                                                color: 'success.main',
                                                ml: '0.5rem',
                                            }}
                                        />
                                    </Zoom>
                                </CardContent>
                            </Card>
                        </Grow>
                    ))}
                </Box>
            </Box>

            {/* Dialogs */}
            <StudyResults
                open={showResults}
                result={sessionResult}
                onClose={() => setShowResults(false)}
                onStudyAgain={handleStudyAgain}
            />

            <SettingsDialog
                open={showSettings}
                settings={activeSession.settings}
                onClose={() => setShowSettings(false)}
                onSave={handleSettingsSave}
            />
        </BasePage>
    );
};

export default MatchingStudy;
