const { createServer } = require('http');
const { Server } = require('socket.io');

// Create HTTP server
const httpServer = createServer();

// Create Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket"],
  pingInterval: 25000,
  pingTimeout: 20000,
});

const subscriptions = new Map();

io.on("connection", (socket) => {
  console.log(`? [WEBSOCKET] Client connected: ${socket.id}`);

  socket.on("subscribe-document", (data) => {
    const { documentId, jobId } = data;
    console.log(`[WEBSOCKET] Document subscription: ${documentId} (Job: ${jobId})`);

    if (!subscriptions.has(documentId)) {
      subscriptions.set(documentId, new Set());
    }

    subscriptions.get(documentId).add(socket.id);
    socket.join(`document-${documentId}`);

    console.log(
      `[WEBSOCKET] Socket ${socket.id} subscribed to document-${documentId}`,
      `Total subscribers: ${subscriptions.get(documentId).size}`
    );
  });

  socket.on("unsubscribe-document", (data) => {
    const { documentId } = data;
    console.log(`[WEBSOCKET] Unsubscribing from: ${documentId}`);

    const subs = subscriptions.get(documentId);
    if (subs) {
      subs.delete(socket.id);
      if (subs.size === 0) {
        subscriptions.delete(documentId);
      }
    }

    socket.leave(`document-${documentId}`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`? [WEBSOCKET] Disconnected: ${socket.id} - ${reason}`);

    // Clean up subscriptions
    subscriptions.forEach((subs, docId) => {
      if (subs.has(socket.id)) {
        subs.delete(socket.id);
        if (subs.size === 0) {
          subscriptions.delete(docId);
        }
      }
    });
  });

  socket.on("error", (error) => {
    console.error(`[WEBSOCKET] Error for ${socket.id}:`, error);
  });
});

// ? NEW: Create HTTP server to handle status updates from backend
const statusUpdateServer = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/emit-status') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { documentId, status, error } = data;

        if (!documentId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing documentId' }));
          return;
        }

        console.log(`[WEBSOCKET] ?? Received status update: ${documentId} -> ${status}`);

        // Emit to the document room
        io.to(`document-${documentId}`).emit('document-status-update', {
          documentId,
          status,
          error: error || undefined,
          timestamp: new Date().toISOString(),
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error('[WEBSOCKET] Error parsing status update:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

// Expose global io for use in routes
global.io = io;

const PORT = process.env.SOCKET_PORT || 3001;
const STATUS_PORT = process.env.STATUS_UPDATE_PORT || 3002;

httpServer.listen(PORT, () => {
  console.log(`?? [WEBSOCKET SERVER] listening on port ${PORT}`);
});

statusUpdateServer.listen(STATUS_PORT, () => {
  console.log(`?? [STATUS UPDATE SERVER] listening on port ${STATUS_PORT}`);
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing server");
  httpServer.close(() => {
    console.log("WebSocket server closed");
    process.exit(0);
  });
  statusUpdateServer.close(() => {
    console.log("Status update server closed");
  });
});
