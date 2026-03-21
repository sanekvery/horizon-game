import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketOptions {
  autoConnect?: boolean;
  sessionCode?: string | null;
}

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  isSessionJoined: boolean;
  sessionCode: string | null;
  connect: () => void;
  disconnect: () => void;
  emit: <T>(event: string, data?: T) => void;
  on: <T>(event: string, callback: (data: T) => void) => void;
  off: (event: string) => void;
  joinSession: (code: string) => void;
}

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const { autoConnect = true, sessionCode: initialSessionCode } = options;
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSessionJoined, setIsSessionJoined] = useState(false);
  const [currentSessionCode, setCurrentSessionCode] = useState<string | null>(initialSessionCode || null);

  useEffect(() => {
    const socketUrl = import.meta.env.PROD
      ? window.location.origin
      : 'http://localhost:3000';

    socketRef.current = io(socketUrl, {
      autoConnect,
      transports: ['polling', 'websocket'],
      extraHeaders: {
        'ngrok-skip-browser-warning': 'true',
      },
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Socket CONNECTED, id:', socket.id);
      setIsConnected(true);

      // Auto-join session if sessionCode is provided
      if (currentSessionCode) {
        console.log('Auto-joining session:', currentSessionCode);
        socket.emit('join:session', currentSessionCode);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket DISCONNECTED, reason:', reason);
      setIsConnected(false);
      setIsSessionJoined(false);
    });

    socket.on('connect_error', (err) => {
      console.log('Socket CONNECT ERROR:', err.message);
    });

    // Listen for session join confirmation (via game:state event)
    socket.on('game:state', () => {
      if (!isSessionJoined) {
        setIsSessionJoined(true);
      }
    });

    socket.on('session:error', (error: { message: string }) => {
      console.error('Session error:', error.message);
      setIsSessionJoined(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [autoConnect]); // Note: currentSessionCode is handled separately

  // Handle session code changes (join new session when code changes)
  useEffect(() => {
    if (isConnected && currentSessionCode && socketRef.current) {
      console.log('Joining session:', currentSessionCode);
      socketRef.current.emit('join:session', currentSessionCode);
    }
  }, [isConnected, currentSessionCode]);

  // Update currentSessionCode when initialSessionCode changes
  useEffect(() => {
    if (initialSessionCode && initialSessionCode !== currentSessionCode) {
      setCurrentSessionCode(initialSessionCode);
      setIsSessionJoined(false);
    }
  }, [initialSessionCode]);

  const connect = useCallback(() => {
    socketRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
  }, []);

  const emit = useCallback(<T,>(event: string, data?: T) => {
    socketRef.current?.emit(event, data);
  }, []);

  const on = useCallback(<T,>(event: string, callback: (data: T) => void) => {
    socketRef.current?.on(event, callback);
  }, []);

  const off = useCallback((event: string) => {
    socketRef.current?.off(event);
  }, []);

  const joinSession = useCallback((code: string) => {
    setCurrentSessionCode(code);
    if (socketRef.current?.connected) {
      socketRef.current.emit('join:session', code);
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    isSessionJoined,
    sessionCode: currentSessionCode,
    connect,
    disconnect,
    emit,
    on,
    off,
    joinSession,
  };
}
