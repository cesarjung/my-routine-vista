import { useState, useEffect } from 'react';

export interface Alojamento {
  id: string;
  unidadeId: string;
  unidadeNome: string; // Keep name for display
  nome: string;
  latitude: number;
  longitude: number;
  capacidade: number;
}

const STORAGE_KEY = 'sirtec_alojamentos';

export function useAlojamentos() {
  const [alojamentos, setAlojamentos] = useState<Alojamento[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load alojamentos from localStorage', e);
      return [];
    }
  });

  // Save to local storage whenever alojamentos changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alojamentos));
    } catch (e) {
      console.error('Failed to save alojamentos to localStorage', e);
    }
  }, [alojamentos]);

  const addAlojamento = (alojamento: Omit<Alojamento, 'id'>) => {
    const newAlojamento: Alojamento = {
      ...alojamento,
      id: crypto.randomUUID()
    };
    setAlojamentos(prev => [...prev, newAlojamento]);
  };

  const updateAlojamento = (id: string, updates: Partial<Omit<Alojamento, 'id'>>) => {
    setAlojamentos(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const removeAlojamento = (id: string) => {
    setAlojamentos(prev => prev.filter(a => a.id !== id));
  };

  return {
    alojamentos,
    addAlojamento,
    updateAlojamento,
    removeAlojamento
  };
}
