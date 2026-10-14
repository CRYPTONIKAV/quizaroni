import {
    Delete as DeleteIcon,
    SwapHoriz as SwapIcon,
    BrokenImage,
} from '@mui/icons-material';
import { CircularProgress, IconButton, Typography } from '@mui/material';
import { CardFileMetadata } from 'shared/types';
import { formatBytes } from 'utilities/general';
import { useState } from 'react';
// `@mui/material/styles` rather than `@mui/system`: only the former's Theme
// carries `shadows`, which the hover style below reads.
import { styled } from '@mui/material/styles';

const ImagePreviewContainer = styled('div')(({ theme }) => ({
    position: 'relative',
    width: '10rem',
    height: '7rem',
    borderRadius: '0.5rem',
    overflow: 'hidden',
    backgroundColor: theme.palette.grey[100],
    border: `1px solid ${theme.palette.divider}`,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    flexShrink: 0,
    '&:hover': {
        transform: 'translateY(-0.125rem)',
        boxShadow: theme.shadows[4],
    },
}));

const ImageElement = styled('img')({
    width: '100%',
    height: '100%',
    objectFit: 'cover',
});

const ActionOverlay = styled('div')(({ theme }) => ({
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    opacity: 0,
    transition: 'opacity 0.2s ease',
    '&:hover': {
        opacity: 1,
    },
}));

const FileInfo = styled('div')(({ theme }) => ({
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    padding: '0.375rem 0.5rem',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    color: theme.palette.common.white,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
}));

const BrokenImageContainer = styled('div')(({ theme }) => ({
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.25rem',
    color: theme.palette.text.secondary,
    padding: '0.5rem',
}));

const LoadingContainer = styled('div')({
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 10,
});

interface ImagePreviewProps {
    file: CardFileMetadata;
    onDelete: (fileKey: string) => void;
    onReplace?: (fileKey: string) => void;
    isDeleting?: boolean;
}

const ImagePreview = ({
    file,
    onDelete,
    onReplace,
    isDeleting = false,
}: ImagePreviewProps) => {
    const [imageError, setImageError] = useState(false);
    const [showActions, setShowActions] = useState(false);

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(file.key);
    };

    const handleReplace = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onReplace) {
            onReplace(file.key);
        }
    };

    return (
        <ImagePreviewContainer
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
        >
            {imageError ? (
                <BrokenImageContainer>
                    <BrokenImage fontSize="large" />
                    <Typography variant="caption">Failed to load</Typography>
                </BrokenImageContainer>
            ) : (
                <>
                    <ImageElement
                        src={file.signedURL}
                        alt={file.name}
                        onError={() => setImageError(true)}
                        loading="lazy"
                    />
                    {showActions && !isDeleting && (
                        <ActionOverlay>
                            <IconButton
                                onClick={handleDelete}
                                size="small"
                                sx={{ color: 'white' }}
                                title="Delete image"
                                aria-label="Delete image"
                            >
                                <DeleteIcon />
                            </IconButton>
                            {onReplace && (
                                <IconButton
                                    onClick={handleReplace}
                                    size="small"
                                    sx={{ color: 'white' }}
                                    title="Replace image"
                                    aria-label="Replace image"
                                >
                                    <SwapIcon />
                                </IconButton>
                            )}
                        </ActionOverlay>
                    )}
                </>
            )}
            {isDeleting && (
                <LoadingContainer>
                    <CircularProgress size={24} sx={{ color: 'white' }} />
                </LoadingContainer>
            )}
            <FileInfo>
                <Typography
                    variant="caption"
                    noWrap
                    sx={{ fontSize: '0.625rem' }}
                >
                    {file.name}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.625rem' }}>
                    {formatBytes(file.size)}
                </Typography>
            </FileInfo>
        </ImagePreviewContainer>
    );
};

export default ImagePreview;
