'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import styles from './PublishButton.module.css';

/**
 * Reusable publish button component with authentication logic
 */
export function PublishButton({ 
  onPublish, 
  disabled = false, 
  isLoading = false,
  isSigningIn = false,
  children = "Create Listing (Free)",
  className = ''
}) {
  const { isAuthenticated, isAuthLoading } = useAuth();

  const buttonText = isSigningIn 
    ? 'Signing In...' 
    : isLoading 
    ? 'Publishing...' 
    : isAuthenticated 
    ? 'Publish Design' 
    : 'Sign In & Publish';

  const isButtonDisabled = disabled || isLoading || isSigningIn || isAuthLoading;

  const getButtonText = () => {
    if (isSigningIn) return "Signing In...";
    if (isLoading) return "Publishing...";
    return children;
  };

  return (
    <div className={`${styles.actionSection} ${className}`}>
      <button
        className={styles.primaryButton}
        onClick={onPublish}
        disabled={isButtonDisabled}
      >
        {getButtonText()}
      </button>
    </div>
  );
}