'use client';

import { useTheme } from 'next-themes';
import Image from 'next/image';
import { useEffect, useState } from 'react';

interface DarkModeLogoProps {
  lightSrc: string;
  darkSrc: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  fetchPriority?: 'high' | 'low' | 'auto';
  loading?: 'eager' | 'lazy';
}

export function DarkModeLogo({
  lightSrc,
  darkSrc,
  alt,
  width = 98,
  height = 40,
  className,
  style,
  fetchPriority,
  loading,
}: DarkModeLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR and before hydration, show the light logo to avoid flash
  const src = mounted && resolvedTheme === 'dark' ? darkSrc : lightSrc;

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      fetchPriority={fetchPriority}
      loading={loading}
    />
  );
}
