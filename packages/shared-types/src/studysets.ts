import type { Timestamp, UUID } from './primitives';
import type { CardFileMetadata } from './files';
import type { SubjectId } from './subjects';

export type ViewSetLayout = 'list' | 'grid';

export type Note = {
    text: string;
    noteUUID: UUID;
    createdAt?: Timestamp;
};

export type Card = {
    backgroundColor?: string;
    categories: string[];
    definition: string;
    files: CardFileMetadata[];
    important: boolean;
    notes: Note[];
    term: string;
    textColor?: string;
    cardUUID: UUID;
};

export type PrintConfig = {
    layout: 'flashcard' | 'list' | 'grid';
    includeNotes: boolean;
    includeFiles: boolean;
    includeCategories: boolean;
    showColors: boolean;
    importantOnly: boolean;
};

export type StudysetMetadata = {
    backgroundColorVisible: boolean;
    contentOnly?: boolean;
    cardCountVisible?: boolean;
    cardIndexVisible?: boolean;
    customLabelTerminology: string;
    customTerminology: string;
    labelTerminology: string;
    notesDrawerInitial: string;
    notesDrawerPosition: 'left' | 'right';
    notesSortBy?: 'alphabetical' | 'date' | 'cardOrder';
    notesSortDirection?: 'asc' | 'desc';
    printConfig?: PrintConfig;
    publiclyViewable: boolean;
    terminology: string;
    textColorVisible: boolean;
    viewSetLayout?: ViewSetLayout;
};

/**
 * Fields common to both the API's persisted DynamoDB record and the web
 * client's in-memory shape. Each app composes its own `Studyset` on top:
 * the API adds PK/SK/updatedAt, the web client adds `uuid`.
 */
export type StudysetBase = {
    cards: Card[];
    categories: string[];
    createdAt: Timestamp;
    description: string;
    favorited?: boolean;
    labels: string[];
    lastViewed: Timestamp;
    metadata: StudysetMetadata;
    publishedAt?: Timestamp;
    studysetUUID: UUID;
    subject?: SubjectId;
    title: string;
    userUUID: UUID;
    username: string;
};
