"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { localizeHref, type SiteLocale } from "@/lib/i18n/config";

import { publicNavigationItems } from "./public-navigation";

export function MobileNavigation({ language }: { language: SiteLocale }) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isChinese = language === "zh-CN";

  useEffect(() => {
    if (!isOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, [isOpen]);

  return (
    <div className="relative lg:hidden" ref={containerRef}>
      <button
        aria-controls="mobile-primary-navigation"
        aria-expanded={isOpen}
        aria-label={isChinese
          ? isOpen ? "关闭主导航" : "打开主导航"
          : isOpen ? "Close navigation" : "Open navigation"}
        className="inline-flex size-11 items-center justify-center border-l border-[var(--line)] text-[var(--ink)] hover:bg-[var(--surface-subtle)]"
        onClick={() => setIsOpen((open) => !open)}
        ref={buttonRef}
        type="button"
      >
        {isOpen ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
      </button>
      {isOpen ? (
        <nav
          aria-label={isChinese ? "移动端主导航" : "Mobile primary navigation"}
          className="absolute right-0 top-[calc(100%+0.75rem)] w-72 max-w-[calc(100vw-1.5rem)] border border-[var(--line)] bg-white p-2 shadow-[var(--shadow-md)]"
          id="mobile-primary-navigation"
        >
          {publicNavigationItems[language].map((item) => (
            <Link
              className="flex min-h-11 items-center border-b border-[var(--line)] px-3 text-sm font-medium text-[var(--ink)] last:border-b-0 hover:bg-[var(--surface-subtle)]"
              href={localizeHref(item.href, language)}
              key={item.href}
              onClick={() => setIsOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
