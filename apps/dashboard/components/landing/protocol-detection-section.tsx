import localFont from "next/font/local";

const bitcountFont = localFont({
  src: "../../app/fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

const PROTOCOLS = [
  "Jupiter",
  "Raydium",
  "Orca",
  "Metaplex",
  "Wormhole",
  "Pump.fun",
  "Marinade",
  "Jito",
  "Tensor",
  "Magic Eden",
];

export function ProtocolDetectionSection() {
  return (
    <section className="max-w-5xl mx-auto px-4 py-16">
      <h2
        className={`${bitcountFont.className} text-3xl text-neutral-600 dark:text-neutral-400 text-center mb-4`}
      >
        <span className="text-vibrant-red">{"//"}</span> protocol detection
      </h2>
      <p className="text-center text-neutral-500 dark:text-neutral-400 mb-8 lowercase">
        recognizes 30+ protocols automatically
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        {PROTOCOLS.map((protocol) => (
          <span
            key={protocol}
            className="px-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-full text-sm text-neutral-700 dark:text-neutral-300 lowercase"
          >
            {protocol}
          </span>
        ))}
        <span className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-full text-sm text-neutral-500 dark:text-neutral-400 lowercase">
          +20 more
        </span>
      </div>
    </section>
  );
}
