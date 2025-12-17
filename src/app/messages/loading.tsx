export default function Loading() {
  return (
    <div className="d-flex justify-content-center align-items-center h-100">
      <div className="text-center">
        <div
          className="spinner-border text-primary mb-3"
          role="status"
          style={{ width: '3rem', height: '3rem' }}
        >
          <span className="visually-hidden">Loading messages...</span>
        </div>
        <p className="text-muted">Loading messages...</p>
      </div>
    </div>
  );
}
