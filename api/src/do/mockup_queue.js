// api/src/do/mockup_queue.js

// Placeholder for Mockup Generation Queue Durable Object
// Will accept jobs, store them, and potentially process them or call external APIs (like Printful mockup API)

export class MockupQueueDurableObject {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        // Consider using storage for persistent queue
        // this.queue = []; 
    }

    // Handle HTTP requests to enqueue jobs
    async fetch(request) {
        if (request.method === 'POST') {
            try {
                const jobData = await request.json();
                console.log('DO MockupQueue: Received job:', jobData);
                // TODO: Add job to a persistent queue (e.g., using this.state.storage.put)
                // Example: await this.enqueueJob(jobData);
                 await this.triggerProcessing(); // Maybe trigger processing immediately or via alarm
                return new Response(JSON.stringify({ success: true, message: 'Job enqueued' }), { status: 202 });
            } catch (err) {
                console.error("DO MockupQueue: Error processing enqueue request:", err);
                return new Response(JSON.stringify({ success: false, message: 'Failed to parse job data' }), { status: 400 });
            }
        } else {
             return new Response('Method Not Allowed', { status: 405 });
        }
    }

    // Example: Add job to storage (implement actual logic as needed)
    async enqueueJob(jobData) {
        const jobId = crypto.randomUUID();
        await this.state.storage.put(`job_${jobId}`, jobData);
        // Optionally, keep an index of job IDs
        let jobIndex = await this.state.storage.get('job_index') || [];
        jobIndex.push(jobId);
        await this.state.storage.put('job_index', jobIndex);
        console.log(`Enqueued job ${jobId}`);

        // Set an alarm to process the queue later if not already set
        let currentAlarm = await this.state.storage.getAlarm();
        if (currentAlarm == null) {
            console.log(`Setting alarm to process queue...`);
            // Set alarm 10 seconds from now (adjust as needed)
            await this.state.storage.setAlarm(Date.now() + 10 * 1000); 
        }
    }

    // Process the queue (e.g., call Printful API)
    async processQueue() {
        console.log("DO MockupQueue: Processing queue...");
         let jobIndex = await this.state.storage.get('job_index') || [];
         if (jobIndex.length === 0) {
             console.log("Queue is empty.");
             return;
         }

         const jobIdToProcess = jobIndex.shift(); // Get the oldest job
         const jobData = await this.state.storage.get(`job_${jobIdToProcess}`);

         if (jobData) {
            console.log(`Processing job ${jobIdToProcess}:`, jobData);
            // TODO: Implement Printful mockup API call here
            // const printfulApiKey = this.env.PRINTFUL_API_KEY;
            // const designId = jobData.designId; // Assuming jobData contains necessary info
            // ... call Printful ...
            // const mockupResult = await callPrintfulMockupAPI(designId, printfulApiKey);
            
            // TODO: Update D1 with mockup URL (requires DB binding in DO)
            // await this.env.DB.prepare('UPDATE designs SET mockup_url = ? WHERE id = ?').bind(mockupResult.url, designId).run();
            
            // TODO: Notify session DO (requires DO binding)
            // const sessionDO = this.env.SESSION_DO.get(this.env.SESSION_DO.idFromName(jobData.sessionId)); // Example ID
            // await sessionDO.notify({ type: 'mockup_ready', designId: designId, url: mockupResult.url });
            
            // Delete job from storage
            await this.state.storage.delete(`job_${jobIdToProcess}`);
            await this.state.storage.put('job_index', jobIndex); // Update index
             console.log(`Finished processing job ${jobIdToProcess}`);
         } else {
             console.warn(`Job data for ID ${jobIdToProcess} not found.`);
             // Still update index if job data missing
             await this.state.storage.put('job_index', jobIndex);
         }

         // If there are more jobs, set the alarm again
         if (jobIndex.length > 0) {
             await this.state.storage.setAlarm(Date.now() + 1000); // Process next one soon
         }
    }
    
    // Used to trigger processing either immediately or via alarm
    async triggerProcessing() {
        // For simplicity now, just call process directly. Use alarms for production.
         await this.processQueue();
    }

    // Alarm handler to process the queue periodically
    async alarm() {
        console.log("DO MockupQueue: Alarm triggered!");
        await this.processQueue();
    }
} 