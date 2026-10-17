import {
    DynamoDBDocumentClient,
    QueryCommand,
    UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
    cleanupPublicDuplicates,
    isInheritedPublicCopy,
    readCleanupConfig,
} from '../../scripts/cleanupPublicDuplicates';

const inheritedCopy = {
    PK: 'userUUID#u1',
    SK: 'studyset#copy',
    PK2: 'publicStudyset',
    SK2: 'studyset#src',
    studysetUUID: 'copy',
    title: 'Biology Copy',
    metadata: { publiclyViewable: true },
};
const realPublic = {
    PK: 'userUUID#u1',
    SK: 'studyset#src',
    PK2: 'publicStudyset',
    SK2: 'studyset#src',
    studysetUUID: 'src',
    title: 'Biology',
    metadata: { publiclyViewable: true },
};

type Page = { Items: Record<string, unknown>[]; LastEvaluatedKey?: Record<string, unknown> };

// Returns only the projected attributes, like DynamoDB, so a projection that
// drops PK2 or SK2 makes the match tests fail.
const project = (item: Record<string, unknown>, projection = '') => {
    const names = projection.split(',').map((name) => name.trim());
    return Object.fromEntries(Object.entries(item).filter(([key]) => names.includes(key)));
};

const makeClient = (
    pages: Page[],
    onUpdate: (cmd: UpdateCommand) => Promise<unknown> = () => Promise.resolve({})
) => {
    let page = 0;
    const send = jest.fn((cmd: unknown) => {
        if (cmd instanceof QueryCommand) {
            const { Items, LastEvaluatedKey } = pages[page++] ?? { Items: [] };
            return Promise.resolve({
                Items: Items.map((item) => project(item, cmd.input.ProjectionExpression)),
                LastEvaluatedKey,
            });
        }
        if (cmd instanceof UpdateCommand) {
            return onUpdate(cmd);
        }
        return Promise.reject(new Error('unexpected command'));
    });
    return { send, docClient: { send } as unknown as DynamoDBDocumentClient };
};

const sentOf = <T>(send: jest.Mock, type: new (...args: never[]) => T): T[] =>
    send.mock.calls.map(([cmd]) => cmd).filter((cmd): cmd is T => cmd instanceof type);

describe('isInheritedPublicCopy', () => {
    it('matches a copy indexed under its source id', () => {
        expect(isInheritedPublicCopy(inheritedCopy)).toBe(true);
    });

    it('rejects a set indexed under its own id', () => {
        expect(isInheritedPublicCopy(realPublic)).toBe(false);
    });

    it('rejects items outside the public partition', () => {
        const { PK2: _PK2, ...unindexed } = inheritedCopy;
        expect(isInheritedPublicCopy(unindexed)).toBe(false);
        expect(isInheritedPublicCopy({ ...inheritedCopy, PK2: 'other' })).toBe(false);
    });

    it('rejects items without a studysetUUID', () => {
        const { studysetUUID: _studysetUUID, ...stub } = inheritedCopy;
        expect(isInheritedPublicCopy(stub)).toBe(false);
    });
});

describe('cleanupPublicDuplicates', () => {
    const log = jest.fn();

    beforeEach(() => {
        log.mockReset();
    });

    it('with dryRun reports copies and writes nothing', async () => {
        const { send, docClient } = makeClient([{ Items: [inheritedCopy, realPublic] }]);

        const result = await cleanupPublicDuplicates({
            docClient,
            tableName: 't',
            dryRun: true,
            log,
        });

        expect(result).toEqual({ scanned: 2, matched: 1, updated: 0, skipped: 0 });
        expect(sentOf(send, UpdateCommand)).toHaveLength(0);
        expect(log).toHaveBeenCalledWith(expect.stringContaining('[dry-run]'));
        expect(log).toHaveBeenCalledWith(expect.stringContaining(inheritedCopy.SK));
    });

    it('makes inherited copies private with a stale-key guard', async () => {
        const { send, docClient } = makeClient([{ Items: [inheritedCopy] }]);

        const result = await cleanupPublicDuplicates({
            docClient,
            tableName: 't',
            dryRun: false,
            log,
        });

        const updates = sentOf(send, UpdateCommand);
        expect(updates).toHaveLength(1);
        const input = updates[0]!.input;
        expect(input.Key).toEqual({ PK: inheritedCopy.PK, SK: inheritedCopy.SK });
        expect(input.UpdateExpression).toContain('SET #metadata.#publiclyViewable = :false');
        expect(input.UpdateExpression).toContain('REMOVE #PK2, #SK2');
        expect(input.ConditionExpression).toContain('#SK2 = :inheritedSK2');
        expect(input.ExpressionAttributeValues).toEqual({
            ':false': false,
            ':inheritedSK2': 'studyset#src',
        });
        expect(result).toEqual({ scanned: 1, matched: 1, updated: 1, skipped: 0 });
    });

    it('leaves correctly indexed public sets alone', async () => {
        const { send, docClient } = makeClient([{ Items: [realPublic] }]);

        const result = await cleanupPublicDuplicates({
            docClient,
            tableName: 't',
            dryRun: false,
            log,
        });

        expect(result).toEqual({ scanned: 1, matched: 0, updated: 0, skipped: 0 });
        expect(sentOf(send, UpdateCommand)).toHaveLength(0);
    });

    it('queries the public index and follows LastEvaluatedKey', async () => {
        const lastKey = { PK: 'a', SK: 'b', PK2: 'publicStudyset', SK2: 'studyset#a' };
        const { send, docClient } = makeClient([
            { Items: [], LastEvaluatedKey: lastKey },
            { Items: [inheritedCopy] },
        ]);

        await cleanupPublicDuplicates({ docClient, tableName: 't', dryRun: false, log });

        const queries = sentOf(send, QueryCommand);
        expect(queries).toHaveLength(2);
        const first = queries[0]!.input;
        expect(first.IndexName).toBe('PK2');
        expect(first.ExpressionAttributeValues).toEqual({ ':pk': 'publicStudyset' });
        expect(first.ProjectionExpression!.split(', ')).toEqual(
            expect.arrayContaining(['PK', 'SK', 'PK2', 'SK2', 'studysetUUID'])
        );
        expect(queries[1]!.input.ExclusiveStartKey).toEqual(lastKey);
        for (const cmd of [...queries, ...sentOf(send, UpdateCommand)]) {
            expect(cmd.input.TableName).toBe('t');
        }
    });

    it('counts a ConditionalCheckFailedException as skipped', async () => {
        const { docClient } = makeClient([{ Items: [inheritedCopy] }], () =>
            Promise.reject(
                Object.assign(new Error('x'), { name: 'ConditionalCheckFailedException' })
            )
        );

        const result = await cleanupPublicDuplicates({
            docClient,
            tableName: 't',
            dryRun: false,
            log,
        });

        expect(result).toMatchObject({ skipped: 1, updated: 0 });
    });

    it('rethrows other update errors', async () => {
        const { docClient } = makeClient([{ Items: [inheritedCopy] }], () =>
            Promise.reject(new Error('throttled'))
        );

        await expect(
            cleanupPublicDuplicates({ docClient, tableName: 't', dryRun: false, log })
        ).rejects.toThrow('throttled');
    });

    it('DRY_RUN=1 from the environment writes nothing', async () => {
        const { send, docClient } = makeClient([{ Items: [inheritedCopy] }]);

        const result = await cleanupPublicDuplicates({
            docClient,
            log,
            ...readCleanupConfig({ MAIN_TABLE: 't', DRY_RUN: '1' }),
        });

        expect(sentOf(send, UpdateCommand)).toHaveLength(0);
        expect(result).toMatchObject({ matched: 1, updated: 0 });
    });
});

describe('readCleanupConfig', () => {
    it('reads DRY_RUN=1 as a dry run', () => {
        expect(readCleanupConfig({ MAIN_TABLE: 't', DRY_RUN: '1' })).toEqual({
            tableName: 't',
            dryRun: true,
        });
    });

    it('defaults to a real run', () => {
        expect(readCleanupConfig({ MAIN_TABLE: 't' })).toEqual({
            tableName: 't',
            dryRun: false,
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

    it('requires MAIN_TABLE', () => {
        expect(() => readCleanupConfig({})).toThrow(/MAIN_TABLE/);
    });
});
