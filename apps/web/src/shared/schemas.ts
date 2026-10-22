import { z } from 'zod';
import { SUBJECT_IDS } from '@quizaroni/shared-types';

// #region Base Schemas
export const UUIDSchema = z.uuid({
    version: 'v4',
});
export const TimestampSchema = z.iso.datetime();
export const SignedURLSchema = z.url();

// #endregion

// #region Studyset Schemas
export const NoteSchema = z.object({
    noteUUID: UUIDSchema,
    text: z.string(),
});

export const CardFileMetadataSchema = z.object({
    association: z.enum(['term', 'definition']),
    key: z.string(),
    name: z.string(),
    signedURL: SignedURLSchema,
    size: z.number(),
});

export const CardSchema = z.object({
    backgroundColor: z.string().optional(),
    cardUUID: UUIDSchema,
    categories: z.array(z.string()),
    definition: z.string(),
    files: z.array(CardFileMetadataSchema),
    important: z.boolean(),
    notes: z.array(NoteSchema),
    term: z.string(),
    textColor: z.string().optional(),
});

export const StudysetMetadataSchema = z.object({
    backgroundColorVisible: z.boolean(),
    cardCountVisible: z.boolean().optional(),
    contentOnly: z.boolean().optional(),
    customLabelTerminology: z.string(),
    customTerminology: z.string(),
    labelTerminology: z.string(),
    notesDrawerInitial: z.string(),
    notesDrawerPosition: z.enum(['left', 'right']),
    publiclyViewable: z.boolean(),
    terminology: z.string(),
    textColorVisible: z.boolean(),
});

export const StudysetSchema = z.object({
    cards: z.array(CardSchema),
    categories: z.array(z.string()),
    createdAt: TimestampSchema,
    description: z.string(),
    favorited: z.boolean().optional(),
    labels: z.array(z.string()),
    lastViewed: TimestampSchema,
    metadata: StudysetMetadataSchema,
    publishedAt: TimestampSchema.optional(),
    studysetUUID: UUIDSchema,
    subject: z.enum(SUBJECT_IDS).optional(),
    title: z.string(),
    username: z.string(),
    userUUID: UUIDSchema,
    uuid: UUIDSchema,
});

// #endregion

// #region User Schemas
export const NamedColorSchema = z.object({
    color: z.string(),
    name: z.string(),
});

export const AvatarMetadataSchema = z.object({
    type: z.enum(['dicebear', 'upload']),
    value: z.string().url(),
});

export const EmailNotificationSettingsSchema = z.object({
    enabled: z.boolean(),
    studyReminders: z.boolean(),
    streakAlerts: z.boolean(),
    weeklyDigest: z.boolean(),
    inactivityNudges: z.boolean(),
    digestDay: z.number().min(0).max(6).optional(),
});

export const QuietHoursSettingsSchema = z.object({
    enabled: z.boolean(),
    start: z.string(),
    end: z.string(),
    timezone: z.string(),
});

export const StudysetNotificationPrefsSchema = z.object({
    studysetUUID: UUIDSchema,
    enabled: z.boolean(),
    reminderTime: z.string().optional(),
    reminderDays: z.array(z.number().min(0).max(6)).optional(),
});

export const NotificationPreferencesSchema = z.object({
    enabled: z.boolean(),
    mode: z.enum(['calm', 'regular', 'power-user', 'custom']),
    email: EmailNotificationSettingsSchema,
    quietHours: QuietHoursSettingsSchema,
    snoozeUntil: z.string().optional(),
    studysetPrefs: z.array(StudysetNotificationPrefsSchema),
});

export const GamificationStateSchema = z.object({
    currentStreak: z.number(),
    longestStreak: z.number(),
    lastStudyDate: z.string().nullable(),
    unlockedAchievementIds: z.array(z.string()),
    unlockedAtById: z.record(z.string(), z.string()),
    studiedStudysetUUIDs: z.array(UUIDSchema),
    studysetSessionCounts: z.record(z.string(), z.number()),
});

export const CustomAchievementSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    icon: z.string(),
    metric: z.enum([
        'daily_streak',
        'total_sessions',
        'total_cards',
        'session_streak',
        'perfect_session',
        'studyset_sessions',
    ]),
    threshold: z.number(),
    studysetUUID: UUIDSchema.optional(),
    createdAt: TimestampSchema,
    unlockedAt: TimestampSchema.optional(),
});

export const UserMetadataSchema = z.object({
    avatar: AvatarMetadataSchema.optional(),
    confirmDestructiveActions: z.boolean().optional(),
    defaultDownloadFormat: z.enum(['TXT', 'JSON', 'CSV', 'MD']),
    defaultTheme: z.enum(['light', 'dark']),
    density: z.enum(['compact', 'standard', 'comfortable']).optional(),
    fontSizeScale: z.number().min(0.75).max(1.5).optional(),
    homeView: z.enum(['table', 'grid', 'html']),
    namedColors: z.array(NamedColorSchema),
    notifications: NotificationPreferencesSchema.optional(),
    gamification: GamificationStateSchema.optional(),
    customAchievements: z.array(CustomAchievementSchema).optional(),
    preferredDateFormat: z.enum(['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY']),
    preferredTimeFormat: z.enum(['12h', '24h']).optional(),
    showSeconds: z.boolean().optional(),
    ttsVoice: z.string().optional(),
    visibleColumns: z.record(z.string(), z.boolean()).optional(),
});

// Strict schema for the JSON settings editor — rejects unknown keys
const EDITOR_EXCLUDED_FIELDS = [
    'avatar',
    'namedColors',
    'notifications',
] as const;
export const EditableUserMetadataSchema = UserMetadataSchema.omit({
    avatar: true,
    namedColors: true,
    notifications: true,
})
    .partial()
    .strict();

export const UserSchema = z.object({
    createdAt: TimestampSchema,
    email: z.email(),
    labels: z.array(z.string()),
    metadata: UserMetadataSchema,
    username: z.string(),
    userUUID: UUIDSchema,
});

// #endregion

// #region API Request/Response Schemas

// Base
export const BaseResponseSchema = z.object({
    message: z.string(),
});

export const StudysetUUIDPayloadSchema = z.object({
    studysetUUID: UUIDSchema,
});

// Studysets
export const GetAllStudysetsResponseSchema = z.object({
    studysets: z.array(StudysetSchema),
});

export const GetStudysetRequestSchema = StudysetUUIDPayloadSchema;

export const GetStudysetResponseSchema = z.object({
    studyset: StudysetSchema,
});

export const CreateStudysetResponseSchema = z.object({
    studyset: StudysetSchema,
});

// Public (unauthenticated) read of a shared set. An explicit allowlist that
// mirrors `toPublicStudyset` in `apps/api/utilities/publicStudyset.ts`; the
// owner's private fields and storage keys are never sent.
export const PublicCardFileSchema = z.object({
    association: z.enum(['term', 'definition']),
    signedURL: SignedURLSchema,
});

export const PublicCardSchema = z.object({
    term: z.string(),
    definition: z.string(),
    files: z.array(PublicCardFileSchema),
});

export const PublicStudysetSchema = z.object({
    title: z.string(),
    description: z.string(),
    username: z.string().nullable(),
    subject: z.string().nullable(),
    publishedAt: TimestampSchema.nullable(),
    updatedAt: TimestampSchema.nullable(),
    cards: z.array(PublicCardSchema),
});

export const GetPublicStudysetResponseSchema = z.object({
    message: z.string().optional(),
    studyset: PublicStudysetSchema,
});

export const DeleteStudysetRequestSchema = StudysetUUIDPayloadSchema;

export const BatchDeleteStudysetsRequestSchema = z.object({
    studysetUUIDs: z.array(UUIDSchema),
});

export const BatchDeleteStudysetsResponseSchema = BaseResponseSchema;

export const DuplicateStudysetRequestSchema = StudysetUUIDPayloadSchema;

export const BatchDuplicateStudysetsRequestSchema = z.object({
    studysetUUIDs: z.array(UUIDSchema),
});

export const BatchDuplicateStudysetsResponseSchema = BaseResponseSchema;

export const UpdatesSchema = z.record(z.string(), z.any());

export const UpdateStudysetRequestSchema = z.object({
    isMetadataUpdate: z.boolean().optional(),
    studysetUUID: UUIDSchema,
    updates: UpdatesSchema,
});

export const UpdateStudysetResponseSchema = BaseResponseSchema.extend({
    studyset: StudysetSchema,
});

export const PublishStudysetResponseSchema = UpdateStudysetResponseSchema;

export const BatchUpdateStudysetsRequestSchema = z.object({
    studysetUpdates: z.array(z.tuple([UUIDSchema, UpdatesSchema])),
});

// Notes
export const CreateNoteRequestSchema = StudysetUUIDPayloadSchema.extend({
    cardUUID: UUIDSchema,
});

export const CreateNoteResponseSchema = z.object({
    noteUUID: z.string(),
});

export const DeleteNoteRequestSchema = StudysetUUIDPayloadSchema.extend({
    cardUUID: UUIDSchema,
    noteUUID: UUIDSchema,
});

export const EditNoteRequestSchema = StudysetUUIDPayloadSchema.extend({
    cardUUID: UUIDSchema,
    noteUUID: UUIDSchema,
    text: z.string(),
});

// Labels
export const CreateLabelRequestSchema = z.object({
    label: z.string(),
    studysetUUID: UUIDSchema.optional(),
    updateStudysetLabel: z.boolean().optional(),
});

export const DeleteLabelRequestSchema = z.object({
    labelsToDelete: z.array(z.string()),
});

export const EditLabelRequestSchema = z.object({
    index: z.number(),
    oldLabel: z.string(),
    newLabel: z.string(),
});

export const ChangeLabelRequestSchema = z.object({
    newLabel: z.string(), // deprecated
    studysetUUID: UUIDSchema,
});

export const UpdateStudysetLabelsRequestSchema = z.object({
    labels: z.array(z.string()),
    studysetUUID: UUIDSchema,
});

export const BatchUpdateStudysetLabelsRequestSchema = z.object({
    studysetUpdates: z.array(z.tuple([UUIDSchema, z.array(z.string())])),
});

// Categories
export const EditCategoryRequestSchema = StudysetUUIDPayloadSchema.extend({
    index: z.number(),
    newCategory: z.string(),
    oldCategory: z.string(),
});

// Users
export const GetUserResponseSchema = z.object({
    user: UserSchema,
});

export const CreateUserRequestSchema = z.object({
    email: z.email(),
    username: z.string(),
});

export const UpdateUserMetadataRequestSchema = z.object({
    updates: UpdatesSchema,
});

export const UpdateDefaultThemeRequestSchema = z.object({
    newTheme: z.enum(['light', 'dark']),
    uuid: UUIDSchema,
});

export const UpdateEmailRequestSchema = z.object({
    username: z.string(),
    newEmail: z.email(),
});

export const DownloadUserDataRequestSchema = z.object({
    includeStudysets: z.boolean(),
});

export const UpdateGamificationRequestSchema = z.object({
    gamification: GamificationStateSchema,
    customAchievements: z.array(CustomAchievementSchema),
});

export const UpdateGamificationResponseSchema = z.object({
    message: z.string(),
    gamification: GamificationStateSchema,
    customAchievements: z.array(CustomAchievementSchema),
});

// Files
export const PartSchema = z.object({
    ETag: z.string(),
    PartNumber: z.number(),
});

export const FileMetadataSchema = z.object({
    key: z.string(),
    name: z.string(),
    signedURL: SignedURLSchema,
    size: z.number(),
});

export const InitiateMultipartUploadRequestSchema = z.object({
    contentType: z.string(),
    fileName: z.string(),
    studysetUUID: UUIDSchema.optional(),
});

export const InitiateMultipartUploadResponseSchema = z.object({
    key: z.string(),
    uploadId: z.string().optional(),
});

export const GetMultipartSignedUploadUrlsRequestSchema = z.object({
    key: z.string(),
    numParts: z.number(),
    uploadId: z.string(),
});

export const GetMultipartSignedUploadUrlsResponseSchema = z.object({
    signedURLs: z.record(z.string(), z.string()),
});

export const CompleteMultipartUploadRequestSchema = z.object({
    association: z.enum(['term', 'definition']).optional(),
    cardUUID: UUIDSchema.optional(),
    key: z.string(),
    parts: z.array(PartSchema),
    studysetUUID: UUIDSchema.optional(),
    uploadId: z.string(),
});

export const DeleteFileRequestSchema = z.object({
    key: z.string(),
});

export const SendFeedbackRequestSchema = z.object({
    key: z.string(),
});

export const UploadProfilePictureRequestSchema = z.object({
    imageData: z.string(),
    fileName: z.string(),
    contentType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
});

export const UploadProfilePictureResponseSchema = z.object({
    message: z.string(),
    url: z.string().url(),
});

// #endregion
