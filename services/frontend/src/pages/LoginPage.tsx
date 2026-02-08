import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts, radii } from '../theme/tokens.stylex';
import { Button } from '../components/ui/Button';
import { FormGroup } from '../components/ui/FormGroup';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

const styles = stylex.create({
  container: {
    maxWidth: '420px',
    margin: '3rem auto',
    padding: '0 1.5rem',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: '2rem',
    fontWeight: 900,
    textAlign: 'center',
    marginBottom: '0.5rem',
    color: colors.textPrimary,
  },
  subtitle: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginBottom: '2rem',
    fontSize: '0.9375rem',
  },
  input: {
    fontFamily: fonts.sans,
    fontSize: '0.9375rem',
    border: `1px solid ${colors.border}`,
    background: colors.bgInput,
    color: colors.textPrimary,
    padding: '0.625rem 0.875rem',
    borderRadius: radii.sm,
    outline: 'none',
    width: '100%',
  },
  footer: {
    textAlign: 'center',
    marginTop: '1.5rem',
    fontFamily: fonts.sans,
    fontSize: '0.875rem',
    color: colors.textSecondary,
  },
  link: {
    color: colors.accent,
    cursor: 'pointer',
    textDecoration: 'none',
  },
});

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      toast('Welcome back!', 'success');
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div {...stylex.props(styles.container)}>
      <h1 {...stylex.props(styles.title)}>Welcome back</h1>
      <p {...stylex.props(styles.subtitle)}>Sign in to your account</p>

      <form onSubmit={handleSubmit}>
        <FormGroup label="Email">
          <input
            {...stylex.props(styles.input)}
            type="text"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormGroup>
        <FormGroup label="Password" error={error || undefined}>
          <input
            {...stylex.props(styles.input)}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </FormGroup>
        <Button variant="primary" fullWidth type="submit" style={{ marginTop: '0.5rem' }}>
          Sign In
        </Button>
      </form>

      <p {...stylex.props(styles.footer)}>
        Don&apos;t have an account?{' '}
        <a {...stylex.props(styles.link)} onClick={() => navigate('/register')}>
          Create one
        </a>
      </p>
    </div>
  );
}
