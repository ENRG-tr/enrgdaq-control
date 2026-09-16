'use client';

interface LoadingSpinnerProps {
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function LoadingSpinner({
  label = 'Loading...',
  size = 'md',
  className = '',
}: LoadingSpinnerProps) {
  return (
    <div
      className={`d-flex align-items-center justify-content-center text-muted ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <span
        className={`spinner-border ${size === 'sm' ? 'spinner-border-sm' : ''} text-primary ${label ? 'me-2' : ''}`.trim()}
        aria-hidden="true"
      />
      {label && <span>{label}</span>}
    </div>
  );
}
