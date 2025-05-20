import { createClient } from "@farcaster/quick-auth";

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