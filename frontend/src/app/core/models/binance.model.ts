export interface BinanceStatus {
  connected: boolean;
  maskedKey?: string;
  connectedAt?: string;
  futuresEnabled?: boolean;
}

export interface TestResult {
  valid: boolean;
  futuresEnabled?: boolean;
  message?: string;
}

export interface ConnectResult {
  success: boolean;
  maskedKey: string;
  connectedAt: string;
  futuresEnabled: boolean;
}
