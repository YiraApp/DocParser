import { useEffect, useRef, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export const useWebSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const isConnectingRef = useRef(false);

  useEffect(() => {
    if (isConnectingRef.current || socketRef.current?.connected) return;
    
    isConnectingRef.current = true;
    console.log('[useWebSocket] Attempting connection to', SOCKET_URL);

    socketRef.current = io(SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ['websocket'],
    });

    socketRef.current.on('connect', () => {
      console.log('[useWebSocket] ? Connected:', socketRef.current?.id);
      isConnectingRef.current = false;
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('[useWebSocket] ? Disconnected:', reason);
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('[useWebSocket] Connection error:', error);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        isConnectingRef.current = false;
      }
    };
  }, []);

  const subscribeToDocument = useCallback((documentId: string, jobId: string) => {
    if (!socketRef.current?.connected) {
      console.warn('[useWebSocket] Socket not connected, queuing subscription');
      setTimeout(() => subscribeToDocument(documentId, jobId), 1000);
      return;
    }

    console.log('[useWebSocket] Subscribing to job:', jobId, 'document:', documentId);
    socketRef.current?.emit('subscribe-document', { documentId, jobId });
  }, []);

  const unsubscribeFromDocument = useCallback((documentId: string) => {
    console.log('[useWebSocket] Unsubscribing from document:', documentId);
    socketRef.current?.emit('unsubscribe-document', { documentId });
  }, []);

  const onDocumentUpdate = useCallback(
    (jobId: string, callback: (data: any) => void) => {
      if (!socketRef.current) return;

      const eventName = `document-update-${jobId}`;
      console.log('[useWebSocket] Listening for:', eventName);

      socketRef.current.on(eventName, (data) => {
        console.log('[useWebSocket] Received update:', eventName, data);
        callback(data);
      });

      return () => {
        socketRef.current?.off(eventName, callback);
      };
    },
    []
  );

  return {
    socket: socketRef.current,
    subscribeToDocument,
    unsubscribeFromDocument,
    onDocumentUpdate,
    isConnected: socketRef.current?.connected || false,
  };
};
