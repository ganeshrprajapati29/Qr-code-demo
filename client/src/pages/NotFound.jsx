import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="page">
      <div className="empty">
        <p className="empty-title">पेज नहीं मिला</p>
        <Link to="/" className="btn btn-primary">होम पर जाएँ</Link>
      </div>
    </div>
  );
}
