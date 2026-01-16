import localFont from "next/font/local";

const bitcountFont = localFont({
  src: "../../app/fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

const STEPS = [
  {
    number: 1,
    title: "connect wallet",
    description: "connect your solana wallet to view your transaction history.",
  },
  {
    number: 2,
    title: "auto-classify",
    description:
      "transactions are fetched and classified automatically with protocol detection.",
  },
  {
    number: 3,
    title: "clear activity",
    description:
      "see labeled activity with amounts, counterparties, and protocol info.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="max-w-4xl mx-auto px-4 py-16">
      <h2
        className={`${bitcountFont.className} text-3xl text-neutral-600 dark:text-neutral-400 text-center mb-12`}
      >
        <span className="text-vibrant-red">{"//"}</span> how it works
      </h2>

      <div className="grid md:grid-cols-3 gap-8">
        {STEPS.map((step) => (
          <div key={step.number} className="text-center">
            <div className="w-12 h-12 bg-vibrant-red text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
              {step.number}
            </div>
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2 lowercase">
              {step.title}
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 lowercase">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
