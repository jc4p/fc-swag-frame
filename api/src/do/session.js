// api/src/do/session.js

// Placeholder for Session Management Durable Object
// Will handle WebSocket connections for real-time updates (e.g., mockup status)

export class SessionDurableObject {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        this.sessions = []; // Store WebSocket sessions
        // Potentially load state from storage
        // this.state.blockConcurrencyWhile(async () => {
        //     this.value = await this.state.storage.get("value") || 0;
        // });
    }

    // Handle HTTP requests (e.g., WebSocket upgrade)
    async fetch(request) {
        const url = new URL(request.url);

        // Handle WebSocket upgrade requests from the main worker router
        if (url.pathname.endsWith('/api/ws')) { // Match based on how router forwards
            if (request.headers.get("Upgrade") != "websocket") {
                return new Response("Expected Upgrade: websocket", { status: 400 });
            }
            const [client, server] = Object.values(new WebSocketPair());
            await this.handleSession(server);
            return new Response(null, { status: 101, webSocket: client });

        // Handle internal notification requests from other parts of the worker (e.g., webhook handler)
        } else if (url.pathname === '/notify' && request.method === 'POST') { 
            try {
                const notificationData = await request.json();
                console.log('[SessionDO] Received notification:', notificationData);
                this.broadcast(notificationData); // Broadcast the received data
                return new Response(JSON.stringify({ success: true }), { status: 200 });
            } catch (e) {
                console.error('[SessionDO] Failed to process notification:', e);
                return new Response('Invalid notification data', { status: 400 });
            }
        } else {
             // Not a WebSocket upgrade or internal notification
             return new Response('Not found', { status: 404 });
        }
    }

     // Handle WebSocket session
    async handleSession(webSocket) {
        webSocket.accept();
        this.sessions.push(webSocket);

        webSocket.addEventListener("message", async event => {
            console.log("DO received message:", event.data);
            // Echo message back or handle client messages
            // webSocket.send(JSON.stringify({ message: "DO received: " + event.data }));
        });

        webSocket.addEventListener("close", async event => {
            console.log("DO session closed");
            this.sessions = this.sessions.filter(s => s !== webSocket);
        });

         webSocket.addEventListener("error", async event => {
            console.error("DO session error:", event);
            this.sessions = this.sessions.filter(s => s !== webSocket);
        });
    }

    // Broadcast a message to all connected WebSocket clients
    broadcast(message) {
        const messageString = typeof message === 'string' ? message : JSON.stringify(message);
        console.log(`Broadcasting message to ${this.sessions.length} sessions: ${messageString}`);
        this.sessions = this.sessions.filter(session => {
            try {
                session.send(messageString);
                return true;
            } catch (err) {
                console.error("Failed to send message to session, removing:", err);
                return false; // Remove broken session
            }
        });
    }
    
     // Example of internal method callable via RPC or other means
    async notify(data) {
        console.log("DO notify called with:", data);
        this.broadcast({ type: 'notification', payload: data });
        // Persist state if needed
        // await this.state.storage.put("lastNotification", data);
    }

} 