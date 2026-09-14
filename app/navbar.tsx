"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/app/brand";
import styles from "./navbar.module.css";

type NavItem = { href: string; label: string };

const items: NavItem[] = [
  { href: "/dashboard", label: "Records" },
  { href: "/add", label: "Add record" },
  { href: "/team", label: "Team" },
  { href: "/settings", label: "Settings" },
];

export function Navbar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <header className={styles.navbar}>
      <div className={styles.inner}>
        <Link href="/dashboard" className={styles.brandLink}>
          <Brand />
        </Link>

        <nav className={styles.nav} aria-label="Primary">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  active ? `${styles.link} ${styles.linkActive}` : styles.link
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.session}>
          <span className={styles.userEmail}>{email}</span>
          <form action="/auth/signout" method="post">
            <button type="submit" className={styles.signOut}>
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}