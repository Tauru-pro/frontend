export type MediaType = 'image' | 'video';

export type MimeType = 'image/jpeg' |
    'image/png' |
    'image/webp' |
    'image/avif' |
    'video/mp4' |
    'video/webm';

export interface RequestUploadUrlDto {
    mediaType: MediaType
    mimeType: MimeType;
}

export interface ResponseUploadDto {
    uploadUrl: string;
    s3Key: string;
    expiresIn: number
}


export interface ConfirmMediaUploadDto {
    s3Key: string;
    mediaType: MediaType;
    mimeType: MimeType;
    sortOrder?: number;
    isCover?: boolean;
}