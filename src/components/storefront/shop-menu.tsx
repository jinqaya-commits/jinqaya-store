"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export type ShopNavCategory = {
  id: string;
  name: string;
  slug: string;
  children: ShopNavCategory[];
};

export function ShopMenu({ roots }: { roots: ShopNavCategory[] }) {
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      const menu = menuRef.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) {
        menu.open = false;
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menuRef.current?.open) {
        menuRef.current.open = false;
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <details className="jq-shop-menu" ref={menuRef}>
      <summary>SHOP</summary>
      <div className="jq-nav-dropdown" aria-label="Shop by category">
        <Link className="jq-nav-all" href="/shop">Shop all collections ↗</Link>
        {roots.map((root) => (
          <section className="jq-nav-group" key={root.id}>
            <Link href={`/collections/${root.slug}`}>{root.name}</Link>
            <div>
              {root.children.map((child) => (
                <div className="jq-nav-subgroup" key={child.id}>
                  <Link href={`/collections/${child.slug}`}>{child.name}</Link>
                  <div>
                    {child.children.map((leaf) => (
                      <Link key={leaf.id} href={`/collections/${leaf.slug}`}>{leaf.name}</Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </details>
  );
}
