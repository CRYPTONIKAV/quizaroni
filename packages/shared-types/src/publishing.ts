export type PublishError =
    | { code: 'invalidSubject' }
    | { code: 'notEnoughCards'; required: number; actual: number }
    | { code: 'hidden' };

export type PublishErrorCode = PublishError['code'];
