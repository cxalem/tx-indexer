import localFont from "next/font/local";
import { ArrowRight, Code2 } from "lucide-react";

const bitcountFont = localFont({
  src: "../../app/fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

export function DevelopersSection() {
  return (
    <section className="max-w-5xl mx-auto px-4 py-16">
      <a
        href="https://itx-indexer.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="group block border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 md:p-10 bg-white dark:bg-neutral-900 hover:border-vibrant-red/50 transition-all duration-300"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 group-hover:bg-vibrant-red/10 transition-colors duration-300">
              <Code2 className="w-8 h-8 text-vibrant-red" />
            </div>
            <div>
              <h2
                className={`${bitcountFont.className} text-2xl md:text-3xl text-neutral-600 dark:text-neutral-400 mb-2`}
              >
                <span className="text-vibrant-red">{"//"}</span> for developers
              </h2>
              <p className="text-neutral-500 dark:text-neutral-400 lowercase max-w-md">
                use the open source SDK directly in your applications. full
                documentation and examples available.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-vibrant-red font-medium lowercase shrink-0">
            <span>read the docs</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
          </div>
        </div>
      </a>
    </section>
  );
}
