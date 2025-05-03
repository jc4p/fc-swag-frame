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

        if (url.pathname === '/api/ws') {
            // Expecting a WebSocket upgrade request
            if (request.headers.get("Upgrade") != "websocket") {
                return new Response("Expected Upgrade: websocket", { status: 400 });
            }

            // Create the WebSocket pair
            const [client, server] = Object.values(new WebSocketPair());

            // Accept the connection
            await this.handleSession(server);

            // Return the client endpoint to the runtime
            return new Response(null, { status: 101, webSocket: client });
        } else {
             // Can add other methods if needed, e.g., POST to notify
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