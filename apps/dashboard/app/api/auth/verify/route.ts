import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import nacl from "tweetnacl";
import bs58 from "bs58";
import {
  validateAndConsumeNonce,
  authRateLimiter,
  isRedisConfigured,
} from "@/lib/redis";
import { authVerifySchema } from "@/lib/validations";

/**
 * Verifies the signed message and creates/retrieves a Supabase session
 */
export async function POST(request: NextRequest) {
  try {
    // Check if Redis is configured
    if (!isRedisConfigured()) {
      console.error(
        "[Auth] Redis not configured - nonce validation unavailable",
      );
      return NextResponse.json(
        { error: "Authentication service unavailable" },
        { status: 503 },
      );
    }

    // Rate limit by IP
    const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success, limit, reset, remaining } = await authRateLimiter.limit(
      `verify:${ip}`,
    );

    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          },
        },
      );
    }

    // Parse and validate request body with Zod
    const body = await request.json();
    const validationResult = authVerifySchema.safeParse(body);

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || "Invalid request" },
        { status: 400 },
      );
    }

    const { walletAddress, signature, message, nonce } = validationResult.data;

    // Validate and consume the nonce (single-use)
    const isNonceValid = await validateAndConsumeNonce(nonce);
    if (!isNonceValid) {
      return NextResponse.json(
        { error: "Invalid or expired nonce. Please try again." },
        { status: 400 },
      );
    }

    // Verify the message contains the nonce
    if (!message.includes(nonce)) {
      return NextResponse.json(
        { error: "Invalid message: nonce mismatch" },
        { status: 400 },
      );
    }

    // Verify the signature
    const isValid = verifySignature(walletAddress, signature, message);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Create or get user in Supabase
    const supabase = createAdminClient();

    // Use wallet address as the unique identifier
    // Supabase lowercases emails, so we need to match that
    const email = `${walletAddress.toLowerCase()}@solana.wallet`;

    // Try to create user first - if they exist, Supabase will return an error
    // This is more efficient than listing all users
    let userId: string;

    const { data: newUser, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          wallet_address: walletAddress,
        },
      });

    if (createError) {
      // Check various error messages that indicate user exists
      const userExistsErrors = [
        "already been registered",
        "already exists",
        "duplicate key",
        "unique constraint",
      ];
      const isUserExists = userExistsErrors.some((msg) =>
        createError.message?.toLowerCase().includes(msg.toLowerCase()),
      );

      if (isUserExists) {
        // User exists - fetch all users and find by email
        const { data: users, error: listError } =
          await supabase.auth.admin.listUsers();

        if (listError) {
          console.error("[Auth] Failed to list users:", listError);
          return NextResponse.json(
            { error: "Failed to authenticate user" },
            { status: 500 },
          );
        }

        const foundUser = users?.users?.find((u) => u.email === email);

        if (!foundUser) {
          console.error("[Auth] User exists but could not be found");
          return NextResponse.json(
            { error: "Failed to authenticate user" },
            { status: 500 },
          );
        }
        userId = foundUser.id;
      } else {
        console.error("[Auth] Failed to create user:", createError.message);
        return NextResponse.json(
          { error: "Failed to create user" },
          { status: 500 },
        );
      }
    } else if (newUser.user) {
      userId = newUser.user.id;
    } else {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 },
      );
    }

    // Generate a session for the user
    const { data: sessionData, error: sessionError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
      });

    if (sessionError || !sessionData) {
      console.error("[Auth] Failed to generate session:", sessionError);
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 },
      );
    }

    // Extract the token from the action link
    const url = new URL(sessionData.properties.action_link);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Failed to generate token" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        userId,
        token,
        tokenType: "magiclink",
      },
      {
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      },
    );
  } catch (error) {
    console.error("[Auth] Verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Verifies an Ed25519 signature from a Solana wallet
 */
function verifySignature(
  walletAddress: string,
  signature: string,
  message: string,
): boolean {
  try {
    const publicKey = bs58.decode(walletAddress);
    const signatureBytes = bs58.decode(signature);
    const messageBytes = new TextEncoder().encode(message);

    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey);
  } catch {
    return false;
  }
}
