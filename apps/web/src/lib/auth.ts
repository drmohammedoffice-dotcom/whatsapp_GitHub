export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  teamId: string;
};

export type OtpChallenge = {
  requiresOtp: true;
  verificationId: string;
  email: string;
  maskedEmail: string;
  expiresAt: string;
  reason?: 'email_not_verified';
  channel?: 'email' | 'whatsapp';
  maskedPhone?: string;
  emailFallbackAvailable?: boolean;
};

export type AuthResponse = AuthTokens | OtpChallenge;

export function isOtpChallenge(response: AuthResponse): response is OtpChallenge {
  return 'requiresOtp' in response && response.requiresOtp === true;
}
