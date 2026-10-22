import { useEffect, useState } from 'react';

/**
 * Signature images are protected by the API (JWT required), so they cannot be
 * loaded with a plain <img src>. This component fetches the image as a blob
 * with the token and shows it through an object URL.
 */
export default function SecureImage({ load, alt, deps = [] }) {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let url;
    let cancelled = false;
    setError(false);
    load()
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  if (error) return <div className="signature-box empty">Not available</div>;
  if (!src) return <div className="signature-box empty">Loading…</div>;
  return (
    <div className="signature-box">
      <img src={src} alt={alt} />
    </div>
  );
}
