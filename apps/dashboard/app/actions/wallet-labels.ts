"use server";

import { createClient } from "@/lib/supabase/server";
import {
  solanaAddressSchema,
  upsertWalletLabelSchema,
} from "@/lib/validations";

export interface WalletLabel {
  id: string;
  address: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fetches all wallet labels for the current user
 */
export async function getWalletLabels(): Promise<WalletLabel[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("wallet_labels")
    .select("id, address, label, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[WalletLabels] Failed to fetch labels:", error);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    address: row.address,
    label: row.label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Gets a label for a specific address
 */
export async function getLabelForAddress(
  address: string,
): Promise<string | null> {
  // Validate address
  const addressResult = solanaAddressSchema.safeParse(address);
  if (!addressResult.success) {
    return null;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("wallet_labels")
    .select("label")
    .eq("user_id", user.id)
    .eq("address", addressResult.data)
    .single();

  if (error || !data) {
    return null;
  }

  return data.label;
}

/**
 * Creates or updates a label for an address
 */
export async function upsertWalletLabel(
  address: string,
  label: string,
): Promise<{ success: boolean; error?: string }> {
  // Validate inputs with Zod
  const validationResult = upsertWalletLabelSchema.safeParse({
    address,
    label,
  });
  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
    return { success: false, error: firstError?.message || "Invalid input" };
  }

  const { address: validAddress, label: validLabel } = validationResult.data;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase.from("wallet_labels").upsert(
    {
      user_id: user.id,
      address: validAddress,
      label: validLabel,
    },
    {
      onConflict: "user_id,address",
    },
  );

  if (error) {
    console.error("[WalletLabels] Failed to upsert label:", error);
    return { success: false, error: "Failed to save label" };
  }

  return { success: true };
}

/**
 * Deletes a label for an address
 */
export async function deleteWalletLabel(
  address: string,
): Promise<{ success: boolean; error?: string }> {
  // Validate address
  const addressResult = solanaAddressSchema.safeParse(address);
  if (!addressResult.success) {
    return { success: false, error: "Invalid address format" };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("wallet_labels")
    .delete()
    .eq("user_id", user.id)
    .eq("address", addressResult.data);

  if (error) {
    console.error("[WalletLabels] Failed to delete label:", error);
    return { success: false, error: "Failed to delete label" };
  }

  return { success: true };
}

/**
 * Generates a default label like "wallet 1", "wallet 2", etc.
 */
export async function generateDefaultLabel(): Promise<string> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return "wallet 1";
  }

  const { count } = await supabase
    .from("wallet_labels")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  return `wallet ${(count ?? 0) + 1}`;
}
