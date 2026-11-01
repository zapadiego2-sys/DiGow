import { useState } from 'react';

const BRAND_NAME = 'Cotizador';
const LOCAL_LOGO = `${import.meta.env.BASE_URL}brand/logo.png`;

/** Orden de context/reglas.md: URL configurada, archivo local y, si ninguno carga, el texto. */
export function brandLogoSources(configuredUrl: string | undefined): string[] {
  const url = configuredUrl?.trim();
  return url ? [url, LOCAL_LOGO] : [LOCAL_LOGO];
}

interface BrandLogoProps {
  sources?: string[];
}

export function BrandLogo({
  sources = brandLogoSources(import.meta.env.VITE_BRAND_LOGO_URL),
}: BrandLogoProps) {
  const [failedCount, setFailedCount] = useState(0);
  const source = sources[failedCount];

  if (!source) return <span className="text-title text-primary">{BRAND_NAME}</span>;

  return (
    <img
      key={source}
      src={source}
      alt={BRAND_NAME}
      className="h-2xl w-auto max-w-full object-photo"
      onError={() => setFailedCount((count) => count + 1)}
    />
  );
}
