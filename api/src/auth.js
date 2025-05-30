import { createClient } from "@farcaster/quick-auth";

/**
 * Middleware to verify JWT token from Authorization header.
 * Sets c.userFid if valid.
 */
export const authMiddleware = async (c, next) => {
	const authHeader = c.req.headers.get('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return c.json({ error: 'Unauthorized: Missing or invalid Authorization header.' }, 401);
	}
	const token = authHeader.substring(7); // Remove "Bearer "

	try {
        const client = createClient();

        let appDomain;
        try {
            const url = new URL(c.req.url);
            appDomain = url.port ? `${url.hostname}:${url.port}` : url.hostname;
            console.log(`Auth Middleware: Derived APP_DOMAIN: ${appDomain} from request URL: ${c.req.url}`);
        } catch (e) {
            console.error("Auth Middleware: Failed to parse request URL to derive APP_DOMAIN:", e);
            return c.json({ error: 'Server configuration error (domain parsing).' }, 500);
        }
        
        const payload = await client.verifyJwt({ token, domain: appDomain })

		if (!payload || !payload.sub) {
			throw new Error('Invalid token payload');
		}

		c.set('userFid', payload.sub);

	} catch (err) {
		console.error("Auth Middleware: Verification/Decode Error:", err.message);
		return c.json({ error: 'Unauthorized: Invalid token.' }, 401);
	}

	await next();
}; 