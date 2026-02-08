import { apiFetch } from './client';
import type { LoginResponse, CaptchaChallenge, CaptchaVerifyResponse } from '../types';

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function register(
  username: string,
  email: string,
  password: string,
  captchaToken: string,
): Promise<void> {
  return apiFetch('/api/auth/register', {
    method: 'POST',
    headers: { 'X-Captcha-Token': captchaToken },
    body: JSON.stringify({ username, email, password }),
  });
}

export function getCaptchaChallenge(): Promise<CaptchaChallenge> {
  return apiFetch<CaptchaChallenge>('/api/captcha/challenge');
}

export function verifyCaptcha(id: string, answer: string): Promise<CaptchaVerifyResponse> {
  return apiFetch<CaptchaVerifyResponse>('/api/captcha/verify', {
    method: 'POST',
    body: JSON.stringify({ id, answer }),
  });
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
  token: string,
): Promise<void> {
  return apiFetch('/api/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    token,
  });
}
