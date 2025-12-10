import type { SolanaTransaction } from "@tx-indexer/solana/types/transaction.types";
import {
  SPL_MEMO_PROGRAM_ID,
  MEMO_V1_PROGRAM_ID,
} from "@tx-indexer/solana/constants/program-ids";
import bs58 from "bs58";

interface TransactionWithLogs extends SolanaTransaction {
  meta?: {
    logMessages?: readonly string[] | null;
  };
}

function decodeMemoData(base64Data: string): string {
  const buffer = Buffer.from(base64Data, "base64");

  const text = buffer.toString("utf-8");
  if (!text.includes("\ufffd") && /^[\x20-\x7E\s]*$/.test(text)) {
    return text;
  }

  if (buffer.length === 32) {
    return bs58.encode(buffer);
  }

  if (buffer.length % 32 === 0 && buffer.length > 0) {
    const addresses: string[] = [];
    for (let i = 0; i < buffer.length; i += 32) {
      const chunk = buffer.subarray(i, i + 32);
      addresses.push(bs58.encode(chunk));
    }
    return addresses.join(", ");
  }

  if (buffer.length >= 16) {
    const uuidBytes = buffer.subarray(0, 16);
    const uuid = [
      uuidBytes.subarray(0, 4).toString("hex"),
      uuidBytes.subarray(4, 6).toString("hex"),
      uuidBytes.subarray(6, 8).toString("hex"),
      uuidBytes.subarray(8, 10).toString("hex"),
      uuidBytes.subarray(10, 16).toString("hex"),
    ].join("-");

    if (buffer.length === 16) {
      return `Product: ${uuid}`;
    }

    const extraData = buffer.subarray(16);
    const extraHex = extraData.toString("hex");
    return `Product: ${uuid} | Meta: ${extraHex}`;
  }

  return bs58.encode(buffer);
}

/**
 * Extracts memo data from a Solana transaction.
 * 
 * First attempts to extract human-readable memos from program logs, which contain
 * the decoded text. Falls back to parsing memo program instructions for binary data.
 * Handles various memo formats including UTF-8 text, public keys, and Solana Pay metadata.
 * 
 * @param transaction - Solana transaction with message and optional logs
 * @returns Extracted memo string, or null if no memo is found
 */
export function extractMemo(transaction: TransactionWithLogs): string | null {
  if (transaction.meta?.logMessages) {
    const memoLogPattern = /Program log: Memo \(len \d+\): "(.+)"/;
    for (const log of transaction.meta.logMessages) {
      const match = log.match(memoLogPattern);
      if (match?.[1]) {
        return match[1];
      }
    }
  }

  const { message } = transaction;
  const { accountKeys, instructions } = message;

  for (const ix of instructions) {
    const programId = accountKeys[ix.programIdIndex]?.toString();

    if (programId === SPL_MEMO_PROGRAM_ID || programId === MEMO_V1_PROGRAM_ID) {
      if (ix.data) {
        try {
          return decodeMemoData(ix.data);
        } catch (e) {
          console.warn("Failed to decode memo:", e);
        }
      }
    }
  }

  return null;
}

export interface SolanaPayMemo {
  merchant?: string;
  item?: string;
  reference?: string;
  label?: string;
  message?: string;
  raw: string;
}

/**
 * Parses a Solana Pay memo string into structured fields.
 * 
 * Attempts to parse the memo as JSON to extract merchant, item, reference,
 * label, and message fields. Falls back to returning just the raw memo if parsing fails.
 * 
 * @param memo - Memo string to parse
 * @returns Parsed Solana Pay memo object with raw memo included
 */
export function parseSolanaPayMemo(memo: string): SolanaPayMemo {
  try {
    const parsed = JSON.parse(memo);
    return { ...parsed, raw: memo };
  } catch {
    return { raw: memo };
  }
}

/**
 * Determines if a transaction is a Solana Pay transaction.
 * 
 * A transaction is considered Solana Pay if it includes the SPL Memo program
 * and has a non-null memo. Solana Pay uses memos to attach payment metadata.
 * 
 * @param programIds - Program IDs involved in the transaction
 * @param memo - Extracted memo from the transaction
 * @returns True if this is a Solana Pay transaction
 */
export function isSolanaPayTransaction(
  programIds: string[],
  memo: string | null | undefined
): boolean {
  const hasMemoProgram =
    programIds.includes(SPL_MEMO_PROGRAM_ID) ||
    programIds.includes(MEMO_V1_PROGRAM_ID);

  return hasMemoProgram && memo !== null && memo !== undefined;
}
