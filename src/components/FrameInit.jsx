'use client';

import { useEffect } from 'react';
import { initializeFrame } from '@/lib/frame';

export function FrameInit() {
  useEffect(() => {
    // Check if running on the client side before calling initializeFrame
    if (typeof window !== 'undefined') {
        initializeFrame();
    }
  }, []);

  // This component doesn't render anything itself
  return null;
} 