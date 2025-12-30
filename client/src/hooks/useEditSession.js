import { useState, useEffect, useCallback } from 'react';
import { getActiveSession, startEditSession, endEditSession } from '../services/editSessionService';
import { useAuth } from '../context/AuthContext';

export const useEditSession = () => {
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);

  // Check if user needs edit sessions (only salesperson)
  const needsEditSession = user?.role === 'salesperson';

  // Fetch active session
  const fetchActiveSession = useCallback(async () => {
    if (!needsEditSession) return;
    
    try {
      const data = await getActiveSession();
      if (data.session) {
        setSession(data.session);
      } else {
        setSession(null);
      }
    } catch (error) {
      console.error('Failed to fetch active session:', error);
      setSession(null);
    }
  }, [needsEditSession]);

  // Start session
  const startSession = async () => {
    setLoading(true);
    try {
      const data = await startEditSession();
      setSession(data.session);
      return { success: true, session: data.session };
    } catch (error) {
      console.error('Failed to start session:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Failed to start session' 
      };
    } finally {
      setLoading(false);
    }
  };

  // End session
  const endSession = async () => {
    setLoading(true);
    try {
      await endEditSession();
      setSession(null);
      return { success: true };
    } catch (error) {
      console.error('Failed to end session:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Failed to end session' 
      };
    } finally {
      setLoading(false);
    }
  };

  // Calculate time left
  useEffect(() => {
    if (!session?.expiresAt) {
      setTimeLeft(null);
      return;
    }

    const calculateTimeLeft = () => {
      const now = new Date();
      const expires = new Date(session.expiresAt);
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft(0);
        setSession(null); // Session expired
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ minutes, seconds, totalSeconds: Math.floor(diff / 1000) });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [session]);

  // Load session on mount
  useEffect(() => {
    fetchActiveSession();
  }, [fetchActiveSession]);

  return {
    session,
    loading,
    timeLeft,
    needsEditSession,
    hasActiveSession: !!session && session.isActive,
    remainingChanges: session?.remainingChanges || 0,
    startSession,
    endSession,
    refreshSession: fetchActiveSession,
  };
};
