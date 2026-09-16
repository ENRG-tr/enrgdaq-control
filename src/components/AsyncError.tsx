'use client';

interface AsyncErrorProps {
  message: string;
  onRetry: () => void;
  retryLabel?: string;
  className?: string;
}

export default function AsyncError({
  message,
  onRetry,
  retryLabel = 'Retry',
  className = '',
}: AsyncErrorProps) {
  return (
    <div
      className={`alert alert-warning d-flex align-items-center justify-content-between gap-3 ${className}`.trim()}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <span>
        <i className="fa-solid fa-triangle-exclamation me-2" aria-hidden="true"></i>
        {message}
      </span>
      <button
        type="button"
        className="btn btn-sm btn-outline-warning text-nowrap"
        onClick={onRetry}
        aria-label={retryLabel}
      >
        <i className="fa-solid fa-rotate-right me-1" aria-hidden="true"></i>
        Retry
      </button>
    </div>
  );
}
