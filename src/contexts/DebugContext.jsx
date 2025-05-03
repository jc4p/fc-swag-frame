'use client';

import React, { createContext, useState, useContext, useCallback } from 'react';

const DebugContext = createContext(null);

export function DebugProvider({ children }) {
  const [logs, setLogs] = useState([]);

  const logToOverlay = useCallback((message) => {
    console.log('[DEBUG OVERLAY]', message); // Still log to console if available
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prevLogs => [
        `[${timestamp}] ${message}`,
        ...prevLogs.slice(0, 49) // Keep max 50 logs
    ]);
  }, []);

  return (
    <DebugContext.Provider value={{ logs, logToOverlay }}>
      {children}
    </DebugContext.Provider>
  );
}

export function useDebug() {
  const context = useContext(DebugContext);
  if (!context) {
    throw new Error('useDebug must be used within a DebugProvider');
  }
  return context;
} 