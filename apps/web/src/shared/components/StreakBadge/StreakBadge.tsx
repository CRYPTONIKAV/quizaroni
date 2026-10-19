import { Whatshot } from '@mui/icons-material';
import { Chip, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useEffectiveStreak } from 'shared/hooks/useEffectiveStreak';

type Props = {
    onClick?: () => void;
};

const StreakBadge = ({ onClick }: Props) => {
    const { t } = useTranslation('profile');
    const { days } = useEffectiveStreak();

    if (days <= 0) return null;

    return (
        <Tooltip title={t('achievements.streakTooltip', { count: days })}>
            <Chip
                icon={<Whatshot sx={{ color: '#FF6B6B !important' }} />}
                label={days}
                onClick={onClick}
                clickable={!!onClick}
                size="small"
                sx={{
                    fontWeight: 700,
                    backgroundColor: 'rgba(255, 107, 107, 0.12)',
                    border: '0.0625rem solid rgba(255, 107, 107, 0.3)',
                }}
            />
        </Tooltip>
    );
};

export default StreakBadge;
