'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="d-flex justify-content-center align-items-center h-100">
      <div className="text-center p-5">
        <div className="display-1 text-danger mb-4">
          <i className="fa-solid fa-triangle-exclamation"></i>
        </div>
        <h2 className="text-light mb-3">Something went wrong</h2>
        <p className="text-muted mb-4">
          {error.message || 'An unexpected error occurred'}
        </p>
        <button onClick={() => reset()} className="btn btn-primary btn-lg">
          <i className="fa-solid fa-rotate-right me-2"></i>
          Try Again
        </button>
      </div>
    </div>
  );
}
