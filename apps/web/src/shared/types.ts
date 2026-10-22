import { DATE_FORMATS, DOWNLOAD_FILE_TYPES, TIME_FORMATS } from './constants/';
import { LabelsDialogTab } from 'components/ManageLabelsDialog/constants';
import type {
    Card,
    StudysetBase,
    Timestamp,
    UUID,
} from '@quizaroni/shared-types';

// #region Utility Types
export type TODO = any;
export type { UUID, Timestamp } from '@quizaroni/shared-types';
// #endregion

// #region Theme
export type ThemeName = 'light' | 'dark';
// #endregion

// #region Studysets
export type {
    Card,
    CardFileMetadata,
    Note,
    PrintConfig,
    StudysetMetadata,
} from '@quizaroni/shared-types';

/** The client-side shape. The API's persisted record differs: it carries a
 * PK/SK key pair and `updatedAt` instead of `uuid`. */
export type Studyset = StudysetBase & {
    uuid: UUID;
};

// #endregion

// #region User
export type User = {
    createdAt: Timestamp;
    email: string;
    labels: string[];
    metadata: {
        avatar?: AvatarMetadata;
        confirmDestructiveActions?: boolean;
        defaultDownloadFormat: DownloadSetFormat;
        defaultTheme: AppTheme;
        density?: 'compact' | 'standard' | 'comfortable';
        fontSizeScale?: number;
        homeView: HomeView;
        namedColors: NamedColor[];
        notifications?: NotificationPreferences;
        gamification?: GamificationState;
        customAchievements?: CustomAchievement[];
        preferredDateFormat: PreferredDateFormat;
        preferredTimeFormat?: PreferredTimeFormat;
        showSeconds?: boolean;
        ttsVoice?: string;
        hapticsEnabled?: boolean;
        aiProvider?: 'openai' | 'anthropic' | 'google';
        aiModel?: string;
        visibleColumns?: Record<string, boolean>;
    };
    username: string;
    userUUID: UUID;
};

export type AppTheme = 'light' | 'dark';
export type HomeView = 'table' | 'grid' | 'html';
export type { ViewSetLayout } from '@quizaroni/shared-types';
export type NamedColor = { color: string; name: string };

export type PreferredDateFormat =
    (typeof DATE_FORMATS)[keyof typeof DATE_FORMATS];

export type PreferredTimeFormat =
    (typeof TIME_FORMATS)[keyof typeof TIME_FORMATS];

export type DownloadSetFormat =
    (typeof DOWNLOAD_FILE_TYPES)[keyof typeof DOWNLOAD_FILE_TYPES];

export type AvatarMetadata = {
    type: 'dicebear' | 'upload';
    value: string;
};

// #region Notification Types
export type NotificationMode = 'calm' | 'regular' | 'power-user' | 'custom';

export type EmailNotificationSettings = {
    enabled: boolean;
    studyReminders: boolean;
    streakAlerts: boolean;
    weeklyDigest: boolean;
    inactivityNudges: boolean;
    digestDay?: number; // 0-6 (Sunday-Saturday)
};

export type QuietHoursSettings = {
    enabled: boolean;
    start: string; // HH:mm
    end: string; // HH:mm
    timezone: string;
};

export type StudysetNotificationPrefs = {
    studysetUUID: UUID;
    enabled: boolean;
    reminderTime?: string; // HH:mm
    reminderDays?: number[]; // 0-6 (Sunday-Saturday)
};

export type NotificationPreferences = {
    enabled: boolean;
    mode: NotificationMode;
    email: EmailNotificationSettings;
    quietHours: QuietHoursSettings;
    snoozeUntil?: Timestamp;
    studysetPrefs: StudysetNotificationPrefs[];
};
// #endregion

// Study Mode Types
export type StudyMode =
    | 'flashcards'
    | 'multiple-choice'
    | 'matching'
    | 'type-write'
    | 'review';

export type StudySessionState = {
    studysetUUID: UUID;
    mode: StudyMode;
    currentCardIndex: number;
    cards: Card[];
    answers: StudyAnswer[];
    startTime: Timestamp;
    endTime?: Timestamp;
    score: number;
    streak: number;
    maxStreak: number;
    settings: StudySessionSettings;
};

export type StudyAnswer = {
    cardUUID: UUID;
    correct: boolean;
    timeSpent: number;
    hintsUsed: number;
    answer?: string;
    selectedOption?: number;
};

export type StudySessionSettings = {
    shuffleCards: boolean;
    timedMode: boolean;
    timePerCard?: number;
    audioEnabled: boolean;
    autoAdvance: boolean;
    difficulty: 'easy' | 'medium' | 'hard';
    hideImages: boolean;
};

export type StudySessionResult = {
    sessionUUID: UUID;
    studysetUUID: UUID;
    mode: StudyMode;
    totalCards: number;
    correctAnswers: number;
    score: number;
    timeSpent: number;
    accuracy: number;
    streak: number;
    completedAt: Timestamp;
    achievements: string[];
};

export type SrsState = 'New' | 'Learning' | 'Review' | 'Relearning';

export type CardProgress = {
    cardUUID: UUID;
    lastStudied: Timestamp;
    nextReview: Timestamp;
    // FSRS memory state (ts-fsrs Card); see shared/utilities/srs.ts
    stability: number;
    difficulty: number;
    state: SrsState;
    reps: number;
    lapses: number;
    scheduledDays: number;
    learningSteps: number;
    masteryLevel: 'new' | 'learning' | 'review' | 'mastered';
};

export type Achievement = {
    id: string;
    unlockedAt: Timestamp;
    title: string;
    description: string;
    icon: string;
    isCustom?: boolean;
};

export type AchievementMetric =
    | 'daily_streak'
    | 'total_sessions'
    | 'total_cards'
    | 'session_streak'
    | 'perfect_session'
    | 'studyset_sessions';

export type PresetAchievementDef = {
    id: string;
    metric: AchievementMetric;
    threshold: number;
    icon: string;
    i18nKey: string;
};

export type CustomAchievement = {
    id: string;
    title: string;
    description: string;
    icon: string;
    metric: AchievementMetric;
    threshold: number;
    studysetUUID?: UUID;
    createdAt: Timestamp;
    unlockedAt?: Timestamp;
};

export type GamificationState = {
    currentStreak: number;
    longestStreak: number;
    lastStudyDate: string | null;
    unlockedAchievementIds: string[];
    unlockedAtById: Record<string, Timestamp>;
    studiedStudysetUUIDs: UUID[];
    studysetSessionCounts: Record<UUID, number>;
};

export type StudyStatistics = {
    totalSessions: number;
    totalCardsStudied: number;
    averageAccuracy: number;
    totalTimeSpent: number;
    achievements: Achievement[];
    progressByStudyset: Map<UUID, StudysetProgress>;
};

export type StudysetProgress = {
    studysetUUID: UUID;
    cardsProgress: CardProgress[];
    lastSessionDate: Timestamp;
    sessionsCount: number;
    masteredCards: number;
};

// #endregion

/* RTK Query Types */

export type BaseResponse = {
    message: string;
};

export type StudysetUUIDPayload = {
    studysetUUID: UUID;
};

export type GetAllStudysetsRequest = {};

export type GetAllStudysetsResponse = {
    studysets: Studyset[];
};

export type GetStudysetResponse = {
    studyset: Studyset;
};

export type GetStudysetRequest = StudysetUUIDPayload;

export type CreateStudysetResponse = {
    studyset: Studyset;
};

export type DeleteStudysetRequest = StudysetUUIDPayload;

export type BatchDeleteStudysetsRequest = {
    studysetUUIDs: UUID[];
};

export type BatchDeleteStudysetsResponse = BaseResponse;

export type DuplicateStudysetRequest = StudysetUUIDPayload;

export type BatchDuplicateStudysetsRequest = {
    studysetUUIDs: UUID[];
};

export type BatchDuplicateStudysetsResponse = BaseResponse;

export type Updates = Record<string, any>;

export type UpdateStudysetRequest = {
    studysetUUID: string;
    updates: Updates;
    isMetadataUpdate?: boolean;
};

export type UpdateStudysetResponse = BaseResponse & {
    studyset: Studyset;
};

type StudysetUpdatesMap = [UUID, Updates][];
export type BatchUpdateStudysetsRequest = {
    studysetUpdates: StudysetUpdatesMap;
};

export type FavoriteStudysetRequest = StudysetUUIDPayload & {
    favorited: boolean;
};

// Users API
export type GetUserRequest = {};
export type GetUserResponse = {
    user: User;
};

export type CreateUserRequest = {
    email: string;
    username: string;
};

export type UpdateUserMetadataRequest = {
    updates: Updates;
};

export type UpdateNotificationPreferencesRequest = {
    updates: Partial<NotificationPreferences>;
};

export type UpdateGamificationRequest = {
    gamification: GamificationState;
    customAchievements: CustomAchievement[];
};

export type UpdateGamificationResponse = {
    message: string;
    gamification: GamificationState;
    customAchievements: CustomAchievement[];
};

export type UpdateDefaultThemeRequest = {
    uuid: UUID;
    newTheme: 'light' | 'dark';
};

export type UpdateEmailRequest = {
    username: string;
    newEmail: string;
};

export type DownloadUserDataRequest = {
    includeStudysets: boolean;
};

export type EditCategoryRequest = StudysetUUIDPayload & {
    index: number;
    newCategory: string;
    oldCategory: string;
};

export type CreateNoteResponse = {
    noteUUID: string;
};

export type CreateNoteRequest = StudysetUUIDPayload & {
    cardUUID: UUID;
};

export type DeleteNoteRequest = StudysetUUIDPayload & {
    cardUUID: UUID;
    noteUUID: UUID;
};

export type EditNoteRequest = StudysetUUIDPayload & {
    cardUUID: UUID;
    noteUUID: UUID;
    text: string;
};

export type CreateLabelRequest = {
    label: string;
    studysetUUID?: UUID;
    updateStudysetLabel?: boolean;
};

export type DeleteLabelRequest = {
    labelsToDelete: string[];
};

export type EditLabelRequest = {
    index: number;
    oldLabel: string;
    newLabel: string;
};

export type ChangeLabelRequest = {
    studysetUUID: UUID;
    newLabel: string; // deprecated - use UpdateStudysetLabelsRequest
};

export type UpdateStudysetLabelsRequest = {
    studysetUUID: UUID;
    labels: string[];
};

export type BatchUpdateStudysetLabelsRequest = {
    studysetUpdates: [UUID, string[]][]; // [studysetUUID, labels[]]
};

export type { FileMetadata } from '@quizaroni/shared-types';

export type Part = {
    ETag: string;
    PartNumber: number;
};

// #region File Upload
export type InitiateMultipartUploadRequest = {
    contentType: string;
    fileName: string;
    studysetUUID?: UUID;
};

export type InitiateMultipartUploadResponse = {
    key: string;
    uploadId: string | undefined;
};

export type GetMultipartSignedUploadUrlsRequest = {
    key: string;
    numParts: number;
    uploadId: string;
};

export type GetMultipartSignedUploadUrlsResponse = {
    signedURLs: Record<number, string>;
};

export type CompleteMultipartUploadRequest = {
    association?: 'term' | 'definition';
    cardUUID?: string;
    key: string;
    parts: Part[];
    studysetUUID?: UUID;
    uploadId: string;
};

export type DeleteFileRequest = {
    key: string;
};

export type SendFeedbackRequest = {
    key: string;
};

export type UploadProfilePictureRequest = {
    imageData: string;
    fileName: string;
    contentType: string;
};

export type UploadProfilePictureResponse = {
    message: string;
    url: string;
};
// #endregion

// #region Redux

export type SortDirection = 'asc' | 'dsc';

export type ConfirmDialogProps = {
    cancelButtonText?: string;
    confirmButtonText?: string;
    dialogMessage?: string;
    open: boolean;
    title: string;
    type: string;
    props?: any;
};

export type LabelsDialogProps = {
    open: boolean;
    studysetUUID?: string;
    selectedStudysetUUIDs?: string[];
    tab?: LabelsDialogTab;
};

// export type ViewSetDialog =

export type OpenCardNotes = Set<UUID>;

export type ColorPickerType = 'textColor' | 'backgroundColor';

// #endregion
