import localFont from "next/font/local";
import { ShieldCheck, Github, Zap } from "lucide-react";

const bitcountFont = localFont({
  src: "../../app/fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

export function TrustSection() {
  return (
    <section className="max-w-5xl mx-auto px-4 py-16">
      <h2
        className={`${bitcountFont.className} text-3xl text-neutral-600 dark:text-neutral-400 text-center mb-12`}
      >
        <span className="text-vibrant-red">{"//"}</span> trust & security
      </h2>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 bg-white dark:bg-neutral-900 text-center">
          <ShieldCheck className="w-10 h-10 text-vibrant-red mx-auto mb-4" />
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2 lowercase">
            non-custodial
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 lowercase">
            never holds your keys. read-only view of any public wallet address.
          </p>
        </div>
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 bg-white dark:bg-neutral-900 text-center">
          <Github className="w-10 h-10 text-vibrant-red mx-auto mb-4" />
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2 lowercase">
            open source
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 lowercase">
            fully transparent SDK. inspect the code, contribute, or self-host.
          </p>
        </div>
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 bg-white dark:bg-neutral-900 text-center">
          <Zap className="w-10 h-10 text-vibrant-red mx-auto mb-4" />
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2 lowercase">
            instant loads
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 lowercase">
            redis caching for sub-second subsequent page loads. server-side RPC.
          </p>
        </div>
      </div>
    </section>
  );
}
