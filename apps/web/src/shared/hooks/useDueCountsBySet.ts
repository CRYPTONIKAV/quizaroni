import { useState, useEffect } from 'react';
import type { Studyset } from 'shared/types';
import { cardProgressRepository } from 'state/local/repositories';

// Cards due per set across the given library, or undefined until the first
// lookup finishes. A failed lookup counts as nothing due, so callers waiting
// on it never get stuck.
export function useDueCountsBySet(
    studysets: readonly Studyset[] | undefined
): ReadonlyMap<string, number> | undefined {
    const [counts, setCounts] = useState<ReadonlyMap<string, number>>();

    useEffect(() => {
        if (studysets === undefined) return;
        let cancelled = false;
        void cardProgressRepository
            .getDueCountsBySet(studysets, new Date())
            .catch((error: unknown) => {
                console.error('Failed to count due cards:', error);
                return new Map<string, number>();
            })
            .then((result) => {
                if (!cancelled) setCounts(result);
            });
        return () => {
            cancelled = true;
        };
    }, [studysets]);

    return counts;
}
