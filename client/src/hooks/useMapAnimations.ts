import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './useSocket';
import type { ZoneName, ResourceName } from '../types/game-state';

export interface ResourceContributedEvent {
  zone: ZoneName;
  resource: ResourceName;
  amount: number;
  roleId: number;
  roleName: string;
  newTotal: number;
}

export interface ZoneUpgradedEvent {
  zone: ZoneName;
  fromLevel: number;
  toLevel: number;
}

export interface EventStartedEvent {
  eventId: number;
  isDilemma?: boolean;
}

export interface EventEndedEvent {
  eventId: number;
}

export type AnimationType = 'resource-flow' | 'zone-upgrade' | 'event-start' | 'event-end';

export interface AnimationQueueItem {
  id: string;
  type: AnimationType;
  data: ResourceContributedEvent | ZoneUpgradedEvent | EventStartedEvent | EventEndedEvent;
  startTime: number;
}

interface UseMapAnimationsOptions {
  sessionCode: string;
  enabled?: boolean;
}

let animationIdCounter = 0;

const generateAnimationId = (): string => {
  animationIdCounter += 1;
  return `anim-${Date.now()}-${animationIdCounter}`;
};

export function useMapAnimations({ sessionCode, enabled = true }: UseMapAnimationsOptions) {
  const [animationQueue, setAnimationQueue] = useState<AnimationQueueItem[]>([]);
  const { socket, isConnected } = useSocket({ sessionCode, autoConnect: true });
  const listenersAttached = useRef(false);

  const addToQueue = useCallback((type: AnimationType, data: AnimationQueueItem['data']) => {
    if (!enabled) return;

    const item: AnimationQueueItem = {
      id: generateAnimationId(),
      type,
      data,
      startTime: Date.now(),
    };

    setAnimationQueue(prev => [...prev, item]);
  }, [enabled]);

  const removeFromQueue = useCallback((id: string) => {
    setAnimationQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    setAnimationQueue([]);
  }, []);

  // Get current animation of a specific type
  const getCurrentAnimation = useCallback((type: AnimationType): AnimationQueueItem | undefined => {
    return animationQueue.find(item => item.type === type);
  }, [animationQueue]);

  // Get all animations for a specific zone
  const getZoneAnimations = useCallback((zone: ZoneName): AnimationQueueItem[] => {
    return animationQueue.filter(item => {
      const data = item.data as { zone?: ZoneName };
      return data.zone === zone;
    });
  }, [animationQueue]);

  useEffect(() => {
    if (!socket || !isConnected || listenersAttached.current) return;

    const handleResourceContributed = (data: ResourceContributedEvent) => {
      console.log('[MapAnimations] resource-contributed:', data);
      addToQueue('resource-flow', data);
    };

    const handleZoneUpgraded = (data: ZoneUpgradedEvent) => {
      console.log('[MapAnimations] zone-upgraded:', data);
      addToQueue('zone-upgrade', data);
    };

    const handleEventStarted = (data: EventStartedEvent) => {
      console.log('[MapAnimations] event-started:', data);
      addToQueue('event-start', data);
    };

    const handleEventEnded = (data: EventEndedEvent) => {
      console.log('[MapAnimations] event-ended:', data);
      addToQueue('event-end', data);
      // Also remove any event-start animation for this event
      setAnimationQueue(prev => prev.filter(
        item => !(item.type === 'event-start' && (item.data as EventStartedEvent).eventId === data.eventId)
      ));
    };

    socket.on('map:resource-contributed', handleResourceContributed);
    socket.on('map:zone-upgraded', handleZoneUpgraded);
    socket.on('map:event-started', handleEventStarted);
    socket.on('map:event-ended', handleEventEnded);

    listenersAttached.current = true;

    return () => {
      socket.off('map:resource-contributed', handleResourceContributed);
      socket.off('map:zone-upgraded', handleZoneUpgraded);
      socket.off('map:event-started', handleEventStarted);
      socket.off('map:event-ended', handleEventEnded);
      listenersAttached.current = false;
    };
  }, [socket, isConnected, addToQueue]);

  return {
    animationQueue,
    addToQueue,
    removeFromQueue,
    clearQueue,
    getCurrentAnimation,
    getZoneAnimations,
    hasAnimations: animationQueue.length > 0,
  };
}
