import {
    DeleteCommand,
    DynamoDBDocumentClient,
    ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import {
    cleanupEmptyStudysets,
    isEmptyStudysetStub,
    readCleanupConfig,
} from '../../scripts/cleanupEmptyStudysets';

const NOW = '2026-10-01T12:00:00.000Z';

const stub = {
    PK: 'userUUID#u1',
    SK: 'studyset#x',
    lastViewed: NOW,
    updatedAt: NOW,
    updatedBy: 'u1',
};
const labeledItem = {
    PK: 'userUUID#u1',
    SK: 'studyset#z',
    labels: [],
    updatedAt: NOW,
    updatedBy: 'u1',
};
const realSet = {
    PK: 'userUUID#u1',
    SK: 'studyset#y',
    cards: [],
    createdAt: NOW,
};

type Page = { Items: Record<string, unknown>[]; LastEvaluatedKey?: Record<string, unknown> };

const makeClient = (
    pages: Page[],
    onDelete: (cmd: DeleteCommand) => Promise<unknown> = () => Promise.resolve({})
) => {
    let page = 0;
    const send = jest.fn((cmd: unknown) => {
        if (cmd instanceof ScanCommand) {
            return Promise.resolve(pages[page++] ?? { Items: [] });
        }
        if (cmd instanceof DeleteCommand) {
            return onDelete(cmd);
        }
        return Promise.reject(new Error('unexpected command'));
    });
    return { send, docClient: { send } as unknown as DynamoDBDocumentClient };
};

const sentOf = <T>(send: jest.Mock, type: new (...args: never[]) => T): T[] =>
    send.mock.calls.map(([cmd]) => cmd).filter((cmd): cmd is T => cmd instanceof type);

describe('isEmptyStudysetStub', () => {
    it('matches a lastViewed stub', () => {
        expect(isEmptyStudysetStub(stub)).toBe(true);
    });

    it('rejects items with cards', () => {
        expect(isEmptyStudysetStub({ ...stub, cards: [] })).toBe(false);
    });

    it('rejects items with createdAt', () => {
        expect(isEmptyStudysetStub({ ...stub, createdAt: NOW })).toBe(false);
    });

    it('rejects items with a studysetUUID or title', () => {
        expect(isEmptyStudysetStub({ ...stub, studysetUUID: 'x' })).toBe(false);
        expect(isEmptyStudysetStub({ ...stub, title: 'Biology' })).toBe(false);
    });

    it('rejects non-studyset items', () => {
        expect(isEmptyStudysetStub({ PK: 'userUUID#u1', SK: 'userData' })).toBe(false);
    });

    it('rejects labeled items unless includeLabeled is set', () => {
        expect(isEmptyStudysetStub(labeledItem)).toBe(false);
        expect(isEmptyStudysetStub(labeledItem, { includeLabeled: true })).toBe(true);
    });
});

describe('cleanupEmptyStudysets', () => {
    const log = jest.fn();

    beforeEach(() => {
        log.mockReset();
    });

    it('with dryRun deletes nothing and reports the stubs', async () => {
        const { send, docClient } = makeClient([{ Items: [stub] }]);

        const result = await cleanupEmptyStudysets({
            docClient,
            tableName: 't',
            dryRun: true,
            log,
        });

        expect(result).toEqual({ matched: 1, deleted: 0, skipped: 0, labeledKept: 0 });
        expect(sentOf(send, DeleteCommand)).toHaveLength(0);
        expect(log).toHaveBeenCalledWith(expect.stringContaining('[dry-run]'));
        expect(log).toHaveBeenCalledWith(expect.stringContaining(stub.SK));
    });

    it('deletes stubs with an existence guard when not a dry run', async () => {
        const { send, docClient } = makeClient([{ Items: [stub] }]);

        const result = await cleanupEmptyStudysets({
            docClient,
            tableName: 't',
            dryRun: false,
            log,
        });

        const deletes = sentOf(send, DeleteCommand);
        expect(deletes).toHaveLength(1);
        const input = deletes[0]!.input;
        expect(input.TableName).toBe('t');
        expect(input.Key).toEqual({ PK: stub.PK, SK: stub.SK });
        expect(input.ConditionExpression).toContain('attribute_not_exists(#cards)');
        expect(input.ConditionExpression).toContain('attribute_not_exists(#createdAt)');
        expect(input.ConditionExpression).toContain('attribute_not_exists(#studysetUUID)');
        expect(input.ConditionExpression).toContain('attribute_not_exists(#title)');
        expect(input.ConditionExpression).toContain('attribute_not_exists(#labels)');
        expect(input.ExpressionAttributeNames).toEqual({
            '#cards': 'cards',
            '#createdAt': 'createdAt',
            '#studysetUUID': 'studysetUUID',
            '#title': 'title',
            '#labels': 'labels',
        });
        expect(result.deleted).toBe(1);
    });

    it('ignores real sets the scan returns', async () => {
        const { send, docClient } = makeClient([{ Items: [realSet] }]);

        const result = await cleanupEmptyStudysets({
            docClient,
            tableName: 't',
            dryRun: false,
            log,
        });

        expect(result).toEqual({ matched: 0, deleted: 0, skipped: 0, labeledKept: 0 });
        expect(sentOf(send, DeleteCommand)).toHaveLength(0);
    });

    it('follows LastEvaluatedKey across scan pages', async () => {
        const lastKey = { PK: 'a', SK: 'b' };
        const { send, docClient } = makeClient([
            { Items: [], LastEvaluatedKey: lastKey },
            { Items: [] },
        ]);

        await cleanupEmptyStudysets({ docClient, tableName: 't', dryRun: true, log });

        const scans = sentOf(send, ScanCommand);
        expect(scans).toHaveLength(2);
        expect(scans[0]!.input.TableName).toBe('t');
        expect(scans[1]!.input.ExclusiveStartKey).toEqual(lastKey);
    });

    it('counts a ConditionalCheckFailedException as skipped', async () => {
        const { docClient } = makeClient([{ Items: [stub] }], () =>
            Promise.reject(
                Object.assign(new Error('x'), { name: 'ConditionalCheckFailedException' })
            )
        );

        const result = await cleanupEmptyStudysets({
            docClient,
            tableName: 't',
            dryRun: false,
            log,
        });

        expect(result).toMatchObject({ skipped: 1, deleted: 0 });
    });

    it('rethrows other delete errors', async () => {
        const { docClient } = makeClient([{ Items: [stub] }], () =>
            Promise.reject(new Error('throttled'))
        );

        await expect(
            cleanupEmptyStudysets({ docClient, tableName: 't', dryRun: false, log })
        ).rejects.toThrow('throttled');
    });

    it('reports labeled items separately and keeps them by default', async () => {
        const { send, docClient } = makeClient([{ Items: [stub, labeledItem] }]);

        const result = await cleanupEmptyStudysets({
            docClient,
            tableName: 't',
            dryRun: false,
            log,
        });

        const deletes = sentOf(send, DeleteCommand);
        expect(deletes).toHaveLength(1);
        expect(deletes[0]!.input.Key).toEqual({ PK: stub.PK, SK: stub.SK });
        expect(result).toEqual({ matched: 1, deleted: 1, skipped: 0, labeledKept: 1 });
        expect(log).toHaveBeenCalledWith(
            expect.stringMatching(new RegExp(`${labeledItem.SK}.*possible #124`))
        );
    });

    it('deletes labeled items only with includeLabeled', async () => {
        const { send, docClient } = makeClient([{ Items: [stub, labeledItem] }]);

        const result = await cleanupEmptyStudysets({
            docClient,
            tableName: 't',
            dryRun: false,
            includeLabeled: true,
            log,
        });

        const deletes = sentOf(send, DeleteCommand);
        expect(deletes).toHaveLength(2);
        for (const cmd of deletes) {
            expect(cmd.input.ConditionExpression).not.toContain('#labels');
            expect(cmd.input.ExpressionAttributeNames).toEqual({
                '#cards': 'cards',
                '#createdAt': 'createdAt',
                '#studysetUUID': 'studysetUUID',
                '#title': 'title',
            });
        }
        expect(result).toEqual({ matched: 2, deleted: 2, skipped: 0, labeledKept: 0 });
    });

    it('DRY_RUN=1 from the environment deletes nothing', async () => {
        const { send, docClient } = makeClient([{ Items: [stub, labeledItem] }]);

        const result = await cleanupEmptyStudysets({
            docClient,
            log,
            ...readCleanupConfig({ MAIN_TABLE: 't', DRY_RUN: '1', INCLUDE_LABELED: '1' }),
        });

        expect(sentOf(send, DeleteCommand)).toHaveLength(0);
        expect(result).toMatchObject({ matched: 2, deleted: 0 });
    });
});

describe('readCleanupConfig', () => {
    it('reads DRY_RUN=1 as a dry run', () => {
        expect(readCleanupConfig({ MAIN_TABLE: 't', DRY_RUN: '1' })).toEqual({
            tableName: 't',
            dryRun: true,
            includeLabeled: false,
        });
    });

    it('defaults to a real run without labeled items', () => {
        expect(readCleanupConfig({ MAIN_TABLE: 't' })).toEqual({
            tableName: 't',
            dryRun: false,
            includeLabeled: false,
        });
    });

    it('treats DRY_RUN as a dry run whenever it is set, except to 0/false', () => {
        for (const value of ['1', 'true', 'yes', 'TRUE', '']) {
            expect(readCleanupConfig({ MAIN_TABLE: 't', DRY_RUN: value }).dryRun).toBe(true);
        }
        for (const value of ['0', 'false', 'FALSE']) {
            expect(readCleanupConfig({ MAIN_TABLE: 't', DRY_RUN: value }).dryRun).toBe(false);
        }
    });

    it('only treats INCLUDE_LABELED=1 as enabled', () => {
        expect(
            readCleanupConfig({ MAIN_TABLE: 't', INCLUDE_LABELED: 'true' }).includeLabeled
        ).toBe(false);
        expect(
            readCleanupConfig({ MAIN_TABLE: 't', INCLUDE_LABELED: '1' }).includeLabeled
        ).toBe(true);
    });

    it('requires MAIN_TABLE', () => {
        expect(() => readCleanupConfig({})).toThrow(/MAIN_TABLE/);
    });
});
