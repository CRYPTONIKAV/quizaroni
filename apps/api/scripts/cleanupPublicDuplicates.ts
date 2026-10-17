/**
 * One-off cleanup: make private the duplicated study sets that inherited
 * their source's public-sharing state.
 *
 * Duplicating a set used to structuredClone the stored item, so a copy of a
 * public set kept `metadata.publiclyViewable: true` and the source's public
 * index keys, with SK2 = `studyset#<source id>` (#125). Every real publish
 * writes SK2 from the set's own id, so an item on the public index whose SK2
 * doesn't match its own `studysetUUID` is an inherited copy. The script sets
 * `publiclyViewable` to false on those items and removes their PK2/SK2; it
 * touches nothing else.
 *
 * Limitations: copies of sets that were public before the public index
 * existed carry `publiclyViewable: true` with either no PK2 (not yet
 * backfilled) or an SK2 matching their own id (backfilled). They look the
 * same as sets their owner published, so they are left alone.
 *
 * Run only after the fixed duplicate lambdas are deployed to that
 * environment; copies made before the deploy get the inherited keys again.
 *
 * Usage (with AWS credentials for the target account in the environment):
 *   MAIN_TABLE=quizaroni-<deploymentType>-main AWS_REGION=us-west-2 \
 *     pnpm --filter @quizaroni/api cleanup:public-duplicates
 *   # add DRY_RUN=1 to only report what would change.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    QueryCommand,
    UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
    PUBLIC_GSI_INDEX_NAME,
    PUBLIC_STUDYSET_PK,
    publicStudysetSK,
} from '../resources/dynamo/publicSharing';

type CleanupResult = {
    scanned: number;
    matched: number;
    updated: number;
    skipped: number;
};

type CleanupConfig = {
    tableName: string;
    dryRun: boolean;
};

export const isInheritedPublicCopy = (item: Record<string, unknown>): boolean =>
    item.PK2 === PUBLIC_STUDYSET_PK &&
    typeof item.studysetUUID === 'string' &&
    typeof item.SK2 === 'string' &&
    item.SK2 !== publicStudysetSK(item.studysetUUID);

// A set DRY_RUN counts unless it is 0/false, so a typo or an empty value can't
// turn a report into real writes.
const isDryRun = (value: string | undefined) =>
    value !== undefined && !['0', 'false'].includes(value.toLowerCase());

export const readCleanupConfig = (env: NodeJS.ProcessEnv): CleanupConfig => {
    const tableName = env.MAIN_TABLE ?? '';
    if (!tableName) {
        throw new Error(
            'Set MAIN_TABLE to the target table name, e.g. quizaroni-production-main'
        );
    }
    return { tableName, dryRun: isDryRun(env.DRY_RUN) };
};

export const cleanupPublicDuplicates = async ({
    docClient,
    tableName,
    dryRun,
    log = console.log,
}: {
    docClient: DynamoDBDocumentClient;
    tableName: string;
    dryRun: boolean;
    log?: (message: string) => void;
}): Promise<CleanupResult> => {
    const result: CleanupResult = { scanned: 0, matched: 0, updated: 0, skipped: 0 };
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
        const page = await docClient.send(
            new QueryCommand({
                TableName: tableName,
                IndexName: PUBLIC_GSI_INDEX_NAME,
                KeyConditionExpression: 'PK2 = :pk',
                ExpressionAttributeValues: { ':pk': PUBLIC_STUDYSET_PK },
                // PK2 must be projected: isInheritedPublicCopy checks it.
                ProjectionExpression: 'PK, SK, PK2, SK2, studysetUUID, title',
                ExclusiveStartKey: lastEvaluatedKey as never,
            })
        );

        for (const item of page.Items ?? []) {
            result.scanned += 1;
            if (!isInheritedPublicCopy(item)) {
                continue;
            }
            const { PK, SK, SK2 } = item as { PK: string; SK: string; SK2: string };

            result.matched += 1;
            log(
                `${dryRun ? '[dry-run] would make private' : 'making private'} ${PK} ${SK} (title=${
                    item.title ?? '-'
                }, inherited ${SK2})`
            );

            if (dryRun) {
                continue;
            }

            try {
                // The SK2 guard skips a copy its owner re-published meanwhile,
                // and an item deleted since the Query.
                await docClient.send(
                    new UpdateCommand({
                        TableName: tableName,
                        Key: { PK, SK },
                        UpdateExpression:
                            'SET #metadata.#publiclyViewable = :false REMOVE #PK2, #SK2',
                        ConditionExpression:
                            '#SK2 = :inheritedSK2 AND attribute_exists(#metadata)',
                        ExpressionAttributeNames: {
                            '#metadata': 'metadata',
                            '#publiclyViewable': 'publiclyViewable',
                            '#PK2': 'PK2',
                            '#SK2': 'SK2',
                        },
                        ExpressionAttributeValues: {
                            ':false': false,
                            ':inheritedSK2': SK2,
                        },
                    })
                );
                result.updated += 1;
            } catch (error) {
                if ((error as Error)?.name === 'ConditionalCheckFailedException') {
                    result.skipped += 1;
                    continue;
                }
                throw error;
            }
        }

        lastEvaluatedKey = page.LastEvaluatedKey as
            | Record<string, unknown>
            | undefined;
    } while (lastEvaluatedKey);

    return result;
};

if (require.main === module) {
    let config: CleanupConfig;
    try {
        config = readCleanupConfig(process.env);
    } catch (error) {
        console.error((error as Error).message);
        process.exit(1);
    }

    const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

    cleanupPublicDuplicates({ docClient, ...config })
        .then(({ scanned, matched, updated, skipped }) => {
            console.log(
                `\nDone. scanned=${scanned} matched=${matched} updated=${updated} skipped=${skipped}${
                    config.dryRun ? ' (dry run — no writes performed)' : ''
                }`
            );
        })
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
