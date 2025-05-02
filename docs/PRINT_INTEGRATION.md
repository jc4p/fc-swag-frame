# T-Shirt Mockup Generator Architecture

## System Architecture Diagram

```
┌─────────────────┐     ┌────────────────────┐
│                 │     │                    │
│  Client Browser │◄────►  Hono API Router   │
│  (WebSockets)   │     │  (Worker)          │
│                 │     │                    │
└────────┬────────┘     └─────────┬──────────┘
         │                        │
         │                        │
         │                        ▼
         │              ┌────────────────────┐      ┌───────────────────┐
         │              │                    │      │                   │
         └──────────────►  Session Manager   │◄─────►  Mockup API       │
                        │  (Durable Object)  │      │  (External)       │
                        │                    │      │                   │
                        └─────────┬──────────┘      └───────────────────┘
                                  │
                                  │
                                  ▼
                        ┌────────────────────┐      ┌───────────────────┐
                        │                    │      │                   │
                        │  Task Queue        │◄─────►  Product List API │
                        │  (In-Memory)       │      │  (External)       │
                        │                    │      │                   │
                        └─────────┬──────────┘      └───────────────────┘
                                  │
                                  │
                        ┌─────────▼──────────┐
                        │                    │
                        │  Webhook Handler   │
                        │  (Worker Route)    │
                        │                    │
                        └────────────────────┘
```

## Module Details with Data Flow

### 1. Hono API Router (Worker)

**Purpose:**
Central entry point for all client requests, routing traffic to appropriate handlers and managing WebSocket connections.

**Inputs:**
- HTTP requests from clients (image uploads, task submissions)
- WebSocket connection requests
- Webhook callbacks from external APIs
- User authentication data

**Outputs:**
- WebSocket connection upgrades to clients
- HTTP responses for non-WebSocket requests
- Forwarded requests to Durable Objects
- Optimized image URLs (via Cloudflare Images)

**Data Storage:**
- No persistent storage (stateless)
- Temporary storage for request processing only
- Routes requests to correct Durable Object based on user ID

**Implementation Phases:**

**Minimal Build Requirements:**
- Set up basic Hono app with Bun.js
- Implement WebSocket upgrade endpoint
- Create route to forward requests to Durable Objects
- Basic error handling and logging

**Next Steps:**
- Implement Cloudflare Images integration for image optimization
- Add authentication for API requests
- Expand webhook handling capabilities

**Further Improvements:**
- Add HTTP fallback routes for browsers without WebSocket support
- Implement request validation middleware
- Add monitoring and analytics endpoints

**Optional Performance Enhancements:**
- Cache frequent API responses with Cloudflare Cache API
- Implement connection pooling for external API calls
- Add rate limiting for incoming client requests

### 2. Session Manager (Durable Object)

**Purpose:**
Maintains WebSocket connections and session state, manages task processing, and handles rate limiting to external APIs.

**Inputs:**
- WebSocket connections from clients (via Router)
- Task submission requests from clients
- Task completion notifications (from Webhook Handler)
- Rate limit information from external APIs

**Outputs:**
- Real-time status updates to clients via WebSocket
- API requests to external mockup/product listing APIs
- Task data to internal Task Queue
- Command to redirect client on task completion

**Data Storage:**
- In-memory storage of active WebSocket connections
- In-memory session state (user preferences, etc.)
- No persistent storage beyond DO lifetime
- Task-to-client mapping for notification routing

**Implementation Phases:**

**Minimal Build Requirements:**
- Basic Durable Object class implementation
- WebSocket connection acceptance and storage
- Simple task submission and tracking
- Straightforward API call implementation

**Next Steps:**
- Implement rate limit tracking and backoff strategy
- Add task queue with priority handling
- Build real-time status updates via WebSocket
- Create cleanup routines for completed tasks

**Further Improvements:**
- Implement session timeout and cleanup
- Add sophisticated retry logic with exponential backoff
- Create batching mechanisms for API requests
- Develop error recovery strategies

**Optional Performance Enhancements:**
- Implement adaptive rate limiting based on API response
- Add memory usage optimization techniques
- Create connection load balancing between multiple DOs
- Implement selective persistence for important state

### 3. Task Queue (In-Memory Component)

**Purpose:**
Manages processing order of tasks, handles rate limiting, and ensures optimal throughput to external APIs.

**Inputs:**
- New task requests from Session Manager
- Rate limit status updates
- Task completion notifications
- Priority changes from business logic

**Outputs:**
- Tasks ready for processing
- Queue position updates to Session Manager
- API requests to external services
- Queue analytics and metrics

**Data Storage:**
- In-memory array/priority queue of pending tasks
- Task metadata (creation time, retry count, etc.)
- Rate limit tracking counters
- No persistent storage (exists within Durable Object)

**Implementation Phases:**

**Minimal Build Requirements:**
- Simple array-based queue implementation
- Basic FIFO processing logic
- Task status tracking (pending, processing, complete)

**Next Steps:**
- Add priority queue capabilities
- Implement position tracking and updates
- Add task timeout handling
- Build task type differentiation (mockup vs. product listing)

**Further Improvements:**
- Add retry counting and failure handling
- Implement task dependencies (if applicable)
- Build task result caching
- Develop queue analytics

**Optional Performance Enhancements:**
- Implement batch processing capabilities
- Add adaptive timing based on API performance
- Create predictive queue position estimation
- Build smart task scheduling based on historical performance

### 4. Webhook Handler

**Purpose:**
Receives and processes callbacks from external APIs about task completion status.

**Inputs:**
- Webhook HTTP requests from external APIs
- Task completion notifications
- Error notifications from external APIs
- Authentication data for webhook verification

**Outputs:**
- Task status updates to Session Manager
- Completion notifications to appropriate clients
- Webhook receipt confirmations to external APIs
- Error logging for failed webhooks

**Data Storage:**
- No persistent storage (stateless)
- Temporary storage for webhook validation
- Routes notifications to correct Durable Object

**Implementation Phases:**

**Minimal Build Requirements:**
- Basic endpoint for receiving webhook callbacks
- Simple validation of incoming webhook data
- Forward notifications to appropriate Durable Object

**Next Steps:**
- Add signature validation for webhooks
- Implement webhook retry acceptance
- Build logging for webhook events
- Create error handling for malformed webhooks

**Further Improvements:**
- Add webhook event batching
- Implement webhook timeout handling
- Create webhook monitoring dashboard
- Build webhook failure alerting

**Optional Performance Enhancements:**
- Implement webhook rate limiting
- Add adaptive webhook processing based on load
- Create webhook event deduplication
- Build webhook payload optimization

### 5. Client-Side Implementation

**Purpose:**
Provides user interface for submitting mockup requests and displays real-time task status updates.

**Inputs:**
- User interactions (file uploads, form submissions)
- WebSocket messages from Session Manager
- Task status updates
- Completed mockup URLs

**Outputs:**
- WebSocket connection to server
- Task submission requests
- User interface updates
- File uploads to server

**Data Storage:**
- Browser localStorage for user preferences
- Session storage for current tasks
- IndexedDB for offline support (optional)
- No server-side storage

**Implementation Phases:**

**Minimal Build Requirements:**
- Basic WebSocket connection to worker
- Simple message handling for task updates
- Task submission functionality
- Status display UI

**Next Steps:**
- Add reconnection logic for WebSocket
- Implement fallback to HTTP polling
- Build comprehensive status displays
- Create image upload with preview

**Further Improvements:**
- Add offline support and queue persistence
- Implement progressive enhancement
- Build responsive UI for different devices
- Create error recovery and retry UI

**Optional Performance Enhancements:**
- Implement connection quality monitoring
- Add adaptive update frequency based on status
- Create bandwidth usage optimization
- Build predictive UI updates

## Data Flow Summary

1. **Client → Router**:
   - Image uploads
   - Task specifications (product ID, variant IDs, etc.)
   - WebSocket connection requests

2. **Router → Session Manager**:
   - Upgraded WebSocket connections
   - User identification
   - Task metadata

3. **Session Manager → Task Queue**:
   - Task specifications
   - Priority information
   - Rate limit status

4. **Task Queue → External APIs**:
   - API requests with proper rate limiting
   - Image URLs and product specifications
   - Authentication credentials

5. **External APIs → Webhook Handler**:
   - Task completion notifications
   - Generated mockup URLs
   - Error information

6. **Webhook Handler → Session Manager**:
   - Task status updates
   - Result URLs
   - Client notification instructions

7. **Session Manager → Client**:
   - Real-time status updates
   - Queue position information
   - Completion notifications with result URLs
   - Redirect commands

This architecture provides clear separation of concerns, efficient data flow, and minimal persistent storage requirements while maintaining real-time communication with clients.
