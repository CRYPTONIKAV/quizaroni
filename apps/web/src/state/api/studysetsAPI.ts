import {
    useQuery,
    useMutation,
    useQueryClient,
    UseQueryOptions,
} from '@tanstack/react-query';
import { BASE_API_URL, fetchJson, getCommonPostRequestProps } from './awsAPI';
import { validate } from 'shared/validation';
import {
    BaseResponseSchema,
    GetAllStudysetsResponseSchema,
    GetStudysetResponseSchema,
    GetPublicStudysetResponseSchema,
    CreateStudysetResponseSchema,
    UpdateStudysetResponseSchema,
    BatchDeleteStudysetsResponseSchema,
    BatchDuplicateStudysetsResponseSchema,
    CreateNoteResponseSchema,
} from 'shared/schemas';
import type { z } from 'zod';

/* Endpoints
    Studyset Operations
    router.post("/api/studysets/get-all-studysets", getAllStudysets);
    router.post("/api/studysets/get-studyset", getStudyset);
    router.post("/api/studysets/create-studyset", createStudyset);
    router.post("/api/studysets/delete-studyset", deleteStudyset);
    router.post("/api/studysets/batch-delete-studysets", batchDeleteStudysets);
    router.post("/api/studysets/duplicate-studyset", duplicateStudyset);
    router.post("/api/studysets/batch-duplicate-studysets", batchDuplicateStudysets);
    router.post("/api/studysets/update-studyset", updateStudyset);
    router.post("/api/studysets/batch-update-studysets", batchUpdateStudysets);
    router.post("/api/studysets/editCategory", editCategory);
    
    Note Operations
    router.post("/api/studysets/create-note", createNote);
    router.post("/api/studysets/delete-note", deleteNote);
    router.post("/api/studysets/edit-note", editNote);
    
    Label Operations
    router.post("/api/studysets/create-labels", createLabels);
    router.post("/api/studysets/delete-labels", deleteLabels);
    router.post("/api/studysets/edit-labels", editLabels);
    router.post("/api/studysets/update-studyset-labels", updateStudysetLabels);
*/

import {
    UUID,
    Studyset,
    EditCategoryRequest,
    DeleteStudysetRequest,
    GetAllStudysetsRequest,
    GetStudysetRequest,
    DuplicateStudysetRequest,
    CreateLabelRequest,
    DeleteLabelRequest,
    EditLabelRequest,
    ChangeLabelRequest,
    CreateNoteRequest,
    DeleteNoteRequest,
    EditNoteRequest,
    UpdateStudysetRequest,
    GetAllStudysetsResponse,
    GetStudysetResponse,
    CreateStudysetResponse,
    BatchUpdateStudysetsRequest,
    CreateNoteResponse,
    UpdateStudysetResponse,
    BatchDeleteStudysetsResponse,
    BatchDuplicateStudysetsResponse,
    BatchDeleteStudysetsRequest,
    BatchDuplicateStudysetsRequest,
} from 'shared/types';

// The list can include stub rows an upsert left behind with no cards or id (#127, #146).
export const isCompleteStudyset = (item: unknown): item is Studyset =>
    typeof item === 'object' &&
    item !== null &&
    typeof (item as Studyset).studysetUUID === 'string' &&
    Array.isArray((item as Studyset).cards);

// Queries
export const useGetAllStudysets = (
    options?: Omit<
        UseQueryOptions<GetAllStudysetsResponse>,
        'queryKey' | 'queryFn'
    >
) => {
    return useQuery({
        queryKey: ['studysets'],
        queryFn: async () => {
            const data = await fetchJson<{ studysets?: unknown }>(
                `${BASE_API_URL}/studysets/get-all-studysets`,
                {
                    ...(await getCommonPostRequestProps()),
                }
            );
            // Drop stubs before validating so one stub doesn't fail the whole list.
            return validate({
                schema: GetAllStudysetsResponseSchema,
                data: Array.isArray(data?.studysets)
                    ? {
                          ...data,
                          studysets: data.studysets.filter(isCompleteStudyset),
                      }
                    : data,
                type: 'response',
                context: 'GetAllStudysets',
            });
        },
        ...options,
    });
};

export const useGetStudyset = (
    { studysetUUID }: GetStudysetRequest,
    options?: Omit<UseQueryOptions<GetStudysetResponse>, 'queryKey' | 'queryFn'>
) => {
    return useQuery({
        queryKey: ['studysets', studysetUUID],
        queryFn: async () => {
            const data = await fetchJson(
                `${BASE_API_URL}/studysets/get-studyset`,
                {
                    ...(await getCommonPostRequestProps()),
                    body: JSON.stringify({ studysetUUID }),
                }
            );
            return validate({
                schema: GetStudysetResponseSchema,
                data,
                type: 'response',
                context: 'GetStudyset',
            });
        },
        ...options,
    });
};

export type GetPublicStudysetResponse = z.infer<
    typeof GetPublicStudysetResponseSchema
>;

/**
 * Fetches a publicly-shared study set through the unauthenticated endpoint.
 * Deliberately does NOT send an auth header, so it works for logged-out
 * visitors. A 404 (private/nonexistent) is surfaced by throwing so callers can
 * render a "not available" state.
 */
export const useGetPublicStudyset = (
    studysetUUID: string,
    options?: Omit<
        UseQueryOptions<GetPublicStudysetResponse>,
        'queryKey' | 'queryFn'
    >
) => {
    return useQuery({
        queryKey: ['public-studyset', studysetUUID],
        queryFn: async () => {
            const response = await fetch(
                `${BASE_API_URL}/public/studyset/${encodeURIComponent(
                    studysetUUID
                )}`,
                { method: 'GET' }
            );
            if (!response.ok) {
                throw new Error(
                    response.status === 404
                        ? 'This study set is private or does not exist.'
                        : 'Failed to load study set.'
                );
            }
            const data = await response.json();
            return validate({
                schema: GetPublicStudysetResponseSchema,
                data,
                type: 'response',
                context: 'GetPublicStudyset',
            });
        },
        retry: false,
        ...options,
    });
};

// Mutations
export const useCreateStudyset = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const data = await fetchJson(
                `${BASE_API_URL}/studysets/create-studyset`,
                {
                    ...(await getCommonPostRequestProps()),
                }
            );
            return validate({
                schema: CreateStudysetResponseSchema,
                data,
                type: 'response',
                context: 'CreateStudyset',
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['studysets'] });
        },
    });
};

export const useDeleteStudyset = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ studysetUUID }: DeleteStudysetRequest) => {
            const data = await fetchJson(
                `${BASE_API_URL}/studysets/delete-studyset`,
                {
                    ...(await getCommonPostRequestProps()),
                    body: JSON.stringify({ studysetUUID }),
                }
            );
            return validate({
                schema: BaseResponseSchema,
                data,
                type: 'response',
                context: 'DeleteStudyset',
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['studysets'] });
        },
    });
};

export const useBatchDeleteStudysets = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ studysetUUIDs }: BatchDeleteStudysetsRequest) => {
            const data = await fetchJson(
                `${BASE_API_URL}/studysets/batch-delete-studysets`,
                {
                    ...(await getCommonPostRequestProps()),
                    body: JSON.stringify({ studysetUUIDs }),
                }
            );
            return validate({
                schema: BatchDeleteStudysetsResponseSchema,
                data,
                type: 'response',
                context: 'BatchDeleteStudysets',
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['studysets'] });
        },
    });
};

export const useDuplicateStudyset = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ studysetUUID }: DuplicateStudysetRequest) => {
            const data = await fetchJson(
                `${BASE_API_URL}/studysets/duplicate-studyset`,
                {
                    ...(await getCommonPostRequestProps()),
                    body: JSON.stringify({ studysetUUID }),
                }
            );
            return validate({
                schema: BaseResponseSchema,
                data,
                type: 'response',
                context: 'DuplicateStudyset',
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['studysets'] });
        },
    });
};

export const useBatchDuplicateStudysets = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            studysetUUIDs,
        }: BatchDuplicateStudysetsRequest) => {
            const data = await fetchJson(
                `${BASE_API_URL}/studysets/batch-duplicate-studysets`,
                {
                    ...(await getCommonPostRequestProps()),
                    body: JSON.stringify({ studysetUUIDs }),
                }
            );
            return validate({
                schema: BatchDuplicateStudysetsResponseSchema,
                data,
                type: 'response',
                context: 'BatchDuplicateStudysets',
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['studysets'] });
        },
    });
};

export const useUpdateStudyset = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            studysetUUID,
            updates,
            isMetadataUpdate,
        }: UpdateStudysetRequest) => {
            // fetchJson() throws on a non-2xx response, so an error body
            // (which won't match UpdateStudysetResponseSchema) can't fall
            // through validate()'s logs-and-swallows default as if the
            // mutation succeeded — firing onSuccess and losing the edit
            // silently, the bug PR #41 fixed by hand here originally.
            const data = await fetchJson(
                `${BASE_API_URL}/studysets/update-studyset`,
                {
                    ...(await getCommonPostRequestProps()),
                    body: JSON.stringify({
                        studysetUUID,
                        updates,
                        isMetadataUpdate,
                    }),
                }
            );
            return validate({
                schema: UpdateStudysetResponseSchema,
                data,
                type: 'response',
                context: 'UpdateStudyset',
            });
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: ['studysets', variables.studysetUUID],
            });
        },
    });
};

export const useBatchUpdateStudysets = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            studysetUpdates,
        }: BatchUpdateStudysetsRequest) => {
            const data = await fetchJson(
                `${BASE_API_URL}/studysets/batch-update-studysets`,
                {
                    ...(await getCommonPostRequestProps()),
                    body: JSON.stringify({ studysetUpdates }),
                }
            );
            return validate({
                schema: BaseResponseSchema,
                data,
                type: 'response',
                context: 'BatchUpdateStudysets',
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['studysets'] });
        },
    });
};

export const useEditCategory = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            studysetUUID,
            index,
            newCategory,
            oldCategory,
        }: EditCategoryRequest) => {
            const data = await fetchJson(
                `${BASE_API_URL}/studysets/editCategory`,
                {
                    ...(await getCommonPostRequestProps()),
                    body: JSON.stringify({
                        studysetUUID,
                        index,
                        newCategory,
                        oldCategory,
                    }),
                }
            );
            return validate({
                schema: BaseResponseSchema,
                data,
                type: 'response',
                context: 'EditCategory',
            });
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: ['studysets', variables.studysetUUID],
            });
        },
    });
};

export const useCreateNote = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ cardUUID, studysetUUID }: CreateNoteRequest) => {
            const data = await fetchJson(
                `${BASE_API_URL}/studysets/create-note`,
                {
                    ...(await getCommonPostRequestProps()),
                    body: JSON.stringify({ cardUUID, studysetUUID }),
                }
            );
            return validate({
                schema: CreateNoteResponseSchema,
                data,
                type: 'response',
                context: 'CreateNote',
            });
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: ['studysets', variables.studysetUUID],
            });
        },
    });
};

export const useDeleteNote = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            cardUUID,
            noteUUID,
            studysetUUID,
        }: DeleteNoteRequest) => {
            const data = await fetchJson(
                `${BASE_API_URL}/studysets/delete-note`,
                {
                    ...(await getCommonPostRequestProps()),
                    body: JSON.stringify({ cardUUID, noteUUID, studysetUUID }),
                }
            );
            return validate({
                schema: BaseResponseSchema,
                data,
                type: 'response',
                context: 'DeleteNote',
            });
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: ['studysets', variables.studysetUUID],
            });
        },
    });
};

export const useEditNote = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            cardUUID,
            noteUUID,
            studysetUUID,
            text,
        }: EditNoteRequest) => {
            const data = await fetchJson(
                `${BASE_API_URL}/studysets/edit-note`,
                {
                    ...(await getCommonPostRequestProps()),
                    body: JSON.stringify({
                        cardUUID,
                        noteUUID,
                        studysetUUID,
                        text,
                    }),
                }
            );
            return validate({
                schema: BaseResponseSchema,
                data,
                type: 'response',
                context: 'EditNote',
            });
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: ['studysets', variables.studysetUUID],
            });
        },
    });
};

export const useCreateLabel = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            label,
            studysetUUID,
            updateStudysetLabel,
        }: CreateLabelRequest) => {
            const data = await fetchJson(
                `${BASE_API_URL}/studysets/create-labels`,
                {
                    ...(await getCommonPostRequestProps()),
                    body: JSON.stringify({
                        label,
                        studysetUUID,
                        updateStudysetLabel,
                    }),
                }
            );
            return validate({
                schema: BaseResponseSchema,
                data,
                type: 'response',
                context: 'CreateLabel',
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['studysets'] });
            queryClient.invalidateQueries({ queryKey: ['user'] });
        },
    });
};

export const useDeleteLabel = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ labelsToDelete }: DeleteLabelRequest) => {
            const data = await fetchJson(
                `${BASE_API_URL}/studysets/delete-labels`,
                {
                    ...(await getCommonPostRequestProps()),
                    body: JSON.stringify({ labelsToDelete }),
                }
            );
            return validate({
                schema: BaseResponseSchema,
                data,
                type: 'response',
                context: 'DeleteLabel',
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['studysets'] });
            queryClient.invalidateQueries({ queryKey: ['user'] });
        },
    });
};

export const useEditLabel = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ index, newLabel, oldLabel }: EditLabelRequest) => {
            const data = await fetchJson(
                `${BASE_API_URL}/studysets/edit-labels`,
                {
                    ...(await getCommonPostRequestProps()),
                    body: JSON.stringify({ index, newLabel, oldLabel }),
                }
            );
            return validate({
                schema: BaseResponseSchema,
                data,
                type: 'response',
                context: 'EditLabel',
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['studysets'] });
            queryClient.invalidateQueries({ queryKey: ['user'] });
        },
    });
};

// Deprecated - use useUpdateStudysetLabels instead
export const useChangeLabel = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ studysetUUID, newLabel }: ChangeLabelRequest) => {
            // Convert single label to array for backwards compatibility
            const data = await fetchJson(
                `${BASE_API_URL}/studysets/update-studyset-labels`,
                {
                    ...(await getCommonPostRequestProps()),
                    body: JSON.stringify({ studysetUUID, labels: [newLabel] }),
                }
            );
            return validate({
                schema: BaseResponseSchema,
                data,
                type: 'response',
                context: 'ChangeLabel',
            });
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: ['studysets', variables.studysetUUID],
            });
        },
    });
};

export const useUpdateStudysetLabels = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            studysetUUID,
            labels,
        }: import('shared/types').UpdateStudysetLabelsRequest) => {
            const data = await fetchJson(
                `${BASE_API_URL}/studysets/update-studyset-labels`,
                {
                    ...(await getCommonPostRequestProps()),
                    body: JSON.stringify({ studysetUUID, labels }),
                }
            );
            return validate({
                schema: BaseResponseSchema,
                data,
                type: 'response',
                context: 'UpdateStudysetLabels',
            });
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: ['studysets', variables.studysetUUID],
            });
        },
    });
};

export const useBatchUpdateStudysetLabels = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            studysetUpdates,
        }: import('shared/types').BatchUpdateStudysetLabelsRequest) => {
            const data = await fetchJson(
                `${BASE_API_URL}/studysets/batch-update-studyset-labels`,
                {
                    ...(await getCommonPostRequestProps()),
                    body: JSON.stringify({ studysetUpdates }),
                }
            );
            return validate({
                schema: BaseResponseSchema,
                data,
                type: 'response',
                context: 'BatchUpdateStudysetLabels',
            });
        },
        onSettled: () => {
            // Invalidate on error too: a partial failure (non-2xx) may still have updated some sets
            queryClient.invalidateQueries({
                queryKey: ['studysets'],
            });
        },
    });
};
