"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type StorefrontCategory = {
  id: string;
  name: string;
  slug: string;
  children: StorefrontCategory[];
};

export function StorefrontNavigation({ roots }: { roots: StorefrontCategory[] }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const close = () => setMobileOpen(false);

  return (
    <nav className="jq-unified-nav" aria-label="Main navigation" ref={menuRef}>
      <div className="jq-desktop-nav">
        <details className="jq-desktop-shop">
          <summary>SHOP</summary>
          <div className="jq-desktop-shop-panel">
            <Link className="jq-shop-all" href="/shop">Shop all collections ↗</Link>
            {roots.map((root) => (
              <section className="jq-desktop-category" key={root.id}>
                <Link href={`/collections/${root.slug}`}>{root.name}</Link>
                {root.children.map((child) => (
                  <div className="jq-desktop-subcategory" key={child.id}>
                    <Link href={`/collections/${child.slug}`}>{child.name}</Link>
                    {child.children.map((leaf) => (
                      <Link className="jq-desktop-leaf" href={`/collections/${leaf.slug}`} key={leaf.id}>{leaf.name}</Link>
                    ))}
                  </div>
                ))}
              </section>
            ))}
          </div>
        </details>
        <Link href="/#collections">DISCOVER</Link>
        <Link href="/about">OUR STORY</Link>
      </div>

      <button
        className="jq-mobile-menu-toggle"
        type="button"
        aria-expanded={mobileOpen}
        aria-controls="jq-mobile-navigation-panel"
        aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
        onClick={() => setMobileOpen((open) => !open)}
      >
        <span aria-hidden="true">{mobileOpen ? "×" : "☰"}</span>
        <span>{mobileOpen ? "CLOSE" : "MENU"}</span>
      </button>

      {mobileOpen && (
        <div className="jq-mobile-nav-backdrop" onClick={close}>
          <div
            className="jq-mobile-nav-panel"
            id="jq-mobile-navigation-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="jq-mobile-panel-top">
              <Link href="/" onClick={close} aria-label="JINQAYA home">JINQAYA</Link>
              <button type="button" onClick={close} aria-label="Close navigation menu">CLOSE <span aria-hidden="true">×</span></button>
            </div>
            <Link className="jq-mobile-nav-primary" href="/shop" onClick={close}>SHOP ALL <span>↗</span></Link>
            <Link className="jq-mobile-nav-primary" href="/#collections" onClick={close}>DISCOVER <span>↗</span></Link>
            <Link className="jq-mobile-nav-primary" href="/about" onClick={close}>OUR STORY <span>↗</span></Link>
            <div className="jq-mobile-category-list">
              <p>SHOP BY COLLECTION</p>
              {roots.map((root) => (
                <details className="jq-mobile-category" key={root.id}>
                  <summary><Link href={`/collections/${root.slug}`} onClick={close}>{root.name}</Link><span aria-hidden="true">＋</span></summary>
                  {root.children.length > 0 && (
                    <div className="jq-mobile-category-children">
                      {root.children.map((child) => (
                        <details className="jq-mobile-subcategory" key={child.id}>
                          <summary><Link href={`/collections/${child.slug}`} onClick={close}>{child.name}</Link><span aria-hidden="true">＋</span></summary>
                          {child.children.map((leaf) => (
                            <Link href={`/collections/${leaf.slug}`} key={leaf.id} onClick={close}>{leaf.name}</Link>
                          ))}
                        </details>
                      ))}
                    </div>
                  )}
                </details>
              ))}
            </div>
            <Link className="jq-mobile-nav-contact" href="/contact" onClick={close}>CONTACT JINQAYA</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
