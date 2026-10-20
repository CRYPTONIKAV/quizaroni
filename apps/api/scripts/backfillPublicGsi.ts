/**
 * One-off backfill: index study sets that were already public *before* the
 * public-sharing GSI existed.
 *
 * PK2/SK2 are now written only by publish/unpublish and the takedown script.
 * Legacy sets made public before the GSI existed have no PK2, so they are
 * invisible to the public read path until backfilled here. This bypasses the
 * publish gate (no subject, no card-count check): never use it to publish
 * sets. Sets hidden by moderation are skipped.
 *
 * Usage (with AWS credentials for the target account in the environment):
 *   MAIN_TABLE=quizaroni-<deploymentType>-main AWS_REGION=us-west-2 \
 *     pnpm --filter @quizaroni/api backfill:public-gsi
 *   # add DRY_RUN=1 to only report what would change.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    ScanCommand,
    UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
    PUBLIC_STUDYSET_PK,
    publicStudysetSK,
} from '../resources/dynamo/publicSharing';

const mainTable = process.env.MAIN_TABLE ?? '';
const dryRun = process.env.DRY_RUN === '1';

if (!mainTable) {
    console.error('Set MAIN_TABLE to the target table name, e.g. quizaroni-production-main');
    process.exit(1);
}

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const run = async () => {
    let scanned = 0;
    let updated = 0;
    let alreadyIndexed = 0;
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
        const result = await docClient.send(
            new ScanCommand({
                TableName: mainTable,
                // Only public, non-hidden sets that are not yet on the PK2 index.
                FilterExpression:
                    'metadata.publiclyViewable = :true AND attribute_not_exists(PK2) AND attribute_not_exists(moderation.hiddenAt)',
                ExpressionAttributeValues: { ':true': true },
                ExclusiveStartKey: lastEvaluatedKey as never,
            })
        );

        for (const item of result.Items ?? []) {
            scanned += 1;
            const { PK, SK, studysetUUID } = item as {
                PK: string;
                SK: string;
                studysetUUID: string;
            };

            if (item.PK2) {
                alreadyIndexed += 1;
                continue;
            }

            console.log(
                `${dryRun ? '[dry-run] would index' : 'indexing'} ${studysetUUID} (${SK})`
            );

            if (!dryRun) {
                await docClient.send(
                    new UpdateCommand({
                        TableName: mainTable,
                        Key: { PK, SK },
                        UpdateExpression: 'SET PK2 = :pk2, SK2 = :sk2',
                        ExpressionAttributeValues: {
                            ':pk2': PUBLIC_STUDYSET_PK,
                            ':sk2': publicStudysetSK(studysetUUID),
                        },
                    })
                );
                updated += 1;
            }
        }

        lastEvaluatedKey = result.LastEvaluatedKey as
            | Record<string, unknown>
            | undefined;
    } while (lastEvaluatedKey);

    console.log(
        `\nDone. matched=${scanned} indexed=${updated} alreadyIndexed=${alreadyIndexed}${
            dryRun ? ' (dry run — no writes performed)' : ''
        }`
    );
};

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
