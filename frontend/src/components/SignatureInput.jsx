import { useEffect, useRef, useState } from 'react';

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_MB = 2;

/** File picker for a signature image with client-side checks and a preview. */
export default function SignatureInput({ value, onChange, error, label = 'Signature image' }) {
  const [preview, setPreview] = useState(null);
  const [localError, setLocalError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!value) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    setLocalError('');
    if (!file) return;
    if (!ALLOWED.includes(file.type)) {
      setLocalError('Please choose a PNG, JPG or WEBP image');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setLocalError(`Image must be smaller than ${MAX_MB} MB`);
      e.target.value = '';
      return;
    }
    onChange(file);
  };

  const clear = () => {
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="field">
      <label>{label}</label>
      <div className="signature-input">
        {preview ? (
          <div className="signature-box">
            <img src={preview} alt="Selected signature preview" />
          </div>
        ) : (
          <div className="signature-box empty">No new image selected</div>
        )}
        <div className="signature-actions">
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} />
          {value && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>
              Remove
            </button>
          )}
          <small className="muted">PNG, JPG or WEBP · max {MAX_MB} MB</small>
        </div>
      </div>
      {(localError || error) && <span className="field-error">{localError || error}</span>}
    </div>
  );
}
