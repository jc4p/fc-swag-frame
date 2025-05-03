'use client';

import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';

const AuthContext = createContext(null);

const LOCAL_STORAGE_KEY = 'fc-auth-token';

export function AuthProvider({ children }) {
  const [authToken, setAuthToken] = useState(null);
  const [userFid, setUserFid] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true); // Start loading until checked
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load token from localStorage on initial mount
  useEffect(() => {
    try {
        const storedToken = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (storedToken) {
            // Basic validation: check if it looks like a JWT (3 parts)
            if (storedToken.split('.').length === 3) {
                 // TODO: Add proper JWT validation/decoding here if needed on load
                 // For now, just assume it's valid if present and looks right
                 // Decode to get FID - basic, no verification here
                 try {
                    const payloadB64 = storedToken.split('.')[1];
                    const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
                    const payload = JSON.parse(payloadJson);
                    if (payload.fid) {
                        console.log('AuthProvider: Loaded token for FID:', payload.fid);
                        setAuthToken(storedToken);
                        setUserFid(payload.fid);
                        setIsAuthenticated(true);
                    } else {
                        console.warn('AuthProvider: Stored token missing FID.');
                        localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear invalid token
                    }
                 } catch (decodeError) {
                     console.error('AuthProvider: Error decoding stored token:', decodeError);
                     localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear invalid token
                 }
            } else {
                console.warn('AuthProvider: Stored token is invalid format.');
                localStorage.removeItem(LOCAL_STORAGE_KEY);
            }
        }
    } catch (e) {
        console.error("AuthProvider: Error accessing localStorage:", e);
        // Handle cases where localStorage might be disabled or inaccessible
    }
    setIsAuthLoading(false); // Finished initial check
  }, []);

  const login = useCallback((token, fid) => {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, token);
        setAuthToken(token);
        setUserFid(fid);
        setIsAuthenticated(true);
        console.log('AuthProvider: Logged in, FID:', fid);
    } catch (e) {
        console.error("AuthProvider: Error saving token to localStorage:", e);
        // Still set state even if localStorage fails?
        setAuthToken(token);
        setUserFid(fid);
        setIsAuthenticated(true);
    }
  }, []);

  const logout = useCallback(() => {
    try {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (e) {
        console.error("AuthProvider: Error removing token from localStorage:", e);
    }
    setAuthToken(null);
    setUserFid(null);
    setIsAuthenticated(false);
    console.log('AuthProvider: Logged out.');
  }, []);

  return (
    <AuthContext.Provider value={{ authToken, userFid, isAuthenticated, isAuthLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 