import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <p className="eyebrow">404 — PAGE NOT FOUND</p>
      <h1>Not all paths<br /><em>lead here.</em></h1>
      <p>The page you’re looking for may have moved or may no longer be available.</p>
      <Link className="button button-dark" href="/">RETURN HOME <span aria-hidden="true">↗</span></Link>
    </main>
  );
}
