import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar/sidebar";
import { NoisyBackground } from "@/components/noisy-bg";
import { GridBackground } from "@/components/grid-bg";
import { PrivacyDebugProvider } from "@/components/dev/privacy-debug-provider";
import { DrawerProvider } from "@/contexts/drawer-context";
import { GlobalDrawers } from "@/components/global-drawers";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="md:pl-56 md:pt-4 md:pb-4">
        {/* Wrapper with clip to contain fixed backgrounds */}
        <div className="md:rounded-l-2xl md:[clip-path:inset(0_0_0_0_round_1rem_0_0_1rem)] min-h-screen md:min-h-[calc(100vh-2rem)]">
          {/* Fixed backgrounds - clipped by parent */}
          <div className="fixed inset-0 md:top-4 md:bottom-4 md:left-56 md:right-0 md:rounded-l-2xl overflow-hidden pointer-events-none">
            <GridBackground className="md:rounded-l-2xl" />
            <NoisyBackground />
          </div>
          {/* Content container */}
          <div className="relative md:rounded-l-2xl md:border-t md:border-l md:border-b md:border-neutral-200 md:dark:border-neutral-800 min-h-screen md:min-h-[calc(100vh-2rem)]">
            <DrawerProvider>
              <PrivacyDebugProvider>
                <Header />
                <main className="relative z-10">{children}</main>
                <GlobalDrawers />
              </PrivacyDebugProvider>
            </DrawerProvider>
          </div>
        </div>
      </div>
    </div>
  );
}
