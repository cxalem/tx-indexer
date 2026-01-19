import type { TokenInfo } from './money.types';
import { createUnknownToken, TOKEN_INFO } from './token-registry';

interface JupiterTokenV2 {
	id: string;
	symbol: string;
	name: string;
	decimals: number;
	icon?: string | null;
	tags?: string[] | null;
	isVerified?: boolean | null;
}

export interface TokenFetcherOptions {
	jupiterApiUrl?: string;
	jupiterApiKey?: string;
	cacheTtlMs?: number;
	prefetch?: boolean;
}

const DEFAULT_JUPITER_API_URL = 'https://api.jup.ag/tokens/v2/tag?query=verified';
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT_MS = 10_000; // 10 seconds
const MIN_RETRY_INTERVAL_MS = 30_000; // Don't retry more than once per 30s on network errors

export interface TokenFetcher {
	getToken(mint: string, decimals?: number): Promise<TokenInfo>;
	getTokens(mints: string[], defaultDecimals?: number): Promise<Map<string, TokenInfo>>;
	refresh(): Promise<void>;
	getCacheSize(): number;
}

export function createTokenFetcher(options: TokenFetcherOptions = {}): TokenFetcher {
	const {
		jupiterApiUrl = DEFAULT_JUPITER_API_URL,
		jupiterApiKey = globalThis.process?.env?.JUPITER_API_KEY,
		cacheTtlMs = DEFAULT_CACHE_TTL_MS,
		prefetch = false,
	} = options;

	const jupiterCache = new Map<string, TokenInfo>();
	let lastFetchTime = 0;
	let lastErrorTime = 0;
	let fetchPromise: Promise<void> | null = null;

	async function fetchJupiterTokens(): Promise<void> {
		if (fetchPromise) {
			return fetchPromise;
		}

		const now = Date.now();

		if (now - lastFetchTime < cacheTtlMs && jupiterCache.size > 0) {
			return;
		}

		if (now - lastErrorTime < MIN_RETRY_INTERVAL_MS && jupiterCache.size === 0) {
			return;
		}

		fetchPromise = (async () => {
			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

				const headers: Record<string, string> = {};
				if (jupiterApiKey) {
					headers['x-api-key'] = jupiterApiKey;
				}

				const response = await fetch(jupiterApiUrl, {
					signal: controller.signal,
					headers,
				});
				clearTimeout(timeoutId);

				if (!response.ok) {
					console.warn(`Jupiter API returned ${response.status}: ${response.statusText}`);
					lastErrorTime = Date.now();
					return;
				}

				const tokens = (await response.json()) as JupiterTokenV2[];

				jupiterCache.clear();

				for (const token of tokens) {
					jupiterCache.set(token.id, {
						mint: token.id,
						symbol: token.symbol,
						name: token.name,
						decimals: token.decimals,
						logoURI: token.icon ?? undefined,
					});
				}

				lastFetchTime = Date.now();
				lastErrorTime = 0;
			} catch (error) {
				lastErrorTime = Date.now();
				const isNetworkError =
					error instanceof Error &&
					(error.message.includes('fetch failed') ||
						error.message.includes('ENOTFOUND') ||
						error.message.includes('ECONNREFUSED') ||
						error.message.includes('ETIMEDOUT') ||
						error.name === 'AbortError');

				if (!isNetworkError) {
					console.warn('Failed to fetch Jupiter tokens:', error);
				}
			} finally {
				fetchPromise = null;
			}
		})();

		return fetchPromise;
	}

	async function getToken(mint: string, decimals = 9): Promise<TokenInfo> {
		const staticToken = TOKEN_INFO[mint];
		if (staticToken) {
			return staticToken;
		}

		const cachedToken = jupiterCache.get(mint);
		if (cachedToken) {
			return cachedToken;
		}

		await fetchJupiterTokens();

		const fetchedToken = jupiterCache.get(mint);
		if (fetchedToken) {
			return fetchedToken;
		}

		return createUnknownToken(mint, decimals);
	}

	async function getTokens(mints: string[], defaultDecimals = 9): Promise<Map<string, TokenInfo>> {
		const result = new Map<string, TokenInfo>();
		const missingMints: string[] = [];

		for (const mint of mints) {
			const staticToken = TOKEN_INFO[mint];
			if (staticToken) {
				result.set(mint, staticToken);
				continue;
			}

			const cachedToken = jupiterCache.get(mint);
			if (cachedToken) {
				result.set(mint, cachedToken);
				continue;
			}

			missingMints.push(mint);
		}

		if (missingMints.length > 0) {
			await fetchJupiterTokens();

			for (const mint of missingMints) {
				const fetchedToken = jupiterCache.get(mint);
				if (fetchedToken) {
					result.set(mint, fetchedToken);
				} else {
					result.set(mint, createUnknownToken(mint, defaultDecimals));
				}
			}
		}

		return result;
	}

	async function refresh(): Promise<void> {
		lastFetchTime = 0;
		await fetchJupiterTokens();
	}

	function getCacheSize(): number {
		return jupiterCache.size;
	}

	if (prefetch) {
		fetchJupiterTokens().catch(() => {
			// Ignore prefetch errors
		});
	}

	return {
		getToken,
		getTokens,
		refresh,
		getCacheSize,
	};
}

let defaultFetcher: TokenFetcher | null = null;

export function getDefaultTokenFetcher(): TokenFetcher {
	if (!defaultFetcher) {
		defaultFetcher = createTokenFetcher();
	}
	return defaultFetcher;
}
