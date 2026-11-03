import { useEffect, useState } from 'react';
import { ScooterArt } from './ScooterArt';
import { api } from '../services/api';

/**
 * Each model has an optional imageUrl set from /admin/models.
 * Missing/broken images fall back to the existing VoltGo scooter illustration.
 * For self-hosted images, put files in frontend/public/images/vehicle-models/.
 */
export function ModelPhoto({ url, alt, className = '' }: {
  url?: string | null; alt: string; className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);
  const valid = Boolean(url && (/^\/images\/vehicle-models\/[\w./-]+\.(?:webp|png|jpe?g)$/i.test(url) || /^https:\/\/[^\s]+$/i.test(url)));
  if (!valid || failed) {
    return <div className={'flex h-full w-full items-center justify-center ' + className} role="img" aria-label={'Hình minh họa cho ' + alt}>
      <ScooterArt />
    </div>;
  }
  return <img
    src={src!}
    alt={alt}
    loading="lazy"
    decoding="async"
    className={'h-full w-full object-contain p-5 ' + className}
    onError={() => setFailed(true)}
  />;
}
