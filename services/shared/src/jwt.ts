export interface JwtClaims {
  sub: string;
  username: string;
  role: string;
  exp: number;
  iat: number;
}

// Headers injected by the gateway after JWT validation
export const USER_ID_HEADER = 'x-user-id';
export const USER_ROLE_HEADER = 'x-user-role';
export const USERNAME_HEADER = 'x-username';
