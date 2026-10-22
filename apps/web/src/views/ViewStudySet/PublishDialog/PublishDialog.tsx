import { useEffect, useState } from 'react';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    Stack,
    TextField,
    Typography,
} from '@mui/material/';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { SUBJECT_IDS } from '@quizaroni/shared-types';
import type { PublishError, SubjectId } from '@quizaroni/shared-types';
import StandardDialogTitle from 'components/StandardDialogTitle/StandardDialogTitle';
import { Studyset } from 'shared/types';
import {
    PublishStudysetError,
    usePublishStudyset,
    useUnpublishStudyset,
} from 'state/api/studysetsAPI';

type Props = {
    open: boolean;
    onClose: () => void;
    studyset: Studyset;
};

const PublishDialog = ({ open, onClose, studyset }: Props) => {
    const { t } = useTranslation();
    const publish = usePublishStudyset();
    const unpublish = useUnpublishStudyset();

    const isPublished = studyset.metadata?.publiclyViewable === true;
    const [subject, setSubject] = useState<SubjectId | ''>(
        studyset.subject ?? ''
    );
    const [errors, setErrors] = useState<PublishError[]>([]);
    const [genericError, setGenericError] = useState(false);

    useEffect(() => {
        if (open) {
            setSubject(studyset.subject ?? '');
            setErrors([]);
            setGenericError(false);
        }
    }, [open, studyset.subject]);

    const isPending = publish.isPending || unpublish.isPending;

    const clearErrors = () => {
        setErrors([]);
        setGenericError(false);
    };

    // The server is the only place the gate runs; show whatever codes it returns.
    const handleError = (error: unknown) => {
        if (error instanceof PublishStudysetError && error.errors.length > 0) {
            setErrors(error.errors);
        } else {
            setGenericError(true);
        }
    };

    const handlePublish = () => {
        if (!subject) return;
        clearErrors();
        publish.mutate(
            { studysetUUID: studyset.studysetUUID, subject },
            {
                onSuccess: () => {
                    toast.success(t('publish.success'), {
                        position: toast.POSITION.BOTTOM_LEFT,
                    });
                    onClose();
                },
                onError: handleError,
            }
        );
    };

    const handleUnpublish = () => {
        clearErrors();
        unpublish.mutate(
            { studysetUUID: studyset.studysetUUID },
            {
                onSuccess: () => {
                    toast.success(t('publish.unpublishSuccess'), {
                        position: toast.POSITION.BOTTOM_LEFT,
                    });
                    onClose();
                },
                onError: handleError,
            }
        );
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <StandardDialogTitle title={t('publish.title')} onClose={onClose} />
            <DialogContent>
                <Stack spacing={2} sx={{ pt: 1 }}>
                    {isPublished && (
                        <Typography>{t('publish.publishedStatus')}</Typography>
                    )}
                    <TextField
                        select
                        id="publish-subject"
                        label={t('publish.subjectLabel')}
                        value={subject}
                        onChange={(event) =>
                            setSubject(event.target.value as SubjectId | '')
                        }
                        SelectProps={{ native: true }}
                        // Otherwise the label overlaps the placeholder option.
                        InputLabelProps={{ shrink: true }}
                        fullWidth
                    >
                        <option value="">{t('publish.subjectPlaceholder')}</option>
                        {SUBJECT_IDS.map((id) => (
                            <option key={id} value={id}>
                                {t(`subjects.${id}`)}
                            </option>
                        ))}
                    </TextField>
                    <Typography variant="body2">
                        {t('publish.disclosure')}
                    </Typography>
                    {(errors.length > 0 || genericError) && (
                        <Alert severity="error">
                            {genericError ? (
                                t('publish.errors.generic')
                            ) : (
                                <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                                    {errors.map((error) => (
                                        <li key={error.code}>
                                            {error.code === 'notEnoughCards'
                                                ? t('publish.errors.notEnoughCards', {
                                                      required: error.required,
                                                      actual: error.actual,
                                                  })
                                                : t(`publish.errors.${error.code}`)}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Alert>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('buttons.cancel')}</Button>
                {isPublished && (
                    <Button
                        color="error"
                        onClick={handleUnpublish}
                        disabled={isPending}
                    >
                        {t('publish.unpublish')}
                    </Button>
                )}
                <Button
                    variant="contained"
                    onClick={handlePublish}
                    disabled={!subject || isPending}
                >
                    {t(isPublished ? 'publish.update' : 'publish.publish')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default PublishDialog;
