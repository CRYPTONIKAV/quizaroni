import type {
    Card,
    ConfirmDialogProps,
    NotificationPreferences,
    SortDirection,
    User,
} from 'shared/types';

export const LIGHT = 'light';
export const DARK = 'dark';

export const SUCCESS = 'success';
export const SUCCESS_U = 'Success';
export const ERROR = 'error';
export const ERROR_U = 'Error';

export const DISABLED = 'Disabled';
export const ENABLED = 'Enabled';

export const ROUTES = {
    LOGIN: '/login',
    SIGNUP: '/signup',
    CREATE: '/create',
};

export const QUERY_PARAMS = {
    PROFILE_TAB: 'tab',
} as const;

// Login.tsx stashes the path RequireAuth redirected from here before the
// full-page redirect to Logto's hosted sign-in (which loses React Router
// state); Callback.tsx reads it back once the OIDC exchange completes.
export const POST_SIGN_IN_REDIRECT_KEY = 'quizaroni.postSignInRedirect';

export const PAGE_TITLES = {
    CREATE: 'Create',
    EDIT: 'Edit',
    HOME: 'Home',
    LOGIN: 'Login',
    SIGN_UP: 'Sign Up',
    PROFILE: 'Profile',
};

export const DELETE_ACCOUNT_MSG = `We're sad to see you go, but if you're certain you want to delete your account, 
                                    please confirm your password below.`;
export const SIGNUP_SUCCESS_MSG = 'Account successfully created!';
export const SIGNUP_ERROR_MSG = 'Could not create an account';
export const LOGIN_SUCCESS_MSG = 'Successfully logged in!';
export const LOGIN_ERROR_MSG = 'Could not login, check email and password';
export const LOGOUT_SUCCESS_MSG = 'Successfully logged out!';
export const LOGOUT_ERROR_MSG = 'Error when logging out';

export const FLASHSET_COLUMNS = {
    TITLE: 'Title',
    DESCRIPTION: 'Description',
    CREATED: 'Created on',
    LABEL: 'Label',
};

export const EMPTY_CARD: Card = {
    categories: [],
    definition: '',
    files: [],
    important: false,
    notes: [],
    term: '',
    cardUUID: crypto.randomUUID(),
};

export const VIEW_SET = {
    BACKGROUND: 'BACKGROUND',
    TEXT: 'TEXT',
};

/* ==== Download ==== */
export const DOWNLOAD_FILE_TYPES = {
    TXT: 'TXT',
    JSON: 'JSON',
    CSV: 'CSV',
    MD: 'MD',
    ANKI: 'ANKI',
} as const;

export const DOWNLOAD_FILE_TITLES = {
    [DOWNLOAD_FILE_TYPES.TXT]: 'Text File',
    [DOWNLOAD_FILE_TYPES.JSON]: 'JavaScript Object Notation',
    [DOWNLOAD_FILE_TYPES.CSV]: 'Comma Separated Values',
    [DOWNLOAD_FILE_TYPES.MD]: 'Markdown File',
    [DOWNLOAD_FILE_TYPES.ANKI]: 'Anki Flashcard Format (CSV)',
};

export const MIME_TYPES: { [key: string]: string } = {
    [DOWNLOAD_FILE_TYPES.TXT]: 'text/plain',
    [DOWNLOAD_FILE_TYPES.JSON]: 'application/json',
    [DOWNLOAD_FILE_TYPES.CSV]: 'text/csv',
    [DOWNLOAD_FILE_TYPES.MD]: 'text/markdown',
    [DOWNLOAD_FILE_TYPES.ANKI]: 'text/csv',
};

export const DEFAULT_CSV_HEADERS = 'Term, Definition';
export const METADATA_CSV_HEADERS = 'Title, Description, Label, Downloaded on';

export const HOME_LAYOUTS = {
    TABLE: 'table',
    GRID: 'grid',
    HTML: 'html',
};

export const VIEWSET_LAYOUTS = {
    LIST: 'list',
    GRID: 'grid',
};

export const STUDY_MODES = {
    FLASHCARDS: 'flashcards',
    MULTIPLE_CHOICE: 'multiple-choice',
    MATCHING: 'matching',
    TYPE_WRITE: 'type-write',
    REVIEW: 'review',
} as const;

export const STUDY_MODE_CONFIG = {
    [STUDY_MODES.FLASHCARDS]: {
        id: 'flashcards',
        title: 'Flashcards',
        description: 'Classic flip cards - learn at your own pace',
        icon: 'ViewCarousel',
        color: '#FF6B6B',
        features: ['Self-paced', 'Audio support', 'Progress tracking'],
    },
    [STUDY_MODES.MULTIPLE_CHOICE]: {
        id: 'multiple-choice',
        title: 'Multiple Choice',
        description: 'Test knowledge with quiz-style questions',
        icon: 'Quiz',
        color: '#4ECDC4',
        features: ['Timed mode', 'Instant feedback', 'Score tracking'],
    },
    [STUDY_MODES.MATCHING]: {
        id: 'matching',
        title: 'Matching Game',
        description: 'Match terms with definitions',
        icon: 'Extension',
        color: '#FFD93D',
        features: ['Interactive', 'Time challenge', 'Visual feedback'],
    },
    [STUDY_MODES.TYPE_WRITE]: {
        id: 'type-write',
        title: 'Type & Write',
        description: 'Practice by typing answers',
        icon: 'Keyboard',
        color: '#95E1D3',
        features: ['Active recall', 'Hint system', 'Smart matching'],
    },
    [STUDY_MODES.REVIEW]: {
        id: 'review',
        title: 'Review Due',
        description: 'Study only the cards due today',
        icon: 'Schedule',
        color: '#A78BFA',
        features: [
            'Spaced repetition',
            'Due cards only',
            'Optimized retention',
        ],
    },
};

export const SCORING = {
    CORRECT_ANSWER: 100,
    TIME_BONUS_MAX: 50,
    STREAK_MULTIPLIER: 1.5,
    HINT_PENALTY: -20,
    SKIP_PENALTY: -10,
};

export const PRESET_ACHIEVEMENTS = {
    FIRST_STUDY: {
        id: 'first-study',
        metric: 'total_sessions' as const,
        threshold: 1,
        icon: '🎯',
        i18nKey: 'firstStudy',
    },
    PERFECT_SCORE: {
        id: 'perfect-score',
        metric: 'perfect_session' as const,
        threshold: 1,
        icon: '🌟',
        i18nKey: 'perfectScore',
    },
    STREAK_3: {
        id: 'streak-3',
        metric: 'daily_streak' as const,
        threshold: 3,
        icon: '🔥',
        i18nKey: 'streak3',
    },
    STREAK_7: {
        id: 'streak-7',
        metric: 'daily_streak' as const,
        threshold: 7,
        icon: '🔥',
        i18nKey: 'streak7',
    },
    STREAK_30: {
        id: 'streak-30',
        metric: 'daily_streak' as const,
        threshold: 30,
        icon: '💎',
        i18nKey: 'streak30',
    },
    SESSION_STREAK_10: {
        id: 'session-streak-10',
        metric: 'session_streak' as const,
        threshold: 10,
        icon: '⚡',
        i18nKey: 'sessionStreak10',
    },
    SESSIONS_10: {
        id: 'sessions-10',
        metric: 'total_sessions' as const,
        threshold: 10,
        icon: '📚',
        i18nKey: 'sessions10',
    },
    SESSIONS_50: {
        id: 'sessions-50',
        metric: 'total_sessions' as const,
        threshold: 50,
        icon: '🏃',
        i18nKey: 'sessions50',
    },
    CARDS_100: {
        id: 'cards-100',
        metric: 'total_cards' as const,
        threshold: 100,
        icon: '🎓',
        i18nKey: 'cards100',
    },
    CARDS_500: {
        id: 'cards-500',
        metric: 'total_cards' as const,
        threshold: 500,
        icon: '🏆',
        i18nKey: 'cards500',
    },
} as const;

/** @deprecated Use PRESET_ACHIEVEMENTS */
export const ACHIEVEMENTS = PRESET_ACHIEVEMENTS;

export const GAMIFICATION_STORAGE_KEY = 'gamification-storage';
export const GAMIFICATION_DB_ID = 'default';

export const SM2_INTERVALS = {
    AGAIN: 0,
    HARD: 1,
    GOOD: 3,
    EASY: 7,
};

// Define regex patterns for each requirement
export const PWD_REGEX = {
    uppercase: /(?=.*[A-Z])/,
    special: /(?=.*[!@#$%^&*])/,
    lowercase: /(?=.*[a-z])/,
    number: /(?=.*[0-9])/,
    length: /^.{8,}$/,
};

// https://bobbyhadz.com/blog/react-check-if-email-is-valid
export const EMAIL_REGEX = /\S+@\S+\.\S+/;

export const INITIAL_CONFIRM_DIALOG_PROPS: ConfirmDialogProps = {
    open: false,
    title: '',
    type: '',
    dialogMessage: '',
};

export const STUDYSET_CONFIRM_DIALOGS = {
    DELETE: 'DELETE',
    DUPLICATE: 'DUPLICATE',
    DELETE_MULTIPLE: 'DELETE_MULTIPLE',
    DUPLICATE_MULTIPLE: 'DUPLICATE_MULTIPLE',
};

export const STUDYSET_CONFIRM_DIALOG_PROPS = new Map([
    [
        STUDYSET_CONFIRM_DIALOGS.DELETE,
        {
            title: `Delete the study set`,
            dialogMessage: `Are you sure you want to delete this set?`,
        },
    ],
    [
        STUDYSET_CONFIRM_DIALOGS.DUPLICATE,
        {
            title: `Duplicate the study set`,
            dialogMessage: `Are you sure you want to duplicate this set?`,
        },
    ],
    [
        STUDYSET_CONFIRM_DIALOGS.DELETE_MULTIPLE,
        {
            title: `Delete multiple study sets?`,
            dialogMessage: `The following sets will be deleted:`,
        },
    ],
    [
        STUDYSET_CONFIRM_DIALOGS.DUPLICATE_MULTIPLE,
        {
            title: `Duplicate multiple study sets?`,
            dialogMessage: `The following sets will be duplicated:`,
        },
    ],
]);

export const SET_METADATA_FIELDS = {
    TEXT: 'textColorVisible',
    BACKGROUND: 'backgroundColorVisible',
    PUBLIC: 'publiclyViewable',
    CONTENT_ONLY: 'contentOnly',
};

export const DEFAULT_CATEGORIES = {
    ALL: 'All',
    IMPORTANT: 'Important',
};

export const SORT_DIRECTIONS = {
    ASC: 'asc',
    DSC: 'dsc',
} as const;

export const DEFAULT_TERMINOLOGY = 'Term/Definition';

export const FORMAT_TERMINOLOGIES = {
    TERM_DEFINITION: 'Term/Definition',
    QUESTION_ANSWER: 'Question/Answer',
    PROMPT_RESPONSE: 'Prompt/Response',
    WORD_MEANING: 'Word/Meaning',
    FACT_EXPLANATION: 'Fact/Explanation',
    CUSTOM: 'Custom',
};

export const LABEL_TERMINOLOGIES = {
    CARD: 'Card',
    ITEM: 'Item',
    FLASHCARD: 'Flashcard',
    ENTRY: 'Entry',
    CONCEPT: 'Concept',
    IDEA: 'Idea',
    NOTE: 'Note',
    CUSTOM: 'Custom',
};

export const VIEW_SET_DIALOGS = {
    NOTIFICATIONS: 'NOTIFICATIONS',
    DOWNLOAD: 'DOWNLOAD',
    CATEGORIES: 'CATEGORIES',
    SETTINGS: 'SETTINGS',
    PRINT: 'PRINT',
    SHARE: 'SHARE',
} as const;

export type ViewSetDialog =
    (typeof VIEW_SET_DIALOGS)[keyof typeof VIEW_SET_DIALOGS];

export const NOTES_DRAWER_POSITIONS = {
    LEFT: 'left',
    RIGHT: 'right',
};

export const NOTES_DRAWER_POSITIONS_OPTIONS = [
    {
        value: NOTES_DRAWER_POSITIONS.LEFT,
        ariaLabel: 'left anchored',
        label: 'Left',
    },
    {
        value: NOTES_DRAWER_POSITIONS.RIGHT,
        ariaLabel: 'right anchored',
        label: 'Right',
    },
];

export const EMPTY_NOTE_PLACEHOLDER = 'Enter text for the note';

export const NOTES_DRAWER_INITIAL_APPEARANCE = {
    OPEN: 'open',
    CLOSED: 'closed',
};

export const NOTES_DRAWER_INITIAL_APPEARANCE_OPTIONS = [
    {
        value: NOTES_DRAWER_INITIAL_APPEARANCE.OPEN,
        ariaLabel: 'initially open',
        label: 'Open',
    },
    {
        value: NOTES_DRAWER_INITIAL_APPEARANCE.CLOSED,
        ariaLabel: 'initially closed',
        label: 'Closed',
    },
];

export const AI_PANEL_POSITIONS = {
    LEFT: 'left',
    RIGHT: 'right',
} as const;

export const MAX_AI_CONTEXT_CARDS = 50;

export const CARD_COUNT_VISIBILITY = {
    HIDDEN: false,
    VISIBLE: true,
};

export const CARD_COUNT_VISIBILITY_OPTIONS = [
    {
        value: CARD_COUNT_VISIBILITY.HIDDEN,
        ariaLabel: 'hidden',
        label: 'Hidden',
    },
    {
        value: CARD_COUNT_VISIBILITY.VISIBLE,
        ariaLabel: 'visible',
        label: 'Visible',
    },
];

export const CARD_INDEX_VISIBILITY = {
    HIDDEN: false,
    VISIBLE: true,
};

export const CARD_INDEX_VISIBILITY_OPTIONS = [
    {
        value: CARD_INDEX_VISIBILITY.HIDDEN,
        ariaLabel: 'hidden',
        label: 'Hidden',
    },
    {
        value: CARD_INDEX_VISIBILITY.VISIBLE,
        ariaLabel: 'visible',
        label: 'Visible',
    },
];

export const DATE_FORMATS = {
    ISO_8601: 'YYYY-MM-DD',
    DMY: 'DD/MM/YYYY',
    MDY: 'MM/DD/YYYY',
} as const;

export const TIME_FORMATS = {
    TWELVE_HOUR: '12h',
    TWENTY_FOUR_HOUR: '24h',
} as const;

export const DEFAULT_USER_DATA: User = {
    createdAt: new Date().toISOString(),
    email: '',
    labels: [],
    metadata: {
        defaultTheme: 'dark',
        fontSizeScale: 1,
        homeView: 'table',
        namedColors: [],
        preferredDateFormat: DATE_FORMATS.MDY,
        preferredTimeFormat: TIME_FORMATS.TWELVE_HOUR,
        showSeconds: false,
        confirmDestructiveActions: true,
        defaultDownloadFormat: DOWNLOAD_FILE_TYPES.JSON,
        ttsVoice: '',
    },
    username: '',
    userUUID: '',
};

export const DEFAULT_USER_RESPONSE: { user: User } = {
    user: DEFAULT_USER_DATA,
};

export const HTML_TABLE_HEADERS = [
    'Title',
    'Description',
    'Created',
    'Last Viewed',
    '# of Cards',
    'Label',
    'Favorited',
];

export const LOADING_ACTIONS = {
    CREATE_STUDYSET: 'CREATE_STUDYSET',
} as const;

export type LoadingAction =
    (typeof LOADING_ACTIONS)[keyof typeof LOADING_ACTIONS];

export const PRINT_LAYOUTS = {
    FLASHCARD: 'flashcard',
    LIST: 'list',
    GRID: 'grid',
} as const;

export const PRINT_LAYOUT_OPTIONS = [
    {
        value: PRINT_LAYOUTS.FLASHCARD,
        ariaLabel: 'flashcard layout',
        label: 'Flashcard',
    },
    {
        value: PRINT_LAYOUTS.LIST,
        ariaLabel: 'list layout',
        label: 'List',
    },
    {
        value: PRINT_LAYOUTS.GRID,
        ariaLabel: 'grid layout',
        label: 'Grid',
    },
];

export const PRINT_INCLUDE_NOTES_OPTIONS = [
    { value: false, ariaLabel: 'exclude notes', label: 'Exclude' },
    { value: true, ariaLabel: 'include notes', label: 'Include' },
];

export const PRINT_INCLUDE_FILES_OPTIONS = [
    { value: false, ariaLabel: 'exclude files', label: 'Exclude' },
    { value: true, ariaLabel: 'include files', label: 'Include' },
];

export const PRINT_INCLUDE_CATEGORIES_OPTIONS = [
    { value: false, ariaLabel: 'exclude categories', label: 'Exclude' },
    { value: true, ariaLabel: 'include categories', label: 'Include' },
];

export const PRINT_SHOW_COLORS_OPTIONS = [
    { value: false, ariaLabel: 'hide colors', label: 'Hide' },
    { value: true, ariaLabel: 'show colors', label: 'Show' },
];

export const PRINT_IMPORTANT_ONLY_OPTIONS = [
    { value: false, ariaLabel: 'all cards', label: 'All Cards' },
    { value: true, ariaLabel: 'important only', label: 'Important Only' },
];

// Font Size Scaling (for slider presets)
export const FONT_SIZE_PRESETS = {
    SMALL: 0.875,
    MEDIUM: 1,
    LARGE: 1.125,
    EXTRA_LARGE: 1.25,
} as const;

export type FontSizeScale =
    (typeof FONT_SIZE_PRESETS)[keyof typeof FONT_SIZE_PRESETS];

// Notification Constants
export const NOTIFICATION_MODES = {
    CALM: 'calm',
    REGULAR: 'regular',
    POWER_USER: 'power-user',
    CUSTOM: 'custom',
} as const;

export const NOTIFICATION_MODE_CONFIG = {
    [NOTIFICATION_MODES.CALM]: {
        email: {
            enabled: true,
            studyReminders: false,
            streakAlerts: false,
            weeklyDigest: true,
            inactivityNudges: false,
        },
    },
    [NOTIFICATION_MODES.REGULAR]: {
        email: {
            enabled: true,
            studyReminders: true,
            streakAlerts: true,
            weeklyDigest: true,
            inactivityNudges: false,
        },
    },
    [NOTIFICATION_MODES.POWER_USER]: {
        email: {
            enabled: true,
            studyReminders: true,
            streakAlerts: true,
            weeklyDigest: true,
            inactivityNudges: true,
        },
    },
} as const;

export const SNOOZE_OPTIONS = [
    { value: 1, label: '1 hour' },
    { value: 4, label: '4 hours' },
    { value: 24, label: '24 hours' },
    { value: 168, label: '1 week' },
] as const;

export const DAYS_OF_WEEK = [
    { value: 0, label: 'Sunday', short: 'Sun' },
    { value: 1, label: 'Monday', short: 'Mon' },
    { value: 2, label: 'Tuesday', short: 'Tue' },
    { value: 3, label: 'Wednesday', short: 'Wed' },
    { value: 4, label: 'Thursday', short: 'Thu' },
    { value: 5, label: 'Friday', short: 'Fri' },
    { value: 6, label: 'Saturday', short: 'Sat' },
] as const;

// Annotated rather than `as const`: the readonly arrays and literal types an
// `as const` produces are not assignable to the mutable NotificationPreferences.
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
    enabled: false,
    mode: NOTIFICATION_MODES.REGULAR,
    email: {
        enabled: true,
        studyReminders: true,
        streakAlerts: true,
        weeklyDigest: true,
        inactivityNudges: false,
        digestDay: 0, // Sunday
    },
    quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    studysetPrefs: [],
};
