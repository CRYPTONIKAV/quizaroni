/**
 * Moderation takedown: hide a study set and take it off Explore.
 *
 * Sets `moderation.hiddenAt` (and `moderation.reason` when REASON is given),
 * turns `metadata.publiclyViewable` off and removes the PK2/SK2 public-index
 * keys. A hidden set 404s at its public link, is left out of the sitemap list,
 * and its owner can't republish it. Content is not deleted.
 *
 * There is no un-hide tool: to restore a set, remove its `moderation`
 * attribute by hand; the owner can then publish it again.
 *
 * The set is always looked up on the public index by STUDYSET_UUID. For a set
 * that isn't published, pass its owner as USER_UUID to hide it anyway; for a
 * published set, USER_UUID must match the owner on the index.
 * Duplicates made before #125 can sit on the index under this set's key; the
 * public read paths never serve them (`isOwnIndexRow`), so they are ignored.
 *
 * Usage (with AWS credentials for the target account in the environment):
 *   MAIN_TABLE=quizaroni-<deploymentType>-main AWS_REGION=us-west-2 \
 *     STUDYSET_UUID=<id> [USER_UUID=<owner>] [REASON="..."] \
 *     pnpm --filter @quizaroni/api unpublish:studyset
 *   # add DRY_RUN=1 to only report what would change.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    GetCommand,
    QueryCommand,
    UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
    isOwnIndexRow,
    PUBLIC_GSI_INDEX_NAME,
    PUBLIC_STUDYSET_PK,
    publicStudysetSK,
} from '../resources/dynamo/publicSharing';
import { isDryRun } from './dryRun';

type TakedownConfig = {
    tableName: string;
    studysetUUID: string;
    userUUID?: string;
    reason?: string;
    dryRun: boolean;
};

type StudysetKey = { PK: string; SK: string };

export const readTakedownConfig = (env: NodeJS.ProcessEnv): TakedownConfig => {
    const tableName = env.MAIN_TABLE ?? '';
    if (!tableName) {
        throw new Error(
            'Set MAIN_TABLE to the target table name, e.g. quizaroni-production-main'
        );
    }
    const studysetUUID = env.STUDYSET_UUID ?? '';
    if (!studysetUUID) {
        throw new Error('Set STUDYSET_UUID to the id of the set to take down');
    }
    return {
        tableName,
        studysetUUID,
        userUUID: env.USER_UUID || undefined,
        reason: env.REASON || undefined,
        dryRun: isDryRun(env.DRY_RUN),
    };
};

export const findStudysetKey = async ({
    docClient,
    tableName,
    studysetUUID,
    userUUID,
}: {
    docClient: DynamoDBDocumentClient;
    tableName: string;
    studysetUUID: string;
    userUUID?: string;
}): Promise<StudysetKey> => {
    const rows: Record<string, unknown>[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;
    do {
        const page = await docClient.send(
            new QueryCommand({
                TableName: tableName,
                IndexName: PUBLIC_GSI_INDEX_NAME,
                KeyConditionExpression: 'PK2 = :pk2 AND SK2 = :sk2',
                ExpressionAttributeValues: {
                    ':pk2': PUBLIC_STUDYSET_PK,
                    ':sk2': publicStudysetSK(studysetUUID),
                },
                ProjectionExpression: 'PK, SK, SK2',
                ExclusiveStartKey: lastEvaluatedKey as never,
            })
        );
        rows.push(...(page.Items ?? []));
        lastEvaluatedKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastEvaluatedKey);

    const own = rows.find(isOwnIndexRow) as StudysetKey | undefined;
    if (userUUID) {
        const key = { PK: `userUUID#${userUUID}`, SK: `studyset#${studysetUUID}` };
        if (own && own.PK !== key.PK) {
            throw new Error(
                `Study set ${studysetUUID} is on the public index under ${own.PK}, not ${key.PK}; fix USER_UUID or leave it out`
            );
        }
        if (own) {
            return key;
        }
        // Checked here so a dry run catches a wrong USER_UUID too.
        const { Item } = await docClient.send(
            new GetCommand({ TableName: tableName, Key: key, ProjectionExpression: 'PK' })
        );
        if (!Item) {
            throw new Error(`No study set ${studysetUUID} under ${key.PK}; check USER_UUID`);
        }
        return key;
    }
    if (!own) {
        throw new Error(
            `Study set ${studysetUUID} is not on the public index; pass USER_UUID to hide it anyway`
        );
    }
    return { PK: own.PK, SK: own.SK };
};

export const takedownStudyset = async ({
    docClient,
    tableName,
    key,
    reason,
    now,
    dryRun,
    log = console.log,
}: {
    docClient: DynamoDBDocumentClient;
    tableName: string;
    key: StudysetKey;
    reason?: string;
    now: string;
    dryRun: boolean;
    log?: (message: string) => void;
}): Promise<{ updated: boolean }> => {
    log(
        `${dryRun ? '[dry-run] would hide' : 'hiding'} ${key.PK} ${key.SK}${
            reason ? ` (reason: ${reason})` : ''
        }`
    );
    if (dryRun) {
        return { updated: false };
    }

    await docClient.send(
        new UpdateCommand({
            TableName: tableName,
            Key: key,
            UpdateExpression:
                'SET #moderation = :moderation, #metadata.#publiclyViewable = :false REMOVE #PK2, #SK2',
            ConditionExpression: 'attribute_exists(PK)',
            ExpressionAttributeNames: {
                '#moderation': 'moderation',
                '#metadata': 'metadata',
                '#publiclyViewable': 'publiclyViewable',
                '#PK2': 'PK2',
                '#SK2': 'SK2',
            },
            ExpressionAttributeValues: {
                ':moderation': { hiddenAt: now, ...(reason ? { reason } : {}) },
                ':false': false,
            },
        })
    );
    return { updated: true };
};

if (require.main === module) {
    let config: TakedownConfig;
    try {
        config = readTakedownConfig(process.env);
    } catch (error) {
        console.error((error as Error).message);
        process.exit(1);
    }

    const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

    findStudysetKey({ docClient, ...config })
        .then((key) =>
            takedownStudyset({
                docClient,
                tableName: config.tableName,
                key,
                reason: config.reason,
                now: new Date().toISOString(),
                dryRun: config.dryRun,
            })
        )
        .then(({ updated }) => {
            console.log(
                `\nDone. updated=${updated}${
                    config.dryRun ? ' (dry run — no writes performed)' : ''
                }`
            );
        })
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
