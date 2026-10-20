// A set DRY_RUN counts unless it is 0/false, so a typo or an empty value can't
// turn a report into real writes.
export const isDryRun = (value: string | undefined): boolean =>
    value !== undefined && !['0', 'false'].includes(value.toLowerCase());
