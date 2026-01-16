import localFont from "next/font/local";
import { FooterCTA } from "./footer-cta";

const bitcountFont = localFont({
  src: "../../app/fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

export function FooterSection() {
  return (
    <section className="max-w-3xl mx-auto px-4 py-20 text-center">
      <h2
        className={`${bitcountFont.className} text-4xl text-neutral-900 dark:text-neutral-100 mb-4`}
      >
        <span className="text-vibrant-red">{"//"}</span> try it now
      </h2>
      <FooterCTA />
    </section>
  );
}
