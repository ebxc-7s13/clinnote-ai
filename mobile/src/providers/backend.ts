/**
 * Backend client (Supabase Edge Functions, ADR-012). The app never holds a private key: only the public
 * Supabase URL and anon key (both designed to be public) are configured via EXPO_PUBLIC_* variables.
 * Gemini keys live only in the backend secret store. FREE_ONLY_MODE is enforced server-side as well.
 */
import { File, UploadType } from 'expo-file-system';

export type BackendErrorKind = 'NOT_CONFIGURED' | 'OFFLINE' | 'QUOTA_EXHAUSTED' | 'UNAVAILABLE' | 'FEATURE_DISABLED' | 'INVALID_RESPONSE' | 'REJECTED';

export class BackendError extends Error {
  constructor(
    public readonly kind: BackendErrorKind,
    message: string,
  ) {
    super(message);
  }
}

export const USER_MESSAGES: Record<BackendErrorKind, string> = {
  NOT_CONFIGURED: 'Cloud AI is not configured for this build. Rule-based extraction and manual entry remain available.',
  OFFLINE: 'No internet connection. Your transcript and notes are saved on this device.',
  QUOTA_EXHAUSTED: 'Free AI quota is currently unavailable. Your saved transcript and notes remain available.',
  UNAVAILABLE: 'The AI service is unavailable right now. Your transcript and notes are saved; you can retry later.',
  FEATURE_DISABLED: 'This feature is turned off for this build.',
  INVALID_RESPONSE: 'The AI response could not be validated and was not used. Your data is unchanged.',
  REJECTED: 'The request was refused by the service.',
};

export interface BackendConfig {
  url: string | null;
  anonKey: string | null;
}

export function backendConfig(): BackendConfig {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '') || null;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || null;
  return { url, anonKey };
}

export const FREE_ONLY_MODE = true as const; // hard constant: no paid provider, no paid fallback

export interface ExecutionInfo {
  executionId: string;
  provider: string;
  model?: string;
  durationMs: number;
}

export interface Backend {
  configured(): boolean;
  runJob<T = unknown>(job: string, jobVersion: string, input: unknown): Promise<{ output: T; execution: ExecutionInfo }>;
  transcribe(fileUri: string): Promise<{ segments: { speakerLabel: string; text: string; start: number; end: number }[]; execution: ExecutionInfo }>;
  flags(): Promise<{ possibilitiesEnabled: boolean }>;
}

function mapStatus(status: number, body: { error?: { kind?: string } } | null): BackendError {
  const kind = body?.error?.kind as BackendErrorKind | undefined;
  if (kind && kind in USER_MESSAGES) return new BackendError(kind, USER_MESSAGES[kind]);
  if (status === 429) return new BackendError('QUOTA_EXHAUSTED', USER_MESSAGES.QUOTA_EXHAUSTED);
  if (status === 403) return new BackendError('FEATURE_DISABLED', USER_MESSAGES.FEATURE_DISABLED);
  if (status >= 500) return new BackendError('UNAVAILABLE', USER_MESSAGES.UNAVAILABLE);
  return new BackendError('REJECTED', USER_MESSAGES.REJECTED);
}

export class SupabaseBackend implements Backend {
  constructor(private readonly cfg: BackendConfig = backendConfig()) {}

  configured() {
    return !!(this.cfg.url && this.cfg.anonKey);
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.cfg.anonKey}`, apikey: this.cfg.anonKey as string, 'Content-Type': 'application/json' };
  }

  private async post(path: string, body: unknown, timeoutMs = 90000): Promise<any> {
    if (!this.configured()) throw new BackendError('NOT_CONFIGURED', USER_MESSAGES.NOT_CONFIGURED);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${this.cfg.url}/functions/v1/${path}`, { method: 'POST', headers: this.headers(), body: JSON.stringify(body), signal: ctrl.signal });
    } catch {
      throw new BackendError('OFFLINE', USER_MESSAGES.OFFLINE);
    } finally {
      clearTimeout(t);
    }
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    if (!res.ok || !json?.ok) throw mapStatus(res.status, json);
    return json;
  }

  async runJob<T>(job: string, jobVersion: string, input: unknown) {
    const json = await this.post('clinnote-ai', { action: 'job', job, jobVersion, input });
    return { output: json.output as T, execution: json.execution as ExecutionInfo };
  }

  async transcribe(fileUri: string) {
    if (!this.configured()) throw new BackendError('NOT_CONFIGURED', USER_MESSAGES.NOT_CONFIGURED);
    const file = new File(fileUri);
    let result;
    try {
      result = await file.upload(`${this.cfg.url}/functions/v1/clinnote-transcribe`, {
        httpMethod: 'POST',
        uploadType: UploadType.BINARY_CONTENT,
        headers: { Authorization: `Bearer ${this.cfg.anonKey}`, apikey: this.cfg.anonKey as string, 'Content-Type': 'audio/wav' },
      });
    } catch {
      throw new BackendError('OFFLINE', USER_MESSAGES.OFFLINE);
    }
    let json: any = null;
    try {
      json = JSON.parse(result.body);
    } catch {
      json = null;
    }
    if (result.status < 200 || result.status >= 300 || !json?.ok) throw mapStatus(result.status, json);
    return { segments: json.segments, execution: json.execution };
  }

  async flags() {
    try {
      const json = await this.post('clinnote-ai', { action: 'config' }, 15000);
      return { possibilitiesEnabled: json.config?.possibilitiesEnabled === true };
    } catch {
      return { possibilitiesEnabled: false };
    }
  }
}

/** Mock backend for tests and CI. Deterministic; never contacts a network. */
export class MockBackend implements Backend {
  constructor(
    public behaviour: { kind?: BackendErrorKind; jobOutputs?: Record<string, unknown>; segments?: { speakerLabel: string; text: string; start: number; end: number }[]; possibilitiesEnabled?: boolean } = {},
  ) {}
  configured() {
    return this.behaviour.kind !== 'NOT_CONFIGURED';
  }
  async runJob<T>(job: string) {
    if (this.behaviour.kind) throw new BackendError(this.behaviour.kind, USER_MESSAGES[this.behaviour.kind]);
    return { output: (this.behaviour.jobOutputs?.[job] ?? { items: [] }) as T, execution: { executionId: 'mock-exec', provider: 'mock', durationMs: 1 } };
  }
  async transcribe() {
    if (this.behaviour.kind) throw new BackendError(this.behaviour.kind, USER_MESSAGES[this.behaviour.kind]);
    return { segments: this.behaviour.segments ?? [], execution: { executionId: 'mock-exec', provider: 'mock', durationMs: 1 } };
  }
  async flags() {
    return { possibilitiesEnabled: !!this.behaviour.possibilitiesEnabled };
  }
}
