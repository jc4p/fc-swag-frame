import { Hono } from 'hono';

const imageUtils = new Hono();

// Route to remove background using Pixian AI
imageUtils.post('/remove-background', async (c) => {
  const { PIXIAN_API_ID, PIXIAN_API_SECRET } = c.env;

  if (!PIXIAN_API_ID || !PIXIAN_API_SECRET) {
    console.error('Pixian API credentials missing in environment variables.');
    return c.json({ error: 'Configuration error', message: 'Background removal service is not configured.' }, 500);
  }

  try {
    const formData = await c.req.formData();
    const imageFile = formData.get('image');

    if (!imageFile || !(imageFile instanceof File || imageFile instanceof Blob)) {
      return c.json({ error: 'Bad Request', message: 'No image file provided or invalid format.' }, 400);
    }

    // Prepare FormData to send to Pixian
    const pixianFormData = new FormData();
    pixianFormData.append('image', imageFile, imageFile.name || 'image_to_process.png'); // Use original name if available
    pixianFormData.append('output_format', 'png');
    pixianFormData.append('result.crop_to_foreground', 'true');

    // Encode credentials for Basic Auth
    const credentials = btoa(`${PIXIAN_API_ID}:${PIXIAN_API_SECRET}`);

    const pixianApiUrl = 'https://api.pixian.ai/api/v2/remove-background';

    console.log(`Calling Pixian API for background removal...`);

    const pixianResponse = await fetch(pixianApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        // 'Content-Type' is set automatically by fetch when using FormData body
      },
      body: pixianFormData,
    });

    if (!pixianResponse.ok) {
      let errorBody = 'Failed to parse Pixian error response.';
      try {
         errorBody = await pixianResponse.text();
      } catch (e) { /* Ignore parsing error */ }
      console.error(`Pixian API Error: ${pixianResponse.status} ${pixianResponse.statusText}`, errorBody);
      return c.json({ error: 'Background removal failed', message: `Upstream service returned status ${pixianResponse.status}. ${errorBody}` }, 502); // 502 Bad Gateway
    }

    console.log(`Pixian API call successful.`);

    // Get the resulting image as a Blob
    const resultBlob = await pixianResponse.blob();

    // Return the resulting image blob directly to the client
    // Set appropriate headers for the client
    c.header('Content-Type', resultBlob.type || 'image/png'); // Use type from Pixian if available, else default
    c.header('Content-Disposition', 'inline; filename="background_removed.png"'); // Suggest filename
    
    return c.body(resultBlob);

  } catch (error) {
    console.error('Error processing background removal request:', error);
    if (error instanceof Error) {
        return c.json({ error: 'Internal Server Error', message: error.message }, 500);
    } else {
        return c.json({ error: 'Internal Server Error', message: 'An unknown error occurred.' }, 500);
    }
    
  }
});

export default imageUtils; 