'use client';

import type { SolanaClientConfig } from '@solana/client';
import { SolanaProvider } from '@solana/react-hooks';
import type { PropsWithChildren } from 'react';

const defaultConfig: SolanaClientConfig = {
	cluster: 'mainnet-beta',
};

export function Providers({ children }: PropsWithChildren) {
	return <SolanaProvider config={defaultConfig}>{children}</SolanaProvider>;
}