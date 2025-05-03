import { describe, expect, it, beforeAll } from 'bun:test';
import jwt from '@tsndr/cloudflare-worker-jwt'; // For generating test JWT
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .dev.vars
dotenv.config({ path: path.resolve(__dirname, '../.dev.vars') });

// Helper function to create a dummy image file Blob for testing
function createDummyImageFile(filename = 'test.png', type = 'image/png', size = 1024) {
    const buffer = new ArrayBuffer(size);
    return new File([buffer], filename, { type });
}

describe('Designs API Endpoint (Live Dev Server)', () => {
    let testToken; // JWT for authenticated requests
    const TEST_FID = 12345; // Example Farcaster ID for testing
    // Get AUTH_SECRET from environment (loaded from .dev.vars)
    const AUTH_SECRET = process.env.AUTH_SECRET;
    let testProductId = 1; // From previous DB query
    let testVariantId = 1; // From previous DB query
    const BASE_URL = 'http://localhost:8787'; // Target the running dev server

    beforeAll(async () => {
        if (!AUTH_SECRET) {
            throw new Error('AUTH_SECRET not found in environment. Make sure it is set in api/.dev.vars');
        }
        // Generate a test JWT token, explicitly setting HS256
        testToken = await jwt.sign({ fid: TEST_FID }, AUTH_SECRET, { algorithm: 'HS256' });
        console.log(`Using testToken: ${testToken.substring(0, 10)}...`);
        console.log(`Using test FID: ${TEST_FID}`);
        console.log(`Using test Product ID: ${testProductId}, Variant ID: ${testVariantId}`);
    });

    // No worker setup/teardown needed

    it('POST /api/designs should create a design with valid data', async () => {
        const formData = new FormData();
        formData.append('product_id', testProductId.toString());
        formData.append('variant_id', testVariantId.toString());
        formData.append('image', createDummyImageFile('actual_test.png')); // Give a unique name

        const resp = await fetch(`${BASE_URL}/api/designs`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${testToken}`
                // Content-Type is set automatically by FormData
            },
            body: formData,
        });

        expect(resp.status).toBe(201); // Check for Created status
        const json = await resp.json();
        expect(json.success).toBe(true);
        expect(json.designId).toBeDefined();
        expect(json.designId).toBeGreaterThan(0);
        expect(json.imageUrl).toBeDefined();
        // Check against R2_PUBLIC_URL from env
        const expectedUrlPrefix = `${process.env.R2_PUBLIC_URL}/user-images/${TEST_FID}/${testProductId}/`;
        expect(json.imageUrl).toStartWith(expectedUrlPrefix);
        expect(json.imageUrl).toEndWith('.png');
    });

    it('POST /api/designs should fail without authentication', async () => {
        const formData = new FormData();
        formData.append('product_id', testProductId.toString());
        formData.append('variant_id', testVariantId.toString());
        formData.append('image', createDummyImageFile());

        const resp = await fetch(`${BASE_URL}/api/designs`, {
            method: 'POST',
            body: formData,
        });
        expect(resp.status).toBe(401); // Unauthorized
        const json = await resp.json();
        expect(json.error).toContain('Unauthorized');
    });

    it('POST /api/designs should fail with missing required fields', async () => {
        const formData = new FormData();
        // Missing product_id and image
        formData.append('variant_id', testVariantId.toString());

        const resp = await fetch(`${BASE_URL}/api/designs`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${testToken}`
            },
            body: formData,
        });
        expect(resp.status).toBe(400); // Bad Request
        const json = await resp.json();
        expect(json.success).toBe(false);
        expect(json.message).toContain('Missing required fields');
    });

     it('POST /api/designs should fail with invalid variant_id (foreign key)', async () => {
        const formData = new FormData();
        formData.append('product_id', testProductId.toString());
        formData.append('variant_id', '999999'); // Non-existent variant ID
        formData.append('image', createDummyImageFile());

        const resp = await fetch(`${BASE_URL}/api/designs`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${testToken}`
            },
            body: formData,
        });
        expect(resp.status).toBe(400); // Bad Request due to FK constraint
        const json = await resp.json();
        expect(json.success).toBe(false);
        expect(json.message).toContain('Invalid product_id or variant_id');
    });

    // TODO: Add test for GET /api/designs (listing designs for the user)
}); 