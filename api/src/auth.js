import { createAppClient, viemConnector } from '@farcaster/auth-client';
import { sign, verify } from '@tsndr/cloudflare-worker-jwt';
import { createClient } from "@farcaster/quick-auth";

/**
 * Handles the Sign-In With Farcaster verification and JWT issuance.
 * @param {Request} request - The incoming request object.
 * @param {object} env - The worker environment object (must contain AUTH_SECRET).
 * @returns {Promise<Response>} - A Response object with the JWT or an error.
 */
export async function handleSignIn(request, env) {
    // --- Dynamically derive APP_DOMAIN from request URL ---
    let appDomain;
    try {
        const url = new URL(request.url);
        appDomain = url.port ? `${url.hostname}:${url.port}` : url.hostname;
        console.log(`handleSignIn: Derived APP_DOMAIN: ${appDomain} from request URL: ${request.url}`);
    } catch (e) {
        console.error("handleSignIn: Failed to parse request URL to derive APP_DOMAIN:", e);
        return Response.json({ success: false, message: 'Server configuration error (domain parsing).' }, { status: 500 });
    }
    // ---

    const { message, signature, nonce } = await request.json();

    if (!message || !signature || !nonce) {
        return Response.json({ success: false, message: 'Missing message, signature, or nonce.' }, { status: 400 });
    }

    if (!env.AUTH_SECRET) {
        console.error("handleSignIn: AUTH_SECRET environment variable not set!");
        return Response.json({ success: false, message: 'Authentication system configuration error.' }, { status: 500 });
    }

    try {
        // TODO: Consider adding nonce validation
        console.log(`handleSignIn: Verifying SIWF message for domain: ${appDomain}...`);

        const appClient = createAppClient({
            ethereum: viemConnector() // Assumes viem is available
        });

        const verifyResponse = await appClient.verifySignInMessage({
            message,
            signature,
            domain: appDomain,
            nonce,
        });

        // Use `.success` based on user's update
        if (!verifyResponse.success) { 
            console.error('handleSignIn: SIWF verification failed:', verifyResponse.error);
            const errorDetail = verifyResponse.error?.message || 'Unknown verification error';
            return Response.json({ success: false, message: `Signature verification failed: ${errorDetail}` }, { status: 401 });
        }

        const fid = verifyResponse.fid;
        console.log(`handleSignIn: Verification successful for FID: ${fid} (verified against domain: ${verifyResponse.domain})`);

        // --- Issue JWT ---
        const payload = {
            sub: fid.toString(),
            fid: fid, // Include fid directly as per user's update
            iss: appDomain,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days expiry
        };

        const token = await sign(payload, env.AUTH_SECRET);
        console.log(`handleSignIn: JWT issued for FID: ${fid}`);
        // ---

        return Response.json({ success: true, token: token, fid: fid });

    } catch (error) {
        console.error('handleSignIn: Error during SIWF verification or JWT signing:', error);
        let errorMessage = 'An unexpected error occurred during sign-in.';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        return Response.json({ success: false, message: errorMessage }, { status: 500 });
    }
}

/**
 * Verifies a JWT token.
 * @param {string} token - The JWT string.
 * @param {string} secret - The secret key used for signing.
 * @returns {Promise<{isValid: boolean, payload?: object, error?: string}>} - Verification result.
 */
export async function verifyToken(token, secret) {
    try {
        const isValid = await verify(token, secret);
        if (!isValid) {
             return { isValid: false, error: 'Invalid token signature.' };
        }
        // Decode payload without verification (since we already verified signature)
        // Note: @tsndr/cloudflare-worker-jwt verify() only checks signature & expiry
        // For full claim validation (iss, aud, etc.), you might need another library or manual checks
        const { payload } = decode(token);
        // Optional: Check expiry again just to be sure (verify should handle it though)
        if (payload.exp && payload.exp * 1000 < Date.now()) {
            return { isValid: false, error: 'Token expired.' };
        }
        return { isValid: true, payload: payload };
    } catch (err) {
        console.error("Token verification error:", err);
         if (err.message === 'Expired JWT') {
             return { isValid: false, error: 'Token expired.' };
         }
        return { isValid: false, error: 'Invalid token format or verification failed.' };
    }
}

// Helper function to decode JWT payload (needed because verify only returns boolean)
function decode(token) {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new Error('Invalid token format');
    }
    const [header, payload, signature] = parts;
    const decodedPayload = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    const decodedHeader = JSON.parse(atob(header.replace(/-/g, '+').replace(/_/g, '/')));
    return { header: decodedHeader, payload: decodedPayload, signature };
}

/**
 * Middleware to verify JWT token from Authorization header.
 * Sets c.userFid if valid.
 */
export const authMiddleware = async (c, next) => {
	// console.log("Auth Middleware triggered"); // Removed
	const authHeader = c.req.headers.get('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		// console.log("Auth Middleware: Missing/invalid header"); // Removed
		return c.json({ error: 'Unauthorized: Missing or invalid Authorization header.' }, 401);
	}
	const token = authHeader.substring(7); // Remove "Bearer "
	const secret = c.env.AUTH_SECRET;
	
	if (!secret) {
		console.error("Auth Middleware: AUTH_SECRET missing in environment!");
		return c.json({ error: 'Server configuration error.' }, 500);
	}

	// console.log(`Auth Middleware: Verifying token (first 10 chars): ${token.substring(0, 10)}...`); // Removed
	// console.log(`Auth Middleware: Using secret (type: ${typeof secret}, length: ${secret?.length})`); // Removed

	try {
		// console.log("Auth Middleware: Attempting jwt.verify..."); // Removed
		// const isValid = await verify(token, secret, { algorithm: 'HS256' }); 
		// console.log(`Auth Middleware: jwt.verify result: ${isValid}`); // Removed

        const client = createClient();

        let appDomain;
        try {
            const url = new URL(request.url);
            appDomain = url.port ? `${url.hostname}:${url.port}` : url.hostname;
            console.log(`handleSignIn: Derived APP_DOMAIN: ${appDomain} from request URL: ${request.url}`);
        } catch (e) {
            console.error("handleSignIn: Failed to parse request URL to derive APP_DOMAIN:", e);
            return Response.json({ success: false, message: 'Server configuration error (domain parsing).' }, { status: 500 });
        }
        
        const payload = await client.verifyJwt({ token, domain })

		if (!payload || !payload.sub) {
			// console.error("Auth Middleware: Token payload invalid or missing fid"); // Removed
			throw new Error('Invalid token payload');
		}

		c.set('userFid', payload.sub);
		// console.log(`Auth Middleware: FID ${payload.fid} authorized and set in context.`); // Removed

	} catch (err) {
		console.error("Auth Middleware: Verification/Decode Error:", err.message); // Keep this error log
		return c.json({ error: 'Unauthorized: Invalid token.' }, 401);
	}

	// console.log("Auth Middleware: Proceeding to next handler..."); // Removed
	await next();
}; 