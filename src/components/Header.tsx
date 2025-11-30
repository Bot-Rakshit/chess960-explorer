"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface HeaderProps {
  variant?: "default" | "centered";
}

export default function Header({ variant = "default" }: HeaderProps) {
  const pathname = usePathname();
  
  const navItems = [
    { href: "/explore", label: "Explore" },
    { href: "/challenge", label: "Challenge" },
    { href: "/about", label: "About" },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <header className="border-b border-white/5 bg-surface/80 backdrop-blur-sm sticky top-0 z-50">
      <div className={`${variant === "centered" ? "max-w-6xl mx-auto" : ""} px-4 sm:px-6 py-3 flex items-center justify-between`}>
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center transition-transform group-hover:scale-105">
            <span className="text-background font-bold text-sm">960</span>
          </div>
          <span className="font-semibold text-creme hidden sm:block">Chess960 Explorer</span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isActive(item.href)
                  ? "text-accent font-medium bg-accent/10"
                  : "text-creme-muted hover:text-creme hover:bg-white/5"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
