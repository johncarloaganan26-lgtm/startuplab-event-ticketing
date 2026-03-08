import React from 'react';
import { UserRole } from '../types';

interface UserContextState {
  role: UserRole | null;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
  isAuthenticated: boolean;
  canViewEvents?: boolean;
  canEditEvents?: boolean;
  canManualCheckIn?: boolean;
  canReceiveNotifications?: boolean;
}

interface UserContextValue extends UserContextState {
  setUser: (payload: { role: UserRole; email: string; name?: string | null; imageUrl?: string | null; canViewEvents?: boolean; canEditEvents?: boolean; canManualCheckIn?: boolean; canReceiveNotifications?: boolean }) => void;
  clearUser: () => void;
}

const UserContext = React.createContext<UserContextValue | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = React.useState<UserContextState>({
    role: null,
    email: null,
    name: null,
    imageUrl: null,
    isAuthenticated: false,
    canViewEvents: undefined,
    canEditEvents: undefined,
    canManualCheckIn: undefined,
    canReceiveNotifications: undefined,
  });

  const setUser = React.useCallback((payload: { role: UserRole; email: string; name?: string | null; imageUrl?: string | null; canViewEvents?: boolean; canEditEvents?: boolean; canManualCheckIn?: boolean; canReceiveNotifications?: boolean }) => {
    setState((prev) => {
      const nextName = payload.name !== undefined ? payload.name : prev.name;
      const nextImageUrl = payload.imageUrl !== undefined ? payload.imageUrl : prev.imageUrl;
      const sameIdentity = prev.isAuthenticated && prev.role === payload.role && prev.email === payload.email;
      const sameProfile = prev.name === nextName && prev.imageUrl === nextImageUrl;
      const samePermissions =
        prev.canViewEvents === payload.canViewEvents &&
        prev.canEditEvents === payload.canEditEvents &&
        prev.canManualCheckIn === payload.canManualCheckIn &&
        prev.canReceiveNotifications === payload.canReceiveNotifications;
      if (sameIdentity && samePermissions && sameProfile) return prev;
      return {
        role: payload.role,
        email: payload.email,
        name: nextName ?? null,
        imageUrl: nextImageUrl ?? null,
        isAuthenticated: true,
        canViewEvents: payload.canViewEvents,
        canEditEvents: payload.canEditEvents,
        canManualCheckIn: payload.canManualCheckIn,
        canReceiveNotifications: payload.canReceiveNotifications,
      };
    });
  }, []);

  const clearUser = React.useCallback(() => {
    setState((prev) => {
      if (!prev.isAuthenticated && !prev.role && !prev.email && !prev.name && !prev.imageUrl) return prev;
      return { role: null, email: null, name: null, imageUrl: null, isAuthenticated: false, canViewEvents: undefined, canEditEvents: undefined, canManualCheckIn: undefined, canReceiveNotifications: undefined };
    });
  }, []);

  const value = React.useMemo(() => ({ ...state, setUser, clearUser }), [state, setUser, clearUser]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const ctx = React.useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
};
