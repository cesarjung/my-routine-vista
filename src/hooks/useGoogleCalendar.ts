import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface GoogleCalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
}

interface UseGoogleCalendarReturn {
  isConnected: boolean;
  isLoading: boolean;
  isExpired: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  checkStatus: () => Promise<void>;
  createEvent: (taskId: string, title: string, description?: string, startDate?: string, dueDate?: string) => Promise<string | null>;
  updateEvent: (eventId: string, title: string, description?: string, startDate?: string, dueDate?: string, status?: string) => Promise<boolean>;
  deleteEvent: (eventId: string) => Promise<boolean>;
  fetchEvents: (timeMin?: string, timeMax?: string) => Promise<GoogleCalendarEvent[]>;
  importEvent: (eventId: string, unitId: string) => Promise<boolean>;
}

export function useGoogleCalendar(): UseGoogleCalendarReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpired, setIsExpired] = useState(false);
  const { session } = useAuth();
  const { toast } = useToast();

  const getAuthHeaders = useCallback(() => {
    if (!session?.access_token) return null;
    return {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }, [session]);

  const checkStatus = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) {
      setIsConnected(false);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: null,
        headers,
      });

      // Parse the action from URL since we need to pass it differently
      const response = await fetch(
        `https://djnysigashxtjfhxpzyj.supabase.co/functions/v1/google-calendar-auth?action=status`,
        { headers }
      );
      
      const result = await response.json();
      
      if (result.connected !== undefined) {
        setIsConnected(result.connected);
        setIsExpired(result.expired || false);
      }
    } catch (error) {
      console.error('Error checking Google Calendar status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  // Check for OAuth callback parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleAuth = params.get('google_auth');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const expiresIn = params.get('expires_in');

    if (googleAuth === 'success' && accessToken && session?.access_token) {
      // Save tokens to database
      const saveTokens = async () => {
        try {
          const response = await fetch(
            `https://djnysigashxtjfhxpzyj.supabase.co/functions/v1/google-calendar-auth?action=save-tokens`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                access_token: decodeURIComponent(accessToken),
                refresh_token: refreshToken ? decodeURIComponent(refreshToken) : null,
                expires_in: parseInt(expiresIn || '3600'),
              }),
            }
          );

          const result = await response.json();
          
          if (result.success) {
            toast({
              title: 'Google Calendar conectado!',
              description: 'Sua conta foi vinculada com sucesso.',
            });
            setIsConnected(true);
          }
        } catch (error) {
          console.error('Error saving tokens:', error);
          toast({
            title: 'Erro ao conectar',
            description: 'Não foi possível salvar a conexão.',
            variant: 'destructive',
          });
        }

        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      };

      saveTokens();
    }
  }, [session, toast]);

  // Initial status check
  useEffect(() => {
    if (session) {
      checkStatus();
    }
  }, [session, checkStatus]);

  const connect = useCallback(async () => {
    if (!session) {
      toast({
        title: 'Não autenticado',
        description: 'Faça login para conectar o Google Calendar.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const redirectUri = window.location.origin + window.location.pathname;
      
      const response = await fetch(
        `https://djnysigashxtjfhxpzyj.supabase.co/functions/v1/google-calendar-auth?action=auth-url&redirect_uri=${encodeURIComponent(redirectUri)}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (result.authUrl) {
        window.location.href = result.authUrl;
      } else {
        throw new Error('Failed to get auth URL');
      }
    } catch (error) {
      console.error('Error connecting to Google Calendar:', error);
      toast({
        title: 'Erro ao conectar',
        description: 'Não foi possível iniciar a autenticação.',
        variant: 'destructive',
      });
    }
  }, [session, toast]);

  const disconnect = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;

    try {
      const response = await fetch(
        `https://djnysigashxtjfhxpzyj.supabase.co/functions/v1/google-calendar-auth?action=disconnect`,
        {
          method: 'POST',
          headers,
        }
      );

      const result = await response.json();

      if (result.success) {
        setIsConnected(false);
        toast({
          title: 'Desconectado',
          description: 'Google Calendar foi desconectado.',
        });
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível desconectar.',
        variant: 'destructive',
      });
    }
  }, [getAuthHeaders, toast]);

  const createEvent = useCallback(async (
    taskId: string,
    title: string,
    description?: string,
    startDate?: string,
    dueDate?: string
  ): Promise<string | null> => {
    const headers = getAuthHeaders();
    if (!headers) return null;

    try {
      const response = await fetch(
        `https://djnysigashxtjfhxpzyj.supabase.co/functions/v1/google-calendar-sync?action=create-event`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ taskId, title, description, startDate, dueDate }),
        }
      );

      const result = await response.json();

      if (result.needsAuth) {
        setIsConnected(false);
        return null;
      }

      if (result.success) {
        toast({
          title: 'Evento criado',
          description: 'Tarefa adicionada ao Google Calendar.',
        });
        return result.eventId;
      }

      throw new Error(result.error);
    } catch (error) {
      console.error('Error creating event:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o evento.',
        variant: 'destructive',
      });
      return null;
    }
  }, [getAuthHeaders, toast]);

  const updateEvent = useCallback(async (
    eventId: string,
    title: string,
    description?: string,
    startDate?: string,
    dueDate?: string,
    status?: string
  ): Promise<boolean> => {
    const headers = getAuthHeaders();
    if (!headers) return false;

    try {
      const response = await fetch(
        `https://djnysigashxtjfhxpzyj.supabase.co/functions/v1/google-calendar-sync?action=update-event`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ eventId, title, description, startDate, dueDate, status }),
        }
      );

      const result = await response.json();

      if (result.needsAuth) {
        setIsConnected(false);
        return false;
      }

      return result.success;
    } catch (error) {
      console.error('Error updating event:', error);
      return false;
    }
  }, [getAuthHeaders]);

  const deleteEvent = useCallback(async (eventId: string): Promise<boolean> => {
    const headers = getAuthHeaders();
    if (!headers) return false;

    try {
      const response = await fetch(
        `https://djnysigashxtjfhxpzyj.supabase.co/functions/v1/google-calendar-sync?action=delete-event`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ eventId }),
        }
      );

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Error deleting event:', error);
      return false;
    }
  }, [getAuthHeaders]);

  const fetchEvents = useCallback(async (
    timeMin?: string,
    timeMax?: string
  ): Promise<GoogleCalendarEvent[]> => {
    const headers = getAuthHeaders();
    if (!headers) return [];

    try {
      const params = new URLSearchParams({ action: 'fetch-events' });
      if (timeMin) params.set('timeMin', timeMin);
      if (timeMax) params.set('timeMax', timeMax);

      const response = await fetch(
        `https://djnysigashxtjfhxpzyj.supabase.co/functions/v1/google-calendar-sync?${params}`,
        { headers }
      );

      const result = await response.json();

      if (result.needsAuth) {
        setIsConnected(false);
        return [];
      }

      return result.events || [];
    } catch (error) {
      console.error('Error fetching events:', error);
      return [];
    }
  }, [getAuthHeaders]);

  const importEvent = useCallback(async (
    eventId: string,
    unitId: string
  ): Promise<boolean> => {
    const headers = getAuthHeaders();
    if (!headers) return false;

    try {
      const response = await fetch(
        `https://djnysigashxtjfhxpzyj.supabase.co/functions/v1/google-calendar-sync?action=import-event`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ eventId, unitId }),
        }
      );

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Evento importado',
          description: 'O evento foi convertido em tarefa.',
        });
        return true;
      }

      throw new Error(result.error);
    } catch (error) {
      console.error('Error importing event:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível importar o evento.',
        variant: 'destructive',
      });
      return false;
    }
  }, [getAuthHeaders, toast]);

  return {
    isConnected,
    isLoading,
    isExpired,
    connect,
    disconnect,
    checkStatus,
    createEvent,
    updateEvent,
    deleteEvent,
    fetchEvents,
    importEvent,
  };
}
