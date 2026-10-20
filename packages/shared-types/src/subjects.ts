export const SUBJECT_IDS = [
    'languages',
    'math',
    'science',
    'medicine-health',
    'history',
    'geography',
    'social-sciences',
    'law',
    'computer-science',
    'business-economics',
    'arts-humanities',
    'other',
] as const;

export type SubjectId = (typeof SUBJECT_IDS)[number];

export const isSubjectId = (value: unknown): value is SubjectId =>
    typeof value === 'string' && (SUBJECT_IDS as readonly string[]).includes(value);
