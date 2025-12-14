'use client';

import type { SolanaClientConfig } from '@solana/client';
import { SolanaProvider } from '@solana/react-hooks';
import type { PropsWithChildren } from 'react';

const defaultConfig: SolanaClientConfig = {
	endpoint: process.env.RPC_URL!,
};

export function Providers({ children }: PropsWithChildren) {
	return <SolanaProvider config={defaultConfig}>{children}</SolanaProvider>;
}