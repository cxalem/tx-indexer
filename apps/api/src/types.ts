export interface Bindings {
  CACHE: KVNamespace;
  RPC_URL: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta: {
    timestamp: string;
    version: string;
  };
}

