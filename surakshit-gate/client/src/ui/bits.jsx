import { initial, MSG_STATUS } from '../lib/format.js';

export function Photo({ src, name, size = 56, className = '' }) {
  return src ? (
    <img className={`photo ${className}`} src={src} alt={name} width={size} height={size} style={{ width: size, height: size }} loading="lazy" />
  ) : (
    <span className={`photo photo-ph ${className}`} style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">{initial(name)}</span>
  );
}

export function Ticks({ status, label = true }) {
  const s = MSG_STATUS[status] || MSG_STATUS.queued;
  return (
    <span className={`ticks tone-${s.tone}`} title={s.label}>
      <b>{s.tick}</b>{label && <span> {s.label}</span>}
    </span>
  );
}

export function Spinner({ label }) {
  return (
    <div className="center-box">
      <div className="spinner" aria-hidden="true" />
      {label && <p className="muted">{label}</p>}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      {title && <p className="empty-title">{title}</p>}
      {children}
    </div>
  );
}

export function Stat({ label, value, tone = '' }) {
  return (
    <div className={`stat ${tone}`}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="alert alert-red" role="alert">
      {error}
      {onRetry && <button className="link" onClick={onRetry}>दोबारा कोशिश करें</button>}
    </div>
  );
}
