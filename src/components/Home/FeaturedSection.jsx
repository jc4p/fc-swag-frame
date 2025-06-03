'use client';

import React from 'react';
import Link from 'next/link';
import styles from './Home.module.css';

/**
 * Featured products section for the home page
 */
export function FeaturedSection() {
  const featuredItems = [
    {
      id: 'shirts',
      title: 'Custom T-Shirts',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDBv5ftX7Nfaj6Z-etvnmdMmkC2MUKBDw1Pru-O8s4N3bIQ11CHZpN_vHx99gur2EpRG-weXZ38fBLsTR46AVlEy8WskrQWsE86I9GVTI1zjEZz0FzEwJAsRxRWD1ENIrsqg_ZPWYVm7oeAq8PaxjrJqdQAUapR-qEDYx6o8xDM-NOKhm6DOJ9mtvRibR0IXCpiKT-89vEFprp-JAWXAz-E5Qe10ayKgtOERynYkumMGhUTtwZjw7Ia5zByVmGq92cHZu803s2jnrz3',
      href: '/create'
    },
    {
      id: 'stickers',
      title: 'Custom Stickers',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuANq9YwSy7kjSdb5hfBcddQHOgztzYy2wm8KOpKqNPaEmP5KkNaoZHo27BKM6tb8TfvV114pvqpieCbkwji9-t0DrEjvvUBRrSRe7rPmb0KQvqCAas659qwewM9SPJaJdztK3g4_zu-P2TGdF2V_NcH__T8UoH0-Uyj3NzGHwu2jLSdqsijGdMF2ZadhQKH8eeYSxiWUN2pOjRZRbnwxZw0YOTXBi4IdX5pk86O_XTvKmNGh-jN5KX02yk0PpkpGaWYt2Tk89ud7iE2',
      href: '/create'
    },
    {
      id: 'posters',
      title: 'Custom Posters',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCTFBlmNdxOJCuO-OVJGVcfBgLKxSAtU9m_l5PHJThppoJdRxRF4k_R3Z3yHQhOwQbSERLgKqmM38aIFuh7fMJvBjvm0_bdoxlGpM3YWmteGqHQVY2EM36Sr9oE1Krem77o0-XXRWtyCRbTHVZilT1GjOPZpsHOJ95PFEOH8Z1fAkLXdqYJS2i8t27W9NlWpJXzTcvAJtPv_CF1AYnmlT9cLW6isfxiMtLmHQ7aQ9f-80vC4DRM0zl6yBpDHs9CrKBNMtgsY59iQNcm',
      href: '/create'
    }
  ];

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Featured</h2>
      <div className={styles.featuredContainer}>
        <div className={styles.featuredItems}>
          {featuredItems.map((item) => (
            <Link key={item.id} href={item.href} className={styles.featuredItem}>
              <div 
                className={styles.featuredImage}
                style={{ backgroundImage: `url("${item.image}")` }}
              ></div>
              <p className={styles.featuredTitle}>{item.title}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}