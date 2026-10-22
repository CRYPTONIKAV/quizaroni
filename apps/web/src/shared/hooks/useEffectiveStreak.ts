import {
    getEffectiveStreak,
    type EffectiveStreak,
} from 'shared/utilities/gamification';
import { useGamificationStore } from 'state/stores/gamification';

// The streak as of today, rather than the value stored at the last session.
export function useEffectiveStreak(): EffectiveStreak {
    const currentStreak = useGamificationStore((s) => s.state.currentStreak);
    const lastStudyDate = useGamificationStore((s) => s.state.lastStudyDate);
    return getEffectiveStreak({ currentStreak, lastStudyDate }, new Date());
}
