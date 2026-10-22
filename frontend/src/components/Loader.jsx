export default function Loader({ full = false, label = 'Loading…' }) {
  return (
    <div className={full ? 'loader loader-full' : 'loader'}>
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
