import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { NoisyBackground } from "@/components/noisy-bg";
import { GridBackground } from "@/components/grid-bg";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="md:pl-56 md:pt-4 md:pb-4">
        <div className="relative md:rounded-l-2xl md:border-t md:border-l md:border-b md:border-neutral-200 md:dark:border-neutral-800 bg-white dark:bg-neutral-950 min-h-screen md:min-h-[calc(100vh-2rem)] overflow-hidden">
          <GridBackground contained className="md:rounded-2xl" />
          <NoisyBackground contained />
          <Header />
          <main className="relative z-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
