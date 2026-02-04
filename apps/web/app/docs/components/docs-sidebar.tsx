"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const sections = [
  { id: "installation", label: "installation" },
  { id: "quick-start", label: "quick start" },
  { id: "api-reference", label: "API reference" },
  { id: "transaction-types", label: "transaction types" },
  { id: "examples", label: "examples" },
  { id: "rpc-compatibility", label: "RPC compatibility" },
  { id: "bundle-size", label: "bundle size" },
];

export function DocsSidebar() {
  const [activeSection, setActiveSection] = useState<string>("installation");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        rootMargin: "-20% 0px -80% 0px",
      }
    );

    sections.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <aside className="hidden lg:block fixed top-24 left-[max(2rem,calc(50%-36rem))] w-56">
      <nav>
        <p className="text-xs font-semibold text-neutral-400 lowercase tracking-wider mb-4">
          on this page
        </p>
        <ul className="space-y-1 border-l border-neutral-200">
          {sections.map(({ id, label }) => (
            <li key={id}>
              <button
                onClick={() => scrollToSection(id)}
                className={cn(
                  "text-sm lowercase text-left w-full py-1.5 px-3 -ml-px border-l-2 transition-colors",
                  activeSection === id
                    ? "text-vibrant-red border-vibrant-red font-medium bg-red-50/50"
                    : "text-neutral-500 border-transparent hover:text-neutral-900 hover:border-neutral-300"
                )}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
