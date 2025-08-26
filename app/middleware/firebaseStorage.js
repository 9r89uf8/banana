import {adminDb} from '@/app/utils/firebaseAdmin';
const { v4: uuidv4 } = require('uuid');


const bucket = adminDb.storage().bucket('gs://aibase-e0537.firebasestorage.app');

const uploadToFirebaseStorage = async (buffer, fileName, contentType) => {
    try {
        const file = bucket.file(fileName);

        const options = {
            metadata: {
                contentType: contentType,
                metadata: {
                    firebaseStorageDownloadTokens: uuidv4(),
                }
            },
            resumable: false // Set to false for small files
        };

        // Upload the file
        await file.save(buffer, options);

        // Generate a download URL
        const [metadata] = await file.getMetadata();
        const downloadToken = metadata.metadata.firebaseStorageDownloadTokens;

        // Construct the download URL
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media&token=${downloadToken}`;

        return publicUrl;
    } catch (error) {
        console.error('Error uploading to Firebase Storage:', error);
        throw new Error('Failed to upload file to storage');
    }
};

export {
    uploadToFirebaseStorage
};
