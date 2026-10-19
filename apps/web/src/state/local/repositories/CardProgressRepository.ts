import { getDatabase, type LocalCardProgress } from '../db';
import type { CardProgress, Studyset, UUID } from 'shared/types';
import {
    migrateProgressToFsrs,
    type LegacySm2Progress,
} from 'shared/utilities/srs';

const LEGACY_KEY = 'study-session-storage';
const MIGRATION_FLAG = 'srs-progress-migrated-v1';

// Repository for FSRS card progress - always hits local Dexie DB.
// Local-only for now (no backend sync); rows are marked pending for a future sync layer.
export class CardProgressRepository {
    private db = getDatabase();
    private migrated = false;

    // ===== Read =====

    async getByCard(cardUUID: UUID): Promise<LocalCardProgress | undefined> {
        await this.ensureMigrated();
        return await this.db.cardProgress.get(cardUUID);
    }

    async getAllForStudyset(studysetUUID: UUID): Promise<LocalCardProgress[]> {
        await this.ensureMigrated();
        return await this.db.cardProgress
            .where('studysetUUID')
            .equals(studysetUUID)
            .toArray();
    }

    async getDueForStudyset(
        studysetUUID: UUID,
        now: Date = new Date()
    ): Promise<LocalCardProgress[]> {
        await this.ensureMigrated();
        const nowIso = now.toISOString();
        // Compound index [studysetUUID+nextReview]: bound the range to this set,
        // upper-bounded by now (ISO strings sort chronologically).
        return await this.db.cardProgress
            .where('[studysetUUID+nextReview]')
            .between([studysetUUID, ''], [studysetUUID, nowIso], true, true)
            .toArray();
    }

    async getDueCount(
        studysetUUID: UUID,
        now: Date = new Date()
    ): Promise<number> {
        const due = await this.getDueForStudyset(studysetUUID, now);
        return due.length;
    }

    // Due counts for the given library. Progress rows for sets or cards that
    // are no longer in it are skipped. Sets come out ordered by their most
    // overdue card, because the query walks the nextReview index.
    async getDueCountsBySet(
        studysets: readonly Pick<Studyset, 'studysetUUID' | 'cards'>[],
        now: Date = new Date()
    ): Promise<Map<UUID, number>> {
        await this.ensureMigrated();
        const cardsBySet = new Map<UUID, Set<UUID>>();
        for (const { studysetUUID, cards } of studysets) {
            const ids = new Set<UUID>();
            // The library is only loosely validated, so skip malformed cards.
            for (const card of cards as unknown[]) {
                const cardUUID = (card as { cardUUID?: unknown } | null)
                    ?.cardUUID;
                if (typeof cardUUID === 'string') ids.add(cardUUID);
            }
            cardsBySet.set(studysetUUID, ids);
        }

        const due = await this.db.cardProgress
            .where('nextReview')
            .belowOrEqual(now.toISOString())
            .toArray();
        const counts = new Map<UUID, number>();
        for (const { cardUUID, studysetUUID } of due) {
            if (!cardsBySet.get(studysetUUID)?.has(cardUUID)) continue;
            counts.set(studysetUUID, (counts.get(studysetUUID) ?? 0) + 1);
        }
        return counts;
    }

    // ===== Write =====

    async upsert(
        progress: CardProgress,
        studysetUUID: UUID
    ): Promise<LocalCardProgress> {
        await this.ensureMigrated();
        const local: LocalCardProgress = {
            ...progress,
            studysetUUID,
            _syncStatus: 'pending',
            _lastModified: Date.now(),
        };
        await this.db.cardProgress.put(local);
        return local;
    }

    // ===== Migration (one-time, lazy, idempotent) =====

    private async ensureMigrated(): Promise<void> {
        if (this.migrated) return;
        this.migrated = true;

        if (
            typeof localStorage === 'undefined' ||
            localStorage.getItem(MIGRATION_FLAG)
        ) {
            return;
        }

        try {
            const raw = localStorage.getItem(LEGACY_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                // zustand persist shape: { state: { cardProgress: [[uuid, progress], ...] } }
                const entries: [string, LegacySm2Progress][] =
                    parsed?.state?.cardProgress ?? [];
                const rows: LocalCardProgress[] = entries
                    .map(([, p]) => p)
                    .filter((p) => p && p.cardUUID)
                    .map((p) =>
                        migrateProgressToFsrs({
                            ...p,
                            // studysetUUID was not tracked in the legacy Map; mark unknown.
                            studysetUUID: '',
                            _syncStatus: 'pending' as const,
                            _lastModified: Date.now(),
                        })
                    );
                if (rows.length > 0) {
                    await this.db.cardProgress.bulkPut(rows);
                }
            }
        } catch {
            // Corrupt legacy data is non-fatal; skip migration.
        } finally {
            localStorage.setItem(MIGRATION_FLAG, '1');
        }
    }
}

// Singleton instance
export const cardProgressRepository = new CardProgressRepository();
