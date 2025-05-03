'use client';

import React, { createContext, useContext } from 'react';

// Placeholder context for Frame SDK actions
const FrameSdkContext = createContext(null);

export function FrameSdkProvider({ children, sdk }) { // Assume sdk object is passed in
  return (
    <FrameSdkContext.Provider value={sdk}> 
      {children}
    </FrameSdkContext.Provider>
  );
}

export function useFrameSdk() {
  const context = useContext(FrameSdkContext);
  // Optional: Add check if context is null and throw error or return a dummy object
  if (!context) {
    console.warn('useFrameSdk used outside of FrameSdkProvider. Returning dummy actions.');
    // Return a dummy object to avoid crashes, real integration needed
    return {
      actions: {
          signIn: async (options) => { 
              console.error('Dummy sdk.actions.signIn called. Integrate Frame SDK properly.');
              alert('Sign-in not available. Frame SDK not integrated.');
              // Simulate failure or return structure that won't proceed
              return Promise.reject(new Error('Frame SDK not integrated')); 
          }
          // Add other dummy actions if needed
      }
    }; 
  }
  return context;
}

// You would typically wrap FrameInit or similar with FrameSdkProvider
// Example in layout.js might look like:
// <FrameSdkProvider sdk={/* get sdk instance here */}>
//    <FrameInit />
//    {children}
// </FrameSdkProvider> 