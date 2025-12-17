import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="d-flex justify-content-center align-items-center h-100">
      <div className="text-center p-5">
        <div className="display-1 text-muted mb-4" style={{ fontSize: '8rem' }}>
          404
        </div>
        <h2 className="text-light mb-3">Page Not Found</h2>
        <p className="text-muted mb-4">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/" className="btn btn-primary btn-lg">
          <i className="fa-solid fa-home me-2"></i>
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
