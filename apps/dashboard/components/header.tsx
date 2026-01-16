import { ConnectWalletButton } from "./connect-wallet-button";
import { MobileSidebar } from "./sidebar";

interface HeaderProps {
  showMobileNav?: boolean;
}

export function Header({ showMobileNav = true }: HeaderProps) {
  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
      <div className="px-4 py-3 flex items-center justify-between">
        {showMobileNav ? <MobileSidebar /> : <div />}
        <div className="flex-1" />
        <ConnectWalletButton />
      </div>
    </header>
  );
}
