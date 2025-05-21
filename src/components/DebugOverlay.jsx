'use client';

import React, { useState } from 'react';
import { useDebug } from '../contexts/DebugContext';

export default function DebugOverlay() {
  const { logs } = useDebug();
  const [isMinimized, setIsMinimized] = useState(true);

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const minimizedStyle = {
    position: 'fixed',
    bottom: '10px',
    right: '10px',
    width: '40px',
    height: '40px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 9999,
    fontSize: '20px',
  };

  const maximizedStyle = {
    position: 'fixed',
    bottom: '10px',
    left: '10px',
    width: 'calc(100% - 20px)',
    maxHeight: '150px',
    overflowY: 'auto',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#0f0', // Green text
    padding: '10px',
    borderRadius: '5px',
    fontSize: '10px',
    fontFamily: 'monospace',
    zIndex: 9999, // Ensure it's on top
    opacity: 0.8,
    cursor: 'pointer', // Added cursor pointer
  };

  if (isMinimized) {
    return (
      <div style={minimizedStyle} onClick={toggleMinimize}>
        {'🐞'}
      </div>
    );
  } else {
    return (
      <div style={maximizedStyle} onClick={toggleMinimize}>
        <div>**Debug Log Overlay**</div>
        {logs.map((log, index) => (
          <div key={index}>{log}</div>
        ))}
      </div>
    );
  }
} 