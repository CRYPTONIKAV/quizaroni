import {
    Box,
    Button,
    Chip,
    Container,
    Divider,
    Paper,
    Skeleton,
    Stack,
    Typography,
} from '@mui/material/';
import { School as SchoolIcon } from '@mui/icons-material/';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
    GetPublicStudysetResponse,
    useGetPublicStudyset,
} from 'state/api/studysetsAPI';
import useBrowserTitle from 'hooks/useBrowserTitle';
import ImageGallery from 'components/ImageGallery/ImageGallery';
import { CardFileMetadata } from 'shared/types';

type PublicCardFiles =
    GetPublicStudysetResponse['studyset']['cards'][number]['files'];

// The public payload has no storage key or filename, so key by position plus
// URL (a refreshed URL resets ImageGallery's error state) and label
// generically. `files` can be missing when an older API response fails
// validation and reaches the view raw.
const toGalleryFiles = (
    files: PublicCardFiles | undefined,
    association: CardFileMetadata['association'],
    name: string
): CardFileMetadata[] =>
    (files ?? [])
        .filter((file) => file.association === association)
        .map((file, index) => ({
            ...file,
            key: `${association}-${index}-${file.signedURL}`,
            name,
            size: 0,
        }));

type Props = {
    showSignupCta?: boolean;
};

/**
 * Read-only, unauthenticated view of a publicly-shared study set. This is what
 * logged-out visitors (and social/link recipients) land on at `/view/:id`. It
 * only talks to the public endpoint — no user, sync, or mutation hooks — so it
 * never fires an authorized request. Owners viewing while logged in continue to
 * get the full `ViewStudySet` experience (routed in AppRoutes). `ViewStudySet`
 * also falls back to this view, with the sign-up CTA hidden, when a logged-in
 * user opens a set that isn't in their library.
 */
const PublicStudySet = ({ showSignupCta = true }: Props) => {
    const { t } = useTranslation();
    const { id: studysetUUID = '' } = useParams();

    const { data, isLoading, isError } = useGetPublicStudyset(studysetUUID);
    const studyset = data?.studyset;

    useBrowserTitle(studyset?.title ?? 'Quizaroni');

    if (isLoading) {
        return (
            <Container maxWidth="md" sx={{ py: 4 }}>
                <Skeleton variant="text" width="60%" height={48} />
                <Skeleton variant="text" width="30%" />
                <Skeleton variant="rectangular" height={120} sx={{ mt: 2 }} />
                <Skeleton variant="rectangular" height={120} sx={{ mt: 2 }} />
            </Container>
        );
    }

    if (isError || !studyset) {
        return (
            <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="h5" gutterBottom>
                    {t('publicView.unavailableTitle')}
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                    {t('publicView.unavailableBody')}
                </Typography>
                <Button variant="contained" component={RouterLink} to="/">
                    {t('publicView.goHome')}
                </Button>
            </Container>
        );
    }

    const cards = studyset.cards ?? [];

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Paper elevation={3} sx={{ p: { xs: 2, sm: 4 }, mb: 3 }}>
                <Typography variant="h4" component="h1" fontWeight={700}>
                    {studyset.title}
                </Typography>
                {studyset.username && (
                    <Typography
                        variant="subtitle1"
                        color="text.secondary"
                        sx={{ mt: 0.5 }}
                    >
                        {t('publicView.createdBy', {
                            username: studyset.username,
                        })}
                    </Typography>
                )}
                {studyset.description && (
                    <Typography variant="body1" sx={{ mt: 2 }}>
                        {studyset.description}
                    </Typography>
                )}
                <Stack
                    direction="row"
                    spacing={1}
                    useFlexGap
                    flexWrap="wrap"
                    sx={{ mt: 2, alignItems: 'center' }}
                >
                    <Chip
                        label={t('publicView.cards', { count: cards.length })}
                        color="primary"
                        variant="outlined"
                    />
                </Stack>
            </Paper>

            <Stack spacing={2}>
                {cards.map((card, index) => (
                    <Paper
                        key={index}
                        variant="outlined"
                        sx={{ p: { xs: 2, sm: 3 } }}
                    >
                        <Typography variant="overline" color="text.secondary">
                            {t('publicView.term')}
                        </Typography>
                        <Typography variant="h6" sx={{ mb: 1.5 }}>
                            {card.term}
                        </Typography>
                        <ImageGallery
                            files={toGalleryFiles(
                                card.files,
                                'term',
                                t('publicView.termImage')
                            )}
                            maxHeight="7rem"
                        />
                        <Divider sx={{ mb: 1.5 }} />
                        <Typography variant="overline" color="text.secondary">
                            {t('publicView.definition')}
                        </Typography>
                        <Typography
                            variant="body1"
                            sx={{ whiteSpace: 'pre-wrap' }}
                        >
                            {card.definition}
                        </Typography>
                        <ImageGallery
                            files={toGalleryFiles(
                                card.files,
                                'definition',
                                t('publicView.definitionImage')
                            )}
                            maxHeight="7rem"
                        />
                    </Paper>
                ))}
            </Stack>

            {/* Conversion CTA — turns a shared link into a signup. */}
            {showSignupCta && (
                <Paper
                    elevation={0}
                    sx={{
                        mt: 4,
                        p: { xs: 3, sm: 4 },
                        textAlign: 'center',
                        bgcolor: 'action.hover',
                        borderRadius: 2,
                    }}
                >
                    <SchoolIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                    <Typography variant="h6" fontWeight={700}>
                        {t('publicView.ctaTitle')}
                    </Typography>
                    <Typography
                        color="text.secondary"
                        sx={{ mt: 1, mb: 2, maxWidth: 480, mx: 'auto' }}
                    >
                        {t('publicView.ctaSubtitle')}
                    </Typography>
                    <Button
                        variant="contained"
                        size="large"
                        component={RouterLink}
                        to="/signUp"
                    >
                        {t('publicView.ctaButton')}
                    </Button>
                </Paper>
            )}

            <Box sx={{ height: 32 }} />
        </Container>
    );
};

export default PublicStudySet;
