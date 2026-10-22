import {
    APIGatewayProxyEventV2WithLambdaAuthorizer,
    APIGatewayProxyResultV2,
    Handler,
} from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    GetCommand,
    UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { AuthorizerContext } from 'models/auth';
import { removeKeys } from 'resources/dynamo/utilities';
import { logRequest } from 'utilities/logging';

const { usersTable = '' } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

type GamificationState = {
    currentStreak: number;
    longestStreak: number;
    lastStudyDate: string | null;
    unlockedAchievementIds: string[];
    unlockedAtById: Record<string, string>;
    studiedStudysetUUIDs: string[];
    studysetSessionCounts: Record<string, number>;
};

type CustomAchievement = {
    id: string;
    title: string;
    description: string;
    icon: string;
    metric: string;
    threshold: number;
    studysetUUID?: string;
    createdAt: string;
    unlockedAt?: string;
};

type RequestBody = {
    gamification: GamificationState;
    customAchievements: CustomAchievement[];
};

const emptyGamification = (): GamificationState => ({
    currentStreak: 0,
    longestStreak: 0,
    lastStudyDate: null,
    unlockedAchievementIds: [],
    unlockedAtById: {},
    studiedStudysetUUIDs: [],
    studysetSessionCounts: {},
});

export const handler: Handler = async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
    context
): Promise<APIGatewayProxyResultV2> => {
    logRequest(event);

    const { sub: userUUID, username } = event.requestContext.authorizer.lambda;
    const body: RequestBody = JSON.parse(event.body ?? '{}');

    const { gamification, customAchievements } = body;

    if (!gamification || !Array.isArray(customAchievements)) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: 'gamification and customAchievements are required',
            }),
        };
    }

    try {
        const PK = `user#${userUUID}`;
        const SK = `userData`;
        const updatedAt = new Date().toISOString();

        const getCommand = new GetCommand({
            Key: { PK, SK },
            TableName: usersTable,
        });
        const getResult = await docClient.send(getCommand);
        const currentUser = getResult.Item;

        if (!currentUser) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'User not found' }),
            };
        }

        const remoteGamification: GamificationState =
            currentUser.metadata?.gamification ?? emptyGamification();
        const remoteCustom: CustomAchievement[] =
            currentUser.metadata?.customAchievements ?? [];

        const mergedGamification = mergeGamificationState(
            remoteGamification,
            gamification
        );
        const mergedCustom = mergeCustomAchievements(
            remoteCustom,
            customAchievements
        );

        const updateCommand = new UpdateCommand({
            Key: { PK, SK },
            TableName: usersTable,
            UpdateExpression:
                'SET #metadata.#gamification = :gamification, #metadata.#customAchievements = :customAchievements, #updatedAt = :updatedAt, #updatedBy = :updatedBy',
            ExpressionAttributeNames: {
                '#metadata': 'metadata',
                '#gamification': 'gamification',
                '#customAchievements': 'customAchievements',
                '#updatedAt': 'updatedAt',
                '#updatedBy': 'updatedBy',
            },
            ExpressionAttributeValues: {
                ':gamification': mergedGamification,
                ':customAchievements': mergedCustom,
                ':updatedAt': updatedAt,
                ':updatedBy': username,
            },
            ReturnValues: 'ALL_NEW',
        });

        const updateResult = await docClient.send(updateCommand);
        const updatedUser = updateResult.Attributes;

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Successfully updated gamification',
                gamification: mergedGamification,
                customAchievements: mergedCustom,
                user: removeKeys(updatedUser ?? {}),
            }),
        };
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Error updating gamification',
            }),
        };
    }
};

function mergeGamificationState(
    local: GamificationState,
    remote: GamificationState
): GamificationState {
    const longestStreak = Math.max(local.longestStreak, remote.longestStreak);
    const streak = mergeStreakFields(local, remote);

    const unlockedAchievementIds = [
        ...new Set([
            ...local.unlockedAchievementIds,
            ...remote.unlockedAchievementIds,
        ]),
    ];

    const unlockedAtById = { ...local.unlockedAtById, ...remote.unlockedAtById };
    for (const id of unlockedAchievementIds) {
        const localAt = local.unlockedAtById[id];
        const remoteAt = remote.unlockedAtById[id];
        if (localAt && remoteAt) {
            unlockedAtById[id] = localAt < remoteAt ? localAt : remoteAt;
        }
    }

    const studiedStudysetUUIDs = [
        ...new Set([
            ...local.studiedStudysetUUIDs,
            ...remote.studiedStudysetUUIDs,
        ]),
    ];

    const studysetSessionCounts = { ...local.studysetSessionCounts };
    for (const [uuid, count] of Object.entries(remote.studysetSessionCounts)) {
        studysetSessionCounts[uuid] = Math.max(
            count,
            studysetSessionCounts[uuid] ?? 0
        );
    }

    return {
        ...streak,
        longestStreak,
        unlockedAchievementIds,
        unlockedAtById,
        studiedStudysetUUIDs,
        studysetSessionCounts,
    };
}

function mergeStreakFields(
    local: GamificationState,
    remote: GamificationState
): Pick<GamificationState, 'currentStreak' | 'lastStudyDate'> {
    if (!local.lastStudyDate && !remote.lastStudyDate) {
        return { currentStreak: 0, lastStudyDate: null };
    }
    if (!local.lastStudyDate) {
        return {
            currentStreak: remote.currentStreak,
            lastStudyDate: remote.lastStudyDate,
        };
    }
    if (!remote.lastStudyDate) {
        return {
            currentStreak: local.currentStreak,
            lastStudyDate: local.lastStudyDate,
        };
    }

    if (local.lastStudyDate > remote.lastStudyDate) {
        return {
            currentStreak: local.currentStreak,
            lastStudyDate: local.lastStudyDate,
        };
    }
    if (remote.lastStudyDate > local.lastStudyDate) {
        return {
            currentStreak: remote.currentStreak,
            lastStudyDate: remote.lastStudyDate,
        };
    }

    return {
        currentStreak: Math.max(local.currentStreak, remote.currentStreak),
        lastStudyDate: local.lastStudyDate,
    };
}

function mergeCustomAchievements(
    local: CustomAchievement[],
    remote: CustomAchievement[]
): CustomAchievement[] {
    const byId = new Map<string, CustomAchievement>();

    for (const achievement of [...local, ...remote]) {
        const existing = byId.get(achievement.id);
        if (!existing) {
            byId.set(achievement.id, achievement);
            continue;
        }

        const unlockedAt =
            existing.unlockedAt && achievement.unlockedAt
                ? existing.unlockedAt < achievement.unlockedAt
                    ? existing.unlockedAt
                    : achievement.unlockedAt
                : existing.unlockedAt ?? achievement.unlockedAt;

        byId.set(achievement.id, {
            ...existing,
            ...achievement,
            unlockedAt,
            createdAt:
                existing.createdAt < achievement.createdAt
                    ? existing.createdAt
                    : achievement.createdAt,
        });
    }

    return [...byId.values()];
}
