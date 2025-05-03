'use client';

import React from 'react';
import { useDebug } from '../contexts/DebugContext';

export default function DebugOverlay() {
  const { logs } = useDebug();

  const overlayStyle = {
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
  };

  return (
    <div style={overlayStyle}>
      <div>**Debug Log Overlay**</div>
      {logs.map((log, index) => (
        <div key={index}>{log}</div>
      ))}
    </div>
  );
} 