import type { ApiResponse } from "../types";

const VERSION = "1.0.0";

export function success<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: VERSION,
    },
  };
}

export function error(code: string, message: string): ApiResponse {
  return {
    success: false,
    error: { code, message },
    meta: {
      timestamp: new Date().toISOString(),
      version: VERSION,
    },
  };
}

