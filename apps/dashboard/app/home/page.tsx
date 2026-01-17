import {
  HeroSection,
  BeforeAfterSection,
  TransactionTypesSection,
  ProtocolDetectionSection,
  FeaturesSection,
  TrustSection,
  DevelopersSection,
  FooterSection,
} from "@/components/landing";

export default function HomePage() {
  return (
    <div className="w-full">
      <HeroSection />
      <BeforeAfterSection />
      <TransactionTypesSection />
      <ProtocolDetectionSection />
      <FeaturesSection />
      <TrustSection />
      <DevelopersSection />
      <FooterSection />
    </div>
  );
}
