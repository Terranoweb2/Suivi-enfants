import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Location, SafeZone, LocationState } from '../types';
import { isWeb } from '../utils/platform';

interface LocationContextType extends LocationState {
  safeZones: SafeZone[];
  startTracking: () => Promise<boolean>;
  stopTracking: () => void;
  getCurrentLocation: () => Promise<Location | null>;
  addSafeZone: (safeZone: Omit<SafeZone, 'id'>) => Promise<string>;
  removeSafeZone: (safeZoneId: string) => Promise<boolean>;
  updateSafeZone: (safeZoneId: string, updates: Partial<SafeZone>) => Promise<boolean>;
  getSafeZones: () => SafeZone[];
  clearLocationHistory: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

interface LocationProviderProps {
  children: ReactNode;
}

export const LocationProvider: React.FC<LocationProviderProps> = ({ children }) => {
  const [state, setState] = useState<LocationState>({
    currentLocation: null,
    locationHistory: [],
    isTracking: false,
    hasPermission: false,
    error: null,
  });

  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);

  useEffect(() => {
    if (isWeb) {
      // Simuler des données de localisation pour la démo web
      const demoLocation: Location = {
        id: 'demo-location-1',
        latitude: 48.8566,
        longitude: 2.3522,
        accuracy: 10,
        timestamp: new Date(),
        address: 'Paris, France',
        childId: 'demo-child-1',
      };

      const demoSafeZone: SafeZone = {
        id: 'demo-safe-zone-1',
        name: 'Maison',
        latitude: 48.8566,
        longitude: 2.3522,
        radius: 100,
        isActive: true,
        entryNotification: true,
        exitNotification: true,
        color: '#4CAF50',
        createdAt: new Date(),
        childId: 'demo-child-1',
      };

      setState({
        currentLocation: demoLocation,
        locationHistory: [demoLocation],
        isTracking: false,
        hasPermission: true,
        error: null,
      });

      setSafeZones([demoSafeZone]);
    }
  }, []);

  const startTracking = async (): Promise<boolean> => {
    if (isWeb) {
      setState(prev => ({ ...prev, isTracking: true }));
      return true;
    }
    return false;
  };

  const stopTracking = () => {
    setState(prev => ({ ...prev, isTracking: false }));
  };

  const getCurrentLocation = async (): Promise<Location | null> => {
    if (isWeb) {
      return state.currentLocation;
    }
    return null;
  };

  const addSafeZone = async (safeZone: Omit<SafeZone, 'id'>): Promise<string> => {
    const newSafeZone: SafeZone = {
      ...safeZone,
      id: `safe-zone-${Date.now()}`,
    };
    setSafeZones(prev => [...prev, newSafeZone]);
    return newSafeZone.id;
  };

  const removeSafeZone = async (safeZoneId: string): Promise<boolean> => {
    setSafeZones(prev => prev.filter(zone => zone.id !== safeZoneId));
    return true;
  };

  const updateSafeZone = async (safeZoneId: string, updates: Partial<SafeZone>): Promise<boolean> => {
    setSafeZones(prev => prev.map(zone => 
      zone.id === safeZoneId ? { ...zone, ...updates } : zone
    ));
    return true;
  };

  const getSafeZones = (): SafeZone[] => {
    return safeZones;
  };

  const clearLocationHistory = () => {
    setState(prev => ({ ...prev, locationHistory: [] }));
  };

  const contextValue: LocationContextType = {
    ...state,
    safeZones: safeZones || [],
    startTracking,
    stopTracking,
    getCurrentLocation,
    addSafeZone,
    removeSafeZone,
    updateSafeZone,
    getSafeZones,
    clearLocationHistory,
  };

  return (
    <LocationContext.Provider value={contextValue}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
