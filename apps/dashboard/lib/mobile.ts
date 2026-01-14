export function isMobileDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  return /android|iphone|ipad|ipod|webos|blackberry|windows phone/i.test(
    navigator.userAgent,
  );
}

export function isAndroid(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /android/i.test(navigator.userAgent);
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function supportsMWA(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.isSecureContext && isAndroid();
}

export function hasPhantomExtension(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const phantom = (window as WindowWithPhantom).phantom;
  return Boolean(phantom?.solana?.isPhantom);
}

export function hasSolflareExtension(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return Boolean((window as WindowWithSolflare).solflare?.isSolflare);
}

export function hasBackpackExtension(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return Boolean((window as WindowWithBackpack).backpack?.isBackpack);
}

export function hasWalletExtension(): boolean {
  return (
    hasPhantomExtension() || hasSolflareExtension() || hasBackpackExtension()
  );
}

export function isInWalletBrowser(): boolean {
  return isMobileDevice() && hasWalletExtension();
}

interface PhantomSolana {
  isPhantom?: boolean;
}

interface WindowWithPhantom {
  phantom?: {
    solana?: PhantomSolana;
  };
}

interface WindowWithSolflare {
  solflare?: {
    isSolflare?: boolean;
  };
}

interface WindowWithBackpack {
  backpack?: {
    isBackpack?: boolean;
  };
}
