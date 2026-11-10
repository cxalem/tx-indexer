import type { LoadedAddresses } from "@tx-indexer/core/tx/tx.types";

type KeyLike = string | { toString(): string } | { pubkey: string };

function keyToString(key: KeyLike): string {
  if (typeof key === "string") return key;
  if (typeof key === "object" && key !== null && "pubkey" in key) {
    return String(key.pubkey);
  }
  return key.toString();
}

/**
 * Shape of `meta.loadedAddresses` as returned by `getTransaction` for
 * versioned transactions (addresses may be strings or kit `Address` values).
 */
export interface LoadedAddressesInput {
  writable?: readonly KeyLike[] | null;
  readonly?: readonly KeyLike[] | null;
}

/**
 * Normalizes `meta.loadedAddresses` into plain string arrays.
 * Returns undefined when the RPC response did not include the field.
 */
export function normalizeLoadedAddresses(
  loaded: LoadedAddressesInput | null | undefined,
): LoadedAddresses | undefined {
  if (!loaded) return undefined;
  return {
    writable: (loaded.writable ?? []).map(keyToString),
    readonly: (loaded.readonly ?? []).map(keyToString),
  };
}

/**
 * Resolves the full account list of a transaction in runtime order.
 *
 * For `getTransaction(..., { encoding: "json" })`, a v0 transaction's
 * lookup-table accounts are NOT in `transaction.message.accountKeys`; they are
 * reported in `meta.loadedAddresses`. `meta.preBalances`, `meta.postBalances`
 * and token balance `accountIndex` values all index the full list:
 *
 *   [...staticKeys, ...loadedAddresses.writable, ...loadedAddresses.readonly]
 *
 * The order is load-bearing: the list is never sorted and never deduplicated.
 * `result[0]` is always the fee payer (the first static key). Legacy
 * transactions and v0 transactions without lookups resolve to the static keys
 * unchanged.
 *
 * @param staticKeys - `transaction.message.accountKeys`
 * @param loaded - `meta.loadedAddresses` (optional)
 */
export function resolveAccountKeys(
  staticKeys: readonly KeyLike[],
  loaded?: LoadedAddressesInput | LoadedAddresses | null,
): string[] {
  const resolved = staticKeys.map(keyToString);
  if (loaded) {
    for (const key of loaded.writable ?? []) resolved.push(keyToString(key));
    for (const key of loaded.readonly ?? []) resolved.push(keyToString(key));
  }
  return resolved;
}
