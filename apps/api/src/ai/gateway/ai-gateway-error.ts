import { Injectable } from '@nestjs/common';
import type { AiGatewayErrorClass, ClassifiedGatewayError } from './ai-gateway.types';

function axiosStatus(error: unknown): number | undefined {
  const e = error as { response?: { status?: number }; status?: number };
  return e?.response?.status ?? e?.status;
}

function errorBlob(error: unknown): string {
  const e = error as {
    message?: string;
    code?: string;
    response?: { data?: unknown; statusText?: string };
  };
  const parts = [
    e?.message,
    e?.code,
    e?.response?.statusText,
    typeof e?.response?.data === 'string' ? e.response.data : JSON.stringify(e?.response?.data ?? ''),
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

/**
 * Classify provider/network failures for failover decisions.
 * Never include API key material in returned messages.
 */
export function classifyGatewayError(error: unknown): ClassifiedGatewayError {
  const status = axiosStatus(error);
  const blob = errorBlob(error);
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 400);

  if (status === 429 || /rate.?limit|too many requests|quota/i.test(blob)) {
    return { class: 'rate_limited', retryable: true, status, label: 'Rate Limited', message };
  }

  if (
    status === 408 ||
    /timeout|etimedout|esockettimedout|aborted/i.test(blob) ||
    (error as { code?: string })?.code === 'ECONNABORTED'
  ) {
    return { class: 'timeout', retryable: true, status, label: 'Timeout', message };
  }

  if (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    /service unavailable|bad gateway|internal server/i.test(blob)
  ) {
    return { class: 'server_error', retryable: true, status, label: 'Server Error', message };
  }

  if (
    /econnrefused|enotfound|econnreset|network|socket hang up|fetch failed/i.test(blob) ||
    (error as { code?: string })?.code === 'ECONNREFUSED'
  ) {
    return { class: 'network', retryable: true, status, label: 'Network Error', message };
  }

  // OpenRouter: 402 can be credits OR prompt-too-large
  if (status === 402 || /insufficient.?credits|requires more credits|max_tokens/i.test(blob)) {
    // "can only afford N" is a credit/budget issue — retry with lower max_tokens.
    if (/can only afford/i.test(blob)) {
      return { class: 'credits', retryable: true, status, label: 'Credits / Capacity', message };
    }
    if (/prompt.?too.?large|context.?length|maximum context|too large for/i.test(blob)) {
      return { class: 'prompt_too_large', retryable: false, status, label: 'Prompt Too Large', message };
    }
    return { class: 'credits', retryable: true, status, label: 'Credits / Capacity', message };
  }

  if (status === 401 || status === 403 || /invalid.?api.?key|unauthorized|forbidden/i.test(blob)) {
    return { class: 'auth', retryable: true, status, label: 'Auth Error', message };
  }

  // Client/payload mistakes (invalid model, bad JSON schema, etc.) — do not burn the key pool.
  if (
    status === 400 ||
    status === 404 ||
    /not a valid model|no endpoints found|invalid.?model|unsupported/i.test(blob)
  ) {
    return { class: 'bad_request', retryable: false, status, label: 'Bad Request', message };
  }

  return { class: 'unknown', retryable: true, status, label: 'Unknown Error', message };
}

export function healthFromErrorClass(
  errorClass: AiGatewayErrorClass,
): 'rate_limited' | 'unavailable' | 'busy' | 'offline' {
  if (errorClass === 'rate_limited' || errorClass === 'credits') return 'rate_limited';
  if (errorClass === 'timeout') return 'busy';
  if (errorClass === 'auth') return 'unavailable';
  return 'offline';
}

@Injectable()
export class AiGatewayErrorClassifier {
  classify(error: unknown): ClassifiedGatewayError {
    return classifyGatewayError(error);
  }
}
