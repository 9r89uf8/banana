import { adminAuth } from '@/app/utils/firebaseAdmin';

export const authMiddleware = async (req) => {
    const token = req.cookies.get('tokenSV')?.value;

    if (!token) {
        console.log('No token found');
        return { authenticated: false, error: 'No token found' };
    }

    try {
        const decodedToken = await adminAuth.verifySessionCookie(token, true);
        return { authenticated: true, user: decodedToken };
    } catch (error) {
        console.error('Invalid token:', error);
        return { authenticated: false, error: 'Invalid token' };
    }
};


