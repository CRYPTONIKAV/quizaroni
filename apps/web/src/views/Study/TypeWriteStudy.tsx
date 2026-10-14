import { useState, useEffect, KeyboardEvent } from 'react';
import {
    Box,
    Card,
    CardContent,
    TextField,
    Button,
    Typography,
    Collapse,
    Chip,
    Snackbar,
    Alert,
} from '@mui/material';
import { Lightbulb } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useGetStudyset } from 'state/api/studysetsAPI';
import { useStudySessionStore } from 'state/stores/studySession';
import { Studyset, StudySessionResult } from 'shared/types';
import { STUDY_MODES, SCORING } from 'shared/constants';
import StudyHeader from './shared/StudyHeader';
import StudyResults from './shared/StudyResults';
import SettingsDialog from './shared/SettingsDialog';
import { BasePage } from 'styles/AppStyles';
import { useTranslation } from 'react-i18next';
import { useShortcuts } from 'shared/keyboard/useShortcuts';
import { stringSimilarity } from 'shared/utilities/stringSimilarity';
import useHaptics from 'shared/hooks/useHaptics';

type Props = {
    studysetId: string;
};

const TypeWriteStudy = ({ studysetId }: Props) => {
    const { t } = useTranslation('study');
    const { data: studysetResponse, isLoading } = useGetStudyset({
        studysetUUID: studysetId,
    });
    const studyset = studysetResponse?.studyset ?? ({} as Studyset);

    const {
        activeSession,
        startSession,
        endSession,
        updateCurrentCard,
        recordAnswer,
        updateCardProgress,
        incrementScore,
        updateStreak,
    } = useStudySessionStore();

    const { light: hapticLight, sessionComplete: hapticSessionComplete } =
        useHaptics();

    const [userAnswer, setUserAnswer] = useState('');
    const [hintsUsed, setHintsUsed] = useState(0);
    const [showHints, setShowHints] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [isCorrect, setIsCorrect] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [sessionResult, setSessionResult] =
        useState<StudySessionResult | null>(null);
    const [answerStartTime, setAnswerStartTime] = useState(Date.now());

    // Initialize session
    useEffect(() => {
        if (studyset?.cards?.length > 0 && !activeSession) {
            startSession({
                studysetUUID: studysetId,
                mode: STUDY_MODES.TYPE_WRITE,
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

    const currentCard = activeSession?.cards[activeSession.currentCardIndex];

    // Reset state when card changes
    useEffect(() => {
        if (currentCard) {
            setUserAnswer('');
            setHintsUsed(0);
            setShowHints(false);
            setShowFeedback(false);
            setAnswerStartTime(Date.now());
        }
    }, [currentCard]);

    const checkAnswer = (
        answer: string,
        correctAnswer: string,
        difficulty: string
    ): boolean => {
        const normalizedAnswer = answer.toLowerCase().trim();
        const normalizedCorrect = correctAnswer.toLowerCase().trim();

        if (normalizedAnswer === normalizedCorrect) return true;

        const similarity = stringSimilarity(
            normalizedAnswer,
            normalizedCorrect
        );

        // Difficulty-based thresholds
        const thresholds = {
            easy: 0.75,
            medium: 0.85,
            hard: 0.95,
        };

        return similarity >= thresholds[difficulty as keyof typeof thresholds];
    };

    const handleSubmit = () => {
        if (!currentCard || !activeSession) return;

        hapticLight();

        const difficulty = activeSession.settings.difficulty || 'medium';
        const correct = checkAnswer(
            userAnswer,
            currentCard.definition,
            difficulty
        );

        setIsCorrect(correct);
        setShowFeedback(true);

        const timeSpent = Math.floor((Date.now() - answerStartTime) / 1000);
        let scoreToAdd = 0;
        let quality = 1;

        if (correct) {
            scoreToAdd = SCORING.CORRECT_ANSWER;
            quality = hintsUsed === 0 ? 5 : hintsUsed === 1 ? 4 : 3;

            // Deduct hint penalties
            scoreToAdd += hintsUsed * SCORING.HINT_PENALTY;
            scoreToAdd = Math.max(0, scoreToAdd);

            setFeedbackMessage(t('typeWriteStudy.feedbackCorrect'));
            incrementScore(scoreToAdd);
            updateStreak(true);
        } else {
            quality = 1;
            setFeedbackMessage(
                t('typeWriteStudy.feedbackIncorrect', {
                    answer: currentCard.definition,
                })
            );
            updateStreak(false);
        }

        // Update progress and record answer
        updateCardProgress(currentCard.cardUUID, quality);
        recordAnswer({
            cardUUID: currentCard.cardUUID,
            correct,
            timeSpent,
            hintsUsed,
            answer: userAnswer,
        });

        // Auto-advance after delay
        setTimeout(() => {
            handleNext();
        }, 2500);
    };

    const handleNext = () => {
        if (!activeSession) return;

        const isLastCard =
            activeSession.currentCardIndex === activeSession.cards.length - 1;

        if (isLastCard) {
            hapticSessionComplete();
            const result = endSession();
            setSessionResult(result);
            setShowResults(true);
        } else {
            updateCurrentCard(activeSession.currentCardIndex + 1);
        }
    };

    const handleKeyPress = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' && userAnswer.trim() && !showFeedback) {
            handleSubmit();
        }
    };

    useShortcuts([
        {
            id: 'typewrite.next',
            keys: ['Enter'],
            scope: 'study:typewrite',
            descriptionKey: 'shortcuts.actions.confirm',
            handler: () => handleNext(),
            // Only after feedback is shown. While typing, focus is in the input
            // so the global listener ignores Enter and handleKeyPress submits.
            when: () => showFeedback,
        },
    ]);

    const handleUseHint = () => {
        setHintsUsed((prev) => prev + 1);
        setShowHints(true);
    };

    const handleAudioToggle = () => {
        if (!activeSession) return;
        const newSettings = {
            ...activeSession.settings,
            audioEnabled: !activeSession.settings.audioEnabled,
        };
        startSession({
            studysetUUID: studysetId,
            mode: STUDY_MODES.TYPE_WRITE,
            cards: studyset.cards,
            settings: newSettings,
        });
    };

    const handleSettingsSave = (newSettings) => {
        startSession({
            studysetUUID: studysetId,
            mode: STUDY_MODES.TYPE_WRITE,
            cards: studyset.cards,
            settings: newSettings,
        });
    };

    const handleStudyAgain = () => {
        setShowResults(false);
        setSessionResult(null);
        startSession({
            studysetUUID: studysetId,
            mode: STUDY_MODES.TYPE_WRITE,
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

    // `currentCard` is included deliberately: the session is persisted, so a
    // restored `currentCardIndex` can point past the end of a shortened deck.
    if (
        isLoading ||
        !activeSession ||
        !activeSession.cards ||
        activeSession.cards.length === 0 ||
        !currentCard
    ) {
        return (
            <BasePage>
                <Typography>{t('loading')}</Typography>
            </BasePage>
        );
    }

    const correctAnswer = currentCard.definition;

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
                currentCard={activeSession.currentCardIndex + 1}
                totalCards={activeSession.cards.length}
                score={activeSession.score}
                streak={activeSession.streak}
                audioEnabled={activeSession.settings.audioEnabled}
                onToggleAudio={handleAudioToggle}
                onSettings={() => setShowSettings(true)}
            />

            {/* Top Spacer */}
            <Box sx={{ pt: '4rem' }} />

            {/* Main Content */}
            <Box
                sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    px: '2rem',
                }}
            >
                <Card
                    elevation={6}
                    sx={{
                        maxWidth: '50rem',
                        width: '100%',
                        borderRadius: '1rem',
                    }}
                >
                    <Box
                        component={motion.div}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        sx={{ borderRadius: 'inherit' }}
                    >
                        <CardContent
                            sx={{
                                p: '2.5rem',
                                pb: 'max(2.5rem, var(--safe-area-bottom))',
                            }}
                        >
                            {/* Term Display */}
                            <Typography
                                variant="h5"
                                sx={{
                                    fontWeight: 600,
                                    mb: '2rem',
                                    textAlign: 'center',
                                }}
                            >
                                {currentCard.term}
                            </Typography>

                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mb: '1rem', textAlign: 'center' }}
                            >
                                {t('typeWriteStudy.typeDefinitionBelow')}
                            </Typography>

                            {/* Answer Input */}
                            <TextField
                                fullWidth
                                multiline
                                rows={4}
                                value={userAnswer}
                                onChange={(e) => setUserAnswer(e.target.value)}
                                onKeyPress={handleKeyPress}
                                disabled={showFeedback}
                                placeholder={t(
                                    'typeWriteStudy.answerPlaceholder'
                                )}
                                variant="outlined"
                                sx={{ mb: '1.5rem' }}
                            />

                            {/* Hints Section */}
                            <Box sx={{ mb: '1.5rem' }}>
                                <Button
                                    startIcon={<Lightbulb />}
                                    onClick={handleUseHint}
                                    disabled={showFeedback || hintsUsed >= 3}
                                    size="small"
                                    sx={{ mb: '1rem' }}
                                >
                                    {t('typeWriteStudy.useHint', {
                                        remaining: 3 - hintsUsed,
                                    })}
                                    {hintsUsed > 0
                                        ? ` ${t('typeWriteStudy.hintPenaltySuffix', { points: SCORING.HINT_PENALTY })}`
                                        : ''}
                                </Button>

                                <Collapse in={showHints}>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.5rem',
                                            p: '1rem',
                                            backgroundColor:
                                                'rgba(255, 160, 0, 0.1)',
                                            borderRadius: '0.5rem',
                                            border: '1px solid rgba(255, 160, 0, 0.3)',
                                        }}
                                    >
                                        {hintsUsed >= 1 && (
                                            <Chip
                                                label={t(
                                                    'typeWriteStudy.hint1FirstLetter',
                                                    {
                                                        letter: correctAnswer.charAt(
                                                            0
                                                        ),
                                                    }
                                                )}
                                                size="small"
                                                color="primary"
                                                variant="outlined"
                                            />
                                        )}
                                        {hintsUsed >= 2 && (
                                            <Chip
                                                label={t(
                                                    'typeWriteStudy.hint2FirstThree',
                                                    {
                                                        letters:
                                                            correctAnswer.substring(
                                                                0,
                                                                3
                                                            ),
                                                    }
                                                )}
                                                size="small"
                                                color="primary"
                                                variant="outlined"
                                            />
                                        )}
                                        {hintsUsed >= 3 && (
                                            <Chip
                                                label={t(
                                                    'typeWriteStudy.hint3Length',
                                                    {
                                                        count: correctAnswer.length,
                                                    }
                                                )}
                                                size="small"
                                                color="primary"
                                                variant="outlined"
                                            />
                                        )}
                                    </Box>
                                </Collapse>
                            </Box>

                            {/* Submit Button */}
                            {!showFeedback && (
                                <Box
                                    sx={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Button
                                        variant="contained"
                                        size="large"
                                        onClick={handleSubmit}
                                        disabled={!userAnswer.trim()}
                                        sx={{ minWidth: '10rem' }}
                                    >
                                        {t('actions.submitAnswer')}
                                    </Button>
                                </Box>
                            )}

                            {/* Difficulty Info */}
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                    display: 'block',
                                    mt: '1.5rem',
                                    textAlign: 'center',
                                }}
                            >
                                {(() => {
                                    const d =
                                        activeSession.settings.difficulty ||
                                        'medium';
                                    const levelKey =
                                        d === 'easy'
                                            ? 'typeWriteStudy.difficultyEasy'
                                            : d === 'hard'
                                              ? 'typeWriteStudy.difficultyHard'
                                              : 'typeWriteStudy.difficultyMedium';
                                    return t('typeWriteStudy.difficultyLine', {
                                        level: t(levelKey),
                                    });
                                })()}
                            </Typography>
                        </CardContent>
                    </Box>
                </Card>
            </Box>

            {/* Feedback Snackbar */}
            <Snackbar
                open={showFeedback}
                autoHideDuration={2500}
                onClose={() => setShowFeedback(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    severity={isCorrect ? 'success' : 'error'}
                    sx={{ width: '100%', fontSize: '1rem' }}
                >
                    {feedbackMessage}
                </Alert>
            </Snackbar>

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

export default TypeWriteStudy;
