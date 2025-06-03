'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { ProductCardSkeleton } from '@/components/shared/LoadingSpinner';
import styles from './Home.module.css';

/**
 * Popular designs section for the home page
 * Will eventually connect to the feed API
 */
export function PopularSection({ designs = [] }) {
  // Mock data for now - will be replaced with real feed data
  const mockDesigns = [
    {
      id: 1,
      title: 'T-Shirt',
      artist: '@art_lover',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAh_M-zjqoeP7L-VWub0i7VwvIeuYQOuXJI8VZFR6UolYcLCQVZ22LNi0zacx8kK2m78igPDdyd1EqqQy-oJ3tbSq5B17WVr3xf1OqSZPT40BlXjcnOG5RkgxsmHbP0pyjEKp6Y199Z6LrMl-uLrzYJ9HcLMhYXNDUUeuGQyRHgzsbSBG-YzeXpkCXl5s877UHwXMUwN6sBNHCn97BCEul_ZZRwS3XRgloQ-Zz3d039IOrbts_AvdtamQR5ieo-DAO-uKqGDeOwsSQr',
      href: '/design/1'
    },
    {
      id: 2,
      title: 'Sticker Sheet',
      artist: '@sticker_fan',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAw3_-oTcv3OJruJU4bXqxm99jSZnl5xsWMROTCqnOcxAWFfpv55HZMoULsZ6Pne0GHU7Z973p-HCBrOOEMIDO_U20Mk0KRuJYCzrC1HP4UML3-J1_5GXyupXDCUVuGhFI3f1NqfDOghq44P8V0kUI6dotCiwdrOj6TQe0vkQ3rWlxxOQqrHu1r3mXeNmrywBA82oL5mcQBo1NoyHPqicblALoeFqgVSr9dd111N90ZGuwvLR_lZB2j7CFM-sXa26NiwU0Cz9cxmFbp',
      href: '/design/2'
    },
    {
      id: 3,
      title: 'Poster',
      artist: '@poster_pro',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD25kUUP8m3ajO92XiJ0maWI_LIOZRskZil0D3P4rWHfual_LOIbZRe8_1Br0B4HwVKiZNlIuaMWXbK-MRWh_o1xjFRrXiRlmwcerfy8uAmYa4OPlxawS4C7xUYYU7oxMB67i14-2He_TWvDbFK-5W6vcPK_9BvN4HnPcLPgKpJOlkWi3HWw6mULeQCjgteZzYOnvuanrZj3HMcSDU4Fr3J_LX3O3rtLB43cPGPq81maGMg6tH-gaUPDGxy5haDlpW2-fqZYfPHXJPR',
      href: '/design/3'
    },
    {
      id: 4,
      title: 'T-Shirt',
      artist: '@art_lover',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC9k-rkBHtQ7kamqmzKx2yQKYJu8cgT3HFRT0wwJaLYu24xxmK-vVM9otdQNxp7cznYMJvxpyK56y1DudN1meLXuyKT8UcP11yoCi18Z0y3ZGhthjdTqSHUQ4qYmQ9TdMuxSSkvOz9y5ATfdczgeWEgtbg33bX1z7XdhxoG-4F2yGFLJbJmUQaHa8iuqekNUk54BIWYbBE1nbdTs-fz-_b4zSz5sapl5raxq72DYGBLUi6kuwetsuEh3NehherjRMWhmCcdaL-UZ1SX',
      href: '/design/4'
    },
    {
      id: 5,
      title: 'Sticker Sheet',
      artist: '@sticker_fan',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAFCRfMopbOdwidGoz2nQjejuvRP-ZfpVbay1A91NZVhuOXwiFW_AE6LK9sDepfm-JyHGqEEu3eVZCSmScnSsnTO_FjbfWHyvdh4cx82zaBIqImOmj_r9F4U5CL-kAA9OZ2qx5HnZBydNf0HNyQsKoEub7qW9QVB6FlXH3TMVM2sn2an1YcdTsPrVBAjCj1hBYvaVo-QROkZyUVHUA1uIwGpv5HpQAHI9hhdk_TYVt302_M2_aY2qPvu5ugkERM8RT4ZTuD1c1ZK-eG',
      href: '/design/5'
    },
    {
      id: 6,
      title: 'Poster',
      artist: '@poster_pro',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAUS1cpkVG19g1GWnkwTaEn4fONFp7rqGEUFlceeAawc-E_bsxlz60ONaVyTOlUs3sfh6PVshK7Ie3yoVmTA-SaWtebdJ246awLnu-2_OthKUP6JHZRRfeKlLqJN5BzJXrlhnuqADMZHQ7Y1A8QZSGaINEBoWPYI6i6mxVCUzTXDXeXpmQF22-bHtP_DE87-JnrcQaddWNZInZU2h9BAU88WqDOFDADS7tlzyQE5APElIV0F1Gj2lkfAKJJDPGlEMfQmT1vb6ug4TKU',
      href: '/design/6'
    }
  ];

  const displayDesigns = designs.length > 0 ? designs : mockDesigns;

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Popular</h2>
      <div className={styles.popularGrid}>
        {displayDesigns.map((design) => (
          <Link key={design.id} href={design.href} className={styles.popularItem}>
            <div 
              className={styles.popularImage}
              style={{ backgroundImage: `url("${design.image}")` }}
            ></div>
            <div className={styles.popularInfo}>
              <p className={styles.popularTitle}>{design.title}</p>
              <p className={styles.popularArtist}>{design.artist}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}