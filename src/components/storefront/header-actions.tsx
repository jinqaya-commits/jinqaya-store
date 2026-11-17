"use client";

import Link from "next/link";
import { useState } from "react";
import { CartLink } from "./cart-link";

export function HeaderActions() {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="jq-header-actions">
      <Link className="jq-header-account" href="/account">ACCOUNT</Link>
      <div className="jq-header-search-wrap">
        <button
          className="jq-header-search-toggle"
          type="button"
          aria-label={searchOpen ? "Close product search" : "Open product search"}
          aria-expanded={searchOpen}
          onClick={() => setSearchOpen((open) => !open)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="10.8" cy="10.8" r="6.7" />
            <path d="m16 16 4.3 4.3" />
          </svg>
        </button>
        {searchOpen ? (
          <form className="jq-header-search-panel" action="/shop" method="get" role="search">
            <label className="sr-only" htmlFor="jq-header-search-input">Search products</label>
            <input id="jq-header-search-input" name="q" type="search" placeholder="Search products" autoFocus />
            <button type="submit" aria-label="Submit search">SEARCH</button>
          </form>
        ) : null}
      </div>
      <CartLink />
    </div>
  );
}
