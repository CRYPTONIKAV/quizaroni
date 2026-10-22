import { useState, useEffect } from 'react';
import { cardProgressRepository } from 'state/local/repositories';

// Latest study time per set from this device's card progress: undefined
// while loading, null if the lookup failed. Callers shouldn't treat a failure
// as "never studied", or a set studied yesterday could look stale.
export function useLastStudiedBySet():
    | ReadonlyMap<string, number>
    | null
    | undefined {
    const [lastStudied, setLastStudied] = useState<ReadonlyMap<
        string,
        number
    > | null>();

    useEffect(() => {
        let cancelled = false;
        void cardProgressRepository
            .getLastStudiedBySet()
            .catch((error: unknown) => {
                console.error('Failed to read study history:', error);
                return null;
            })
            .then((result) => {
                if (!cancelled) setLastStudied(result);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return lastStudied;
}
