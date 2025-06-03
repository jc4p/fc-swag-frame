'use client';

import React, { useState } from 'react';
import styles from './Profile.module.css';

/**
 * Profile tabs component for switching between designs and orders
 */
export function ProfileTabs() {
  const [activeTab, setActiveTab] = useState('designs');

  const tabs = [
    { id: 'designs', label: 'My Designs', count: 0 },
    { id: 'orders', label: 'Order History', count: 0 }
  ];

  return (
    <div className={styles.tabContainer}>
      {/* Tab Headers */}
      <div className={styles.tabHeaders}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tabButton} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.count > 0 && <span className={styles.tabCount}>({tab.count})</span>}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {activeTab === 'designs' && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 256 256">
                <path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,176H48V48H208V208Zm-32-80a8,8,0,0,1-8,8H136v32a8,8,0,0,1-16,0V136H88a8,8,0,0,1,0-16h32V88a8,8,0,0,1,16,0v32h32A8,8,0,0,1,176,128Z"></path>
              </svg>
            </div>
            <h3 className={styles.emptyTitle}>No designs yet</h3>
            <p className={styles.emptyDescription}>Start creating your first custom design</p>
            <a href="/create" className={styles.createButton}>
              Create Design
            </a>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 256 256">
                <path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM40,56H216V88H40ZM40,200V104H216v96Z"></path>
              </svg>
            </div>
            <h3 className={styles.emptyTitle}>No orders yet</h3>
            <p className={styles.emptyDescription}>Your purchase history will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}