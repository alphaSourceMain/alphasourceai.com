import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="not-found-page min-h-screen flex items-center justify-center bg-[#F8F9FD] pt-16">
      <div className="text-center px-6">
        <div className="text-8xl font-black text-[#A380F6] mb-4">404</div>
        <h1 className="text-2xl font-bold text-[#0A1547] mb-3">Page not found</h1>
        <p className="text-[#0A1547]/60 mb-8">The page you're looking for doesn't exist.</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white rounded-full"
          style={{ backgroundColor: "#A380F6" }}
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
