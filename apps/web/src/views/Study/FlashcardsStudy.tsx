import { useState, useEffect, useRef } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    IconButton,
    Stack,
    Typography,
    Stepper,
    Step,
    StepLabel,
    Fade,
    Tooltip,
    useTheme,
} from '@mui/material';
import {
    ArrowBack,
    ArrowForward,
    Replay,
    VolumeUp,
    VolumeOff,
} from '@mui/icons-material';
import {
    motion,
    AnimatePresence,
    useMotionValue,
    useTransform,
    useReducedMotion,
    type PanInfo,
} from 'framer-motion';
import { useGetStudyset } from 'state/api/studysetsAPI';
import { useGetUser } from 'state/api/usersAPI';
import { useStudySessionStore } from 'state/stores/studySession';
import { Studyset } from 'shared/types';
import { STUDY_MODES, DEFAULT_USER_RESPONSE } from 'shared/constants';
import StudyHeader from './shared/StudyHeader';
import StudyResults from './shared/StudyResults';
import SettingsDialog from './shared/SettingsDialog';
import { BasePage } from 'styles/AppStyles';
import ImageGallery from 'components/ImageGallery/ImageGallery';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useShortcuts } from 'shared/keyboard/useShortcuts';
import { cardProgressRepository } from 'state/local/repositories';
import {
    newProgress,
    projectInterval,
    GRADE_QUALITY,
    type Grade,
} from 'shared/utilities/srs';
import type { CardProgress, StudySessionResult } from 'shared/types';
import { resolveSwipe, SWIPE_DISTANCE_THRESHOLD } from './swipeGesture';
import useHaptics from 'shared/hooks/useHaptics';

type Props = {
    studysetId: string;
    reviewMode?: boolean;
};

const FlashcardsStudy = ({ studysetId, reviewMode = false }: Props) => {
    const { t } = useTranslation('study');
    const navigate = useNavigate();
    const theme = useTheme();
    const { data: studysetResponse, isLoading } = useGetStudyset({
        studysetUUID: studysetId,
    });
    const studyset = studysetResponse?.studyset ?? ({} as Studyset);
    const { data: userData = DEFAULT_USER_RESPONSE } = useGetUser();
    const ttsVoice = userData.user?.metadata?.ttsVoice;

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

    const [flipped, setFlipped] = useState(false);
    const [showRating, setShowRating] = useState(false);
    const [hasRated, setHasRated] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [sessionResult, setSessionResult] =
        useState<StudySessionResult | null>(null);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const lightboxCooldownRef = useRef(false);

    const [dueCardUUIDs, setDueCardUUIDs] = useState<string[] | null>(null);
    const [cardProgress, setCardProgress] = useState<CardProgress | null>(null);

    // Swipe gesture state (Issue #26). dragX/dragY drive the card's position
    // and derived tilt/overlay-opacity; didDragRef suppresses the synthetic
    // click that follows a drag release so a swipe never also fires a flip.
    const dragX = useMotionValue(0);
    const dragY = useMotionValue(0);
    const prefersReducedMotion = useReducedMotion();
    const tilt = useTransform(dragX, [-300, 0, 300], [-12, 0, 12]);
    const againOpacity = useTransform(
        dragX,
        [-SWIPE_DISTANCE_THRESHOLD, -20, 0],
        [1, 0, 0]
    );
    const goodOpacity = useTransform(
        dragX,
        [0, 20, SWIPE_DISTANCE_THRESHOLD],
        [0, 0, 1]
    );
    const didDragRef = useRef(false);
    const { light: hapticLight, sessionComplete: hapticSessionComplete } =
        useHaptics();

    // Initialize session
    useEffect(() => {
        // In review mode, wait until due UUIDs have resolved.
        if (reviewMode && dueCardUUIDs === null) return;

        const sessionCards =
            reviewMode && dueCardUUIDs
                ? studyset.cards.filter((c) =>
                      dueCardUUIDs.includes(c.cardUUID)
                  )
                : studyset?.cards;

        if (sessionCards?.length > 0 && !activeSession) {
            startSession({
                studysetUUID: studysetId,
                mode: reviewMode ? STUDY_MODES.REVIEW : STUDY_MODES.FLASHCARDS,
                cards: sessionCards,
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
    }, [studyset?.cards, studysetId, activeSession, reviewMode, dueCardUUIDs]);

    // In review mode, resolve which cards are due before starting the session.
    useEffect(() => {
        if (!reviewMode) {
            setDueCardUUIDs(null);
            return;
        }
        let cancelled = false;
        void (async () => {
            const due =
                await cardProgressRepository.getDueForStudyset(studysetId);
            // getDueForStudyset already returns ascending by nextReview.
            if (!cancelled) setDueCardUUIDs(due.map((p) => p.cardUUID));
        })();
        return () => {
            cancelled = true;
        };
    }, [reviewMode, studysetId]);

    useEffect(() => {
        if (activeSession?.settings?.audioEnabled && flipped && !hasRated) {
            const currentCard =
                activeSession?.cards?.[activeSession.currentCardIndex];
            if (currentCard?.definition) {
                playAudio(currentCard.definition);
            }
        }
    }, [
        flipped,
        activeSession?.settings?.audioEnabled,
        activeSession?.cards,
        activeSession?.currentCardIndex,
        hasRated,
    ]);

    // Load SM-2 progress for the current card so grade buttons can preview intervals.
    useEffect(() => {
        const cardUUID =
            activeSession?.cards?.[activeSession?.currentCardIndex ?? 0]
                ?.cardUUID;
        if (!cardUUID) return;
        let cancelled = false;
        void (async () => {
            const existing = await cardProgressRepository.getByCard(cardUUID);
            if (!cancelled) {
                setCardProgress(existing ?? newProgress(cardUUID));
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [activeSession?.cards, activeSession?.currentCardIndex]);

    // Keyboard shortcuts must be registered unconditionally (before any early
    // return) so the hook order stays stable across loading/loaded renders. The
    // handler/`when` closures below reference values defined later in render;
    // they are only invoked on keypress, by which point those are initialized.
    // useShortcuts keeps the latest bindings via a ref, so fresh state is used.
    useShortcuts([
        {
            id: 'flashcards.flip',
            keys: [' ', 'Enter'],
            scope: 'study:flashcards',
            descriptionKey: 'shortcuts.actions.flip',
            handler: () => handleFlip(),
            when: () => !showResults && !hasRated,
        },
        {
            id: 'flashcards.grade',
            keys: ['1', '2', '3', '4'],
            scope: 'study:flashcards',
            descriptionKey: 'shortcuts.actions.gradeGood',
            handler: (e) => {
                const grade = gradeKeyMap[e.key];
                if (grade) handleGrade(grade);
            },
            when: () => flipped && !hasRated && !showResults,
        },
        {
            id: 'flashcards.prev',
            keys: ['ArrowLeft'],
            scope: 'study:flashcards',
            descriptionKey: 'shortcuts.actions.prev',
            handler: () => handlePrevious(),
            when: () => !showResults,
        },
        {
            id: 'flashcards.next',
            keys: ['ArrowRight'],
            scope: 'study:flashcards',
            descriptionKey: 'shortcuts.actions.next',
            handler: () => handleNext(),
            when: () => !showResults,
        },
    ]);

    // Review mode with nothing due: show a caught-up state instead of a session.
    if (reviewMode && dueCardUUIDs !== null && dueCardUUIDs.length === 0) {
        return (
            <BasePage
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh',
                    gap: '1rem',
                }}
            >
                <Typography variant="h4" sx={{ fontWeight: 600 }}>
                    {t('review.caughtUp')}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    {t('review.caughtUpSubtitle')}
                </Typography>
                <Button
                    variant="contained"
                    onClick={() => navigate(`/view/${studysetId}`)}
                    sx={{ mt: 2 }}
                >
                    {t('results.backToSet')}
                </Button>
            </BasePage>
        );
    }

    if (
        isLoading ||
        !activeSession ||
        !activeSession.cards ||
        activeSession.cards.length === 0
    ) {
        return (
            <BasePage>
                <Typography>Loading...</Typography>
            </BasePage>
        );
    }

    const currentCard = activeSession.cards[activeSession.currentCardIndex];
    const isLastCard =
        activeSession.currentCardIndex === activeSession.cards.length - 1;
    const isFirstCard = activeSession.currentCardIndex === 0;

    if (!currentCard) {
        return (
            <BasePage>
                <Typography>Loading...</Typography>
            </BasePage>
        );
    }

    const playAudio = (text: string) => {
        if (window.speechSynthesis && text) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            if (ttsVoice) {
                const voice = window.speechSynthesis
                    .getVoices()
                    .find((v) => v.voiceURI === ttsVoice);
                if (voice) utterance.voice = voice;
            }
            window.speechSynthesis.speak(utterance);
        }
    };

    const intervalLabel = (grade: Grade): string => {
        if (!cardProgress) return '';
        const days = projectInterval(cardProgress, grade);
        return days < 1 ? '<1d' : `${days}d`;
    };

    const GRADES: Grade[] = ['again', 'hard', 'good', 'easy'];

    const handleCardClick = () => {
        if (
            !hasRated &&
            !lightboxOpen &&
            !lightboxCooldownRef.current &&
            !didDragRef.current
        ) {
            hapticLight();
            setFlipped(!flipped);
            if (!flipped) {
                setShowRating(true);
            }
        }
    };

    const handleDragStart = () => {
        didDragRef.current = true;
    };

    const handleDragEnd = (
        _event: MouseEvent | TouchEvent | PointerEvent,
        info: PanInfo
    ) => {
        // Clear the drag flag on the next tick so the click that follows
        // pointerup on some browsers still sees it as a drag.
        setTimeout(() => {
            didDragRef.current = false;
        }, 0);

        const action = resolveSwipe({
            offset: info.offset,
            velocity: info.velocity,
            canGrade: flipped && !hasRated && !showResults,
            // Vertical swipe only flips term -> definition. Once flipped, an
            // up-leaning diagonal drag during a grading swipe must not flip
            // the card back and hide the rating controls.
            canFlip:
                !flipped &&
                !hasRated &&
                !lightboxOpen &&
                !lightboxCooldownRef.current,
        });

        if (action.type === 'grade') {
            handleGrade(action.grade);
        } else if (action.type === 'flip') {
            handleFlip();
        }
    };

    const handleLightboxChange = (isOpen: boolean) => {
        setLightboxOpen(isOpen);
        if (!isOpen) {
            // Set cooldown to prevent accidental flip when closing lightbox
            lightboxCooldownRef.current = true;
            setTimeout(() => {
                lightboxCooldownRef.current = false;
            }, 100);
        }
    };

    const handleGrade = (grade: Grade) => {
        if (hasRated) return;
        const quality = GRADE_QUALITY[grade];

        setHasRated(true);
        hapticLight();

        updateCardProgress(currentCard.cardUUID, quality);

        const isCorrect = quality >= 3;
        const timeSpent = Math.floor(
            (Date.now() - new Date(activeSession.startTime).getTime()) / 1000
        );
        recordAnswer({
            cardUUID: currentCard.cardUUID,
            correct: isCorrect,
            timeSpent,
            hintsUsed: 0,
        });

        if (isCorrect) {
            incrementScore(100);
            updateStreak(true);
        } else {
            updateStreak(false);
        }

        if (activeSession.settings.autoAdvance) {
            setTimeout(() => {
                handleNext();
            }, 500);
        }
    };

    const handleNext = () => {
        if (isLastCard) {
            // End session and show results
            hapticSessionComplete();
            const result = endSession();
            setSessionResult(result);
            setShowResults(true);
        } else {
            updateCurrentCard(activeSession.currentCardIndex + 1);
            setFlipped(false);
            setShowRating(false);
            setHasRated(false);
            dragX.set(0);
            dragY.set(0);
        }
    };

    const handlePrevious = () => {
        if (!isFirstCard) {
            updateCurrentCard(activeSession.currentCardIndex - 1);
            setFlipped(false);
            setShowRating(false);
            setHasRated(false);
            dragX.set(0);
            dragY.set(0);
        }
    };

    const handleFlip = () => {
        hapticLight();
        setFlipped(!flipped);
        if (!flipped) {
            setShowRating(true);
        }
    };

    const gradeKeyMap: Record<string, Grade> = {
        '1': 'again',
        '2': 'hard',
        '3': 'good',
        '4': 'easy',
    };

    const handleAudioToggle = () => {
        if (!activeSession) return;
        const newSettings = {
            ...activeSession.settings,
            audioEnabled: !activeSession.settings.audioEnabled,
        };
        startSession({
            studysetUUID: studysetId,
            mode: STUDY_MODES.FLASHCARDS,
            cards: studyset.cards,
            settings: newSettings,
        });
    };

    const handleSettingsSave = (newSettings) => {
        startSession({
            studysetUUID: studysetId,
            mode: STUDY_MODES.FLASHCARDS,
            cards: studyset.cards,
            settings: newSettings,
        });
    };

    const handleStudyAgain = () => {
        setShowResults(false);
        setSessionResult(null);
        startSession({
            studysetUUID: studysetId,
            mode: STUDY_MODES.FLASHCARDS,
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
        setFlipped(false);
        setShowRating(false);
        setHasRated(false);
        dragX.set(0);
        dragY.set(0);
    };

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

            {/* Stepper - at top */}
            <Box
                sx={{
                    width: '100%',
                    maxWidth: '50rem',
                    mx: 'auto',
                    pt: '4rem',
                    pb: '1.5rem',
                    px: '2rem',
                }}
            >
                <Stepper
                    activeStep={activeSession.currentCardIndex}
                    alternativeLabel
                >
                    {activeSession.cards.map((card) => (
                        <Step key={card.cardUUID}>
                            <StepLabel />
                        </Step>
                    ))}
                </Stepper>
            </Box>

            {/* Main Card Area */}
            <Box
                sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    px: '2rem',
                }}
            >
                {/* Card Container */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '2rem',
                        width: '100%',
                    }}
                >
                    {/* Previous Button */}
                    <Tooltip title={t('actions.previousCard')}>
                        <span>
                            <IconButton
                                onClick={handlePrevious}
                                disabled={isFirstCard}
                                aria-label={t('actions.previousCard')}
                                color="primary"
                                sx={{ fontSize: '3rem' }}
                            >
                                <ArrowBack fontSize="inherit" />
                            </IconButton>
                        </span>
                    </Tooltip>

                    {/* Flashcard */}
                    <AnimatePresence mode="wait">
                        <Box
                            key={currentCard.cardUUID}
                            sx={{
                                position: 'relative',
                                perspective: '1000px',
                                width: '50rem',
                                height: '30rem',
                            }}
                        >
                            {/* Swipe overlay labels - siblings of the flipping
                                card so back-face mirroring never flips their
                                left/right placement. */}
                            <motion.div
                                style={{
                                    opacity: againOpacity,
                                    position: 'absolute',
                                    top: '1.5rem',
                                    left: '1.5rem',
                                    zIndex: 2,
                                    pointerEvents: 'none',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '0.5rem',
                                    border: '0.15rem solid',
                                    borderColor: theme.palette.error.main,
                                    color: theme.palette.error.main,
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                }}
                            >
                                {t('ratings.again')}
                            </motion.div>
                            <motion.div
                                style={{
                                    opacity: goodOpacity,
                                    position: 'absolute',
                                    top: '1.5rem',
                                    right: '1.5rem',
                                    zIndex: 2,
                                    pointerEvents: 'none',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '0.5rem',
                                    border: '0.15rem solid',
                                    borderColor: theme.palette.success.main,
                                    color: theme.palette.success.main,
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                }}
                            >
                                {t('ratings.good')}
                            </motion.div>
                            <motion.div
                                initial={{ rotateY: 0 }}
                                animate={{ rotateY: flipped ? 180 : 0 }}
                                transition={{ duration: 0.6, type: 'spring' }}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    position: 'relative',
                                    transformStyle: 'preserve-3d',
                                    cursor: hasRated ? 'default' : 'pointer',
                                    x: dragX,
                                    y: dragY,
                                    rotate: prefersReducedMotion ? 0 : tilt,
                                }}
                                drag={!hasRated && !lightboxOpen}
                                dragDirectionLock
                                dragElastic={0.6}
                                dragConstraints={{
                                    left: 0,
                                    right: 0,
                                    top: 0,
                                    bottom: 0,
                                }}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                                onClick={handleCardClick}
                            >
                                {/* Front of card (Term) */}
                                <Card
                                    elevation={8}
                                    sx={{
                                        position: 'absolute',
                                        width: '100%',
                                        height: '100%',
                                        backfaceVisibility: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '1rem',
                                    }}
                                >
                                    <CardContent
                                        sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <Typography
                                            variant="h4"
                                            sx={{
                                                textAlign: 'center',
                                                fontWeight: 600,
                                                wordBreak: 'break-word',
                                            }}
                                        >
                                            {currentCard.term}
                                        </Typography>
                                        {!activeSession.settings.hideImages && (
                                            <ImageGallery
                                                files={
                                                    currentCard.files?.filter(
                                                        (f) =>
                                                            f.association ===
                                                            'term'
                                                    ) || []
                                                }
                                                maxHeight="20vh"
                                                onLightboxChange={
                                                    handleLightboxChange
                                                }
                                            />
                                        )}
                                    </CardContent>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{
                                            textAlign: 'center',
                                            position: 'absolute',
                                            bottom: '1.5rem',
                                        }}
                                    >
                                        Click to flip
                                    </Typography>
                                </Card>

                                {/* Back of card (Definition) */}
                                <Card
                                    elevation={8}
                                    sx={{
                                        position: 'absolute',
                                        width: '100%',
                                        height: '100%',
                                        backfaceVisibility: 'hidden',
                                        transform: 'rotateY(180deg)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '1rem',
                                        backgroundColor: 'primary.main',
                                        color: 'primary.contrastText',
                                    }}
                                >
                                    <CardContent
                                        sx={{
                                            flex: 1,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <Typography
                                            variant="h4"
                                            sx={{
                                                textAlign: 'center',
                                                fontWeight: 600,
                                                wordBreak: 'break-word',
                                            }}
                                        >
                                            {currentCard.definition}
                                        </Typography>
                                        {!activeSession.settings.hideImages && (
                                            <ImageGallery
                                                files={
                                                    currentCard.files?.filter(
                                                        (f) =>
                                                            f.association ===
                                                            'definition'
                                                    ) || []
                                                }
                                                maxHeight="20vh"
                                                onLightboxChange={
                                                    handleLightboxChange
                                                }
                                            />
                                        )}
                                    </CardContent>

                                    {/* Grading Section */}
                                    <Fade in={showRating && !hasRated}>
                                        <Box
                                            sx={{
                                                p: '1.5rem',
                                                backgroundColor:
                                                    'rgba(0, 0, 0, 0.2)',
                                                width: '100%',
                                                borderBottomLeftRadius: '1rem',
                                                borderBottomRightRadius: '1rem',
                                            }}
                                        >
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    mb: '0.75rem',
                                                    textAlign: 'center',
                                                }}
                                            >
                                                {t('review.ratePrompt')}
                                            </Typography>
                                            <Stack
                                                direction="row"
                                                spacing="0.5rem"
                                                justifyContent="center"
                                            >
                                                {GRADES.map((grade) => (
                                                    <Button
                                                        key={grade}
                                                        variant="contained"
                                                        color={
                                                            grade === 'again'
                                                                ? 'error'
                                                                : 'inherit'
                                                        }
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleGrade(grade);
                                                        }}
                                                        sx={{
                                                            flexDirection:
                                                                'column',
                                                            minWidth: '5rem',
                                                            textTransform:
                                                                'none',
                                                            lineHeight: 1.2,
                                                        }}
                                                    >
                                                        <span>
                                                            {t(
                                                                `ratings.${grade}`
                                                            )}
                                                        </span>
                                                        <Typography
                                                            variant="caption"
                                                            sx={{
                                                                opacity: 0.8,
                                                            }}
                                                        >
                                                            {intervalLabel(
                                                                grade
                                                            )}
                                                        </Typography>
                                                    </Button>
                                                ))}
                                            </Stack>
                                        </Box>
                                    </Fade>
                                </Card>
                            </motion.div>
                        </Box>
                    </AnimatePresence>

                    {/* Next Button */}
                    <Tooltip
                        title={
                            isLastCard
                                ? t('actions.finish')
                                : t('actions.nextCard')
                        }
                    >
                        <span>
                            <IconButton
                                onClick={handleNext}
                                disabled={!hasRated}
                                aria-label={
                                    isLastCard
                                        ? t('actions.finish')
                                        : t('actions.nextCard')
                                }
                                color="primary"
                                sx={{ fontSize: '3rem' }}
                            >
                                <ArrowForward fontSize="inherit" />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Box>
            </Box>

            {/* Bottom Controls */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '1rem',
                    paddingBottom: 'max(0.5rem, var(--safe-area-bottom))',
                }}
            >
                <Tooltip title={t('actions.flipCard')}>
                    <span>
                        <IconButton
                            onClick={handleFlip}
                            color="primary"
                            size="large"
                            aria-label={t('actions.flipCard')}
                        >
                            <Replay fontSize="inherit" />
                        </IconButton>
                    </span>
                </Tooltip>
                <Tooltip
                    title={
                        activeSession.settings.audioEnabled
                            ? t('header.audioOn')
                            : t('header.audioOff')
                    }
                >
                    <span>
                        <IconButton
                            onClick={handleAudioToggle}
                            color="primary"
                            size="large"
                            aria-label={t(activeSession.settings.audioEnabled ? 'header.audioOn' : 'header.audioOff')}
                        >
                            {activeSession.settings.audioEnabled ? (
                                <VolumeUp fontSize="inherit" />
                            ) : (
                                <VolumeOff fontSize="inherit" />
                            )}
                        </IconButton>
                    </span>
                </Tooltip>
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

export default FlashcardsStudy;
