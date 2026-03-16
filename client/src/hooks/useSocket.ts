import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketOptions {
  autoConnect?: boolean;
}

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  emit: <T>(event: string, data?: T) => void;
  on: <T>(event: string, callback: (data: T) => void) => void;
  off: (event: string) => void;
}

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const { autoConnect = true } = options;
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socketUrl = import.meta.env.PROD
      ? window.location.origin
      : 'http://localhost:3000';

    socketRef.current = io(socketUrl, {
      autoConnect,
      transports: ['polling', 'websocket'], // polling первым — он поддерживает заголовки
      extraHeaders: {
        'ngrok-skip-browser-warning': 'true',
      },
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Socket CONNECTED, id:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket DISCONNECTED, reason:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.log('Socket CONNECT ERROR:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [autoConnect]);

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

  return {
    socket: socketRef.current,
    isConnected,
    connect,
    disconnect,
    emit,
    on,
    off,
  };
}
