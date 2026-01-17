import localFont from "next/font/local";
import { ShieldCheck, Github, Zap } from "lucide-react";

const bitcountFont = localFont({
  src: "../../app/fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    title: "non-custodial",
    description:
      "never holds your keys. read-only view of any public wallet address.",
  },
  {
    icon: Github,
    title: "open source",
    description:
      "fully transparent SDK and dashboard. inspect the code, contribute, or self-host.",
  },
  {
    icon: Zap,
    title: "instant loads",
    description:
      "redis caching for sub-second subsequent page loads. server-side RPC.",
  },
];

export function TrustSection() {
  return (
    <section className="max-w-5xl mx-auto px-4 py-16 md:my-20">
      <h2
        className={`${bitcountFont.className} text-3xl text-neutral-600 dark:text-neutral-400 text-center mb-12`}
      >
        <span className="text-vibrant-red">{"//"}</span> trust & security
      </h2>

      <div className="max-w-2xl mx-auto space-y-6">
        {TRUST_ITEMS.map((item) => (
          <div
            key={item.title}
            className="flex items-start gap-5 p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
          >
            <div className="shrink-0 p-3 rounded-xl bg-vibrant-red/10">
              <item.icon className="w-8 h-8 text-vibrant-red" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1 lowercase">
                {item.title}
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 lowercase">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
