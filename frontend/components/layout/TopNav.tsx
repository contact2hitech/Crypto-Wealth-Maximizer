"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LineChart, Menu, X } from "lucide-react";
import { NAV_ROUTES } from "@/lib/constants/navigation";
import { ApiStatusBadge } from "@/components/layout/ApiStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TopNav() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-[#080c14]/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-foreground"
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-sky-500/35 bg-sky-500/10 text-sky-400">
              <LineChart className="h-4 w-4" />
            </span>
            <span className="whitespace-nowrap">Crypto Wealth Maximizer</span>
            <Badge
              variant="outline"
              className="hidden border-border bg-secondary/80 px-1.5 py-0 font-mono text-[10px] text-muted-foreground sm:inline-flex"
            >
              v2.0
            </Badge>
          </Link>

          <nav aria-label="Primary navigation" className="hidden items-center gap-1 lg:flex">
            {NAV_ROUTES.map((route) => {
              const isActive =
                pathname === route.href || pathname.startsWith(`${route.href}/`);
              return (
                <Link
                  key={route.href}
                  href={route.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-secondary text-sky-300 ring-1 ring-inset ring-sky-500/30"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  {route.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:block">
            <ApiStatusBadge />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-primary-nav"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div
          id="mobile-primary-nav"
          className="border-t border-border/80 bg-[#0b101b] px-4 py-3 lg:hidden"
        >
          <div className="mb-3 flex items-center justify-between border-b border-border/60 pb-3 sm:hidden">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Backend Status
            </span>
            <ApiStatusBadge compact />
          </div>
          <nav aria-label="Mobile navigation" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {NAV_ROUTES.map((route) => {
              const isActive =
                pathname === route.href || pathname.startsWith(`${route.href}/`);
              return (
                <Link
                  key={route.href}
                  href={route.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-secondary text-sky-300 ring-1 ring-inset ring-sky-500/30"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  {route.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

