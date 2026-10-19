import { Add, Delete } from '@mui/icons-material';
import {
    Box,
    Button,
    Card,
    CardContent,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    IconButton,
    MenuItem,
    TextField,
    Typography,
} from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PRESET_ACHIEVEMENTS } from 'shared/constants';
import { useEffectiveStreak } from 'shared/hooks/useEffectiveStreak';
import type { AchievementMetric } from 'shared/types';
import { useGamificationStore } from 'state/stores/gamification';
import { AccountViewContainer } from './ProfileStyles';

const CUSTOM_METRICS: AchievementMetric[] = [
    'total_sessions',
    'total_cards',
    'daily_streak',
    'studyset_sessions',
];

const AchievementsTab = () => {
    const { t } = useTranslation('profile');
    const state = useGamificationStore((s) => s.state);
    const { days: currentStreak } = useEffectiveStreak();
    const customAchievements = useGamificationStore((s) => s.customAchievements);
    const addCustomAchievement = useGamificationStore(
        (s) => s.addCustomAchievement
    );
    const removeCustomAchievement = useGamificationStore(
        (s) => s.removeCustomAchievement
    );

    const [dialogOpen, setDialogOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [icon, setIcon] = useState('🎯');
    const [metric, setMetric] = useState<AchievementMetric>('total_sessions');
    const [threshold, setThreshold] = useState(10);

    const isUnlocked = (id: string) =>
        state.unlockedAchievementIds.includes(id);

    const handleCreate = () => {
        if (!title.trim()) return;
        addCustomAchievement({
            title: title.trim(),
            description: description.trim(),
            icon: icon.trim() || '🎯',
            metric,
            threshold,
        });
        setDialogOpen(false);
        setTitle('');
        setDescription('');
        setIcon('🎯');
        setMetric('total_sessions');
        setThreshold(10);
    };

    return (
        <AccountViewContainer>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: '1rem' }}>
                        {t('achievements.streakTitle')}
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={6} sm={4}>
                            <Card variant="outlined">
                                <CardContent sx={{ textAlign: 'center' }}>
                                    <Typography variant="h4">🔥</Typography>
                                    <Typography variant="h5" fontWeight={700}>
                                        {currentStreak}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {t('achievements.currentStreak')}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={6} sm={4}>
                            <Card variant="outlined">
                                <CardContent sx={{ textAlign: 'center' }}>
                                    <Typography variant="h4">🏆</Typography>
                                    <Typography variant="h5" fontWeight={700}>
                                        {state.longestStreak}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {t('achievements.longestStreak')}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Box>

                <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: '1rem' }}>
                        {t('achievements.presetTitle')}
                    </Typography>
                    <Grid container spacing={1.5}>
                        {Object.values(PRESET_ACHIEVEMENTS).map((preset) => {
                            const unlocked = isUnlocked(preset.id);
                            return (
                                <Grid item xs={6} sm={4} md={3} key={preset.id}>
                                    <Card
                                        variant="outlined"
                                        sx={{
                                            opacity: unlocked ? 1 : 0.45,
                                            filter: unlocked
                                                ? 'none'
                                                : 'grayscale(0.8)',
                                        }}
                                    >
                                        <CardContent sx={{ textAlign: 'center' }}>
                                            <Typography variant="h4">
                                                {preset.icon}
                                            </Typography>
                                            <Typography
                                                variant="subtitle2"
                                                fontWeight={600}
                                            >
                                                {t(
                                                    `achievements.presets.${preset.i18nKey}.title`
                                                )}
                                            </Typography>
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                            >
                                                {t(
                                                    `achievements.presets.${preset.i18nKey}.description`
                                                )}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            );
                        })}
                    </Grid>
                </Box>

                <Box>
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: '1rem',
                        }}
                    >
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {t('achievements.customTitle')}
                        </Typography>
                        <Button
                            variant="contained"
                            startIcon={<Add />}
                            onClick={() => setDialogOpen(true)}
                        >
                            {t('achievements.createCustom')}
                        </Button>
                    </Box>

                    {customAchievements.length === 0 ? (
                        <Typography color="text.secondary">
                            {t('achievements.noCustom')}
                        </Typography>
                    ) : (
                        <Grid container spacing={1.5}>
                            {customAchievements.map((achievement) => (
                                <Grid item xs={12} sm={6} key={achievement.id}>
                                    <Card variant="outlined">
                                        <CardContent
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '1rem',
                                            }}
                                        >
                                            <Typography variant="h4">
                                                {achievement.icon}
                                            </Typography>
                                            <Box sx={{ flex: 1 }}>
                                                <Typography fontWeight={600}>
                                                    {achievement.title}
                                                </Typography>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    {achievement.description ||
                                                        t(
                                                            'achievements.customProgress',
                                                            {
                                                                current: 0,
                                                                target:
                                                                    achievement.threshold,
                                                            }
                                                        )}
                                                </Typography>
                                                {achievement.unlockedAt && (
                                                    <Typography
                                                        variant="caption"
                                                        color="success.main"
                                                    >
                                                        {t('achievements.unlocked')}
                                                    </Typography>
                                                )}
                                            </Box>
                                            <IconButton
                                                size="small"
                                                onClick={() =>
                                                    removeCustomAchievement(
                                                        achievement.id
                                                    )
                                                }
                                                aria-label={t(
                                                    'achievements.deleteCustom'
                                                )}
                                            >
                                                <Delete fontSize="small" />
                                            </IconButton>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    )}
                </Box>
            </Box>

            <Dialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>{t('achievements.createCustom')}</DialogTitle>
                <DialogContent
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        pt: '0.5rem',
                    }}
                >
                    <TextField
                        label={t('achievements.form.title')}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        fullWidth
                        required
                    />
                    <TextField
                        label={t('achievements.form.description')}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        fullWidth
                        multiline
                        rows={2}
                    />
                    <TextField
                        label={t('achievements.form.icon')}
                        value={icon}
                        onChange={(e) => setIcon(e.target.value)}
                        fullWidth
                        inputProps={{ maxLength: 4 }}
                    />
                    <TextField
                        select
                        label={t('achievements.form.metric')}
                        value={metric}
                        onChange={(e) =>
                            setMetric(e.target.value as AchievementMetric)
                        }
                        fullWidth
                    >
                        {CUSTOM_METRICS.map((m) => (
                            <MenuItem key={m} value={m}>
                                {t(`achievements.metrics.${m}`)}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        label={t('achievements.form.threshold')}
                        type="number"
                        value={threshold}
                        onChange={(e) =>
                            setThreshold(Number(e.target.value) || 1)
                        }
                        fullWidth
                        inputProps={{ min: 1 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>
                        {t('achievements.form.cancel')}
                    </Button>
                    <Button variant="contained" onClick={handleCreate}>
                        {t('achievements.form.save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </AccountViewContainer>
    );
};

export default AchievementsTab;
