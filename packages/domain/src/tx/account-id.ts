export type AccountIdType = "wallet" | "protocol" | "external" | "fee";

export interface BuildAccountIdParams {
  type: AccountIdType;
  address: string;
  protocol?: string;
  token?: string;
}

export function buildAccountId(params: BuildAccountIdParams): string {
  const { type, address, protocol, token } = params;

  if (type === "wallet") {
    return `wallet:${address}`;
  }

  if (type === "protocol" && protocol) {
    if (token) {
      return `protocol:${protocol}:${token}:${address}`;
    }
    return `protocol:${protocol}:${address}`;
  }

  if (type === "external") {
    return `external:${address}`;
  }

  if (type === "fee") {
    return "fee:network";
  }
  
  throw new Error(
    `Invalid accountId parameters: type=${type}, address=${address}, protocol=${protocol}`
  );
}

export interface ParsedAccountId {
  type: AccountIdType | "unknown";
  address?: string;
  protocol?: string;
  token?: string;
}

export function parseAccountId(accountId: string): ParsedAccountId {
  const parts = accountId.split(":");

  if (parts[0] === "wallet" && parts.length === 2) {
    return { type: "wallet", address: parts[1] };
  }

  if (parts[0] === "protocol") {
    if (parts.length === 4) {
      return {
        type: "protocol",
        protocol: parts[1],
        token: parts[2],
        address: parts[3],
      };
    }
    if (parts.length === 3) {
      return {
        type: "protocol",
        protocol: parts[1],
        address: parts[2],
      };
    }
  }

  if (parts[0] === "external" && parts.length === 2) {
    return { type: "external", address: parts[1] };
  }

  if (parts[0] === "fee" && parts[1] === "network") {
    return { type: "fee" };
  }

  return { type: "unknown", address: accountId };
}
