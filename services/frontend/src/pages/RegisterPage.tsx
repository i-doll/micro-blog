import React, { useState, useEffect, useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts, radii } from '../theme/tokens.stylex';
import { useViewTransitionNavigate } from '../hooks/useViewTransitionNavigate';
import { Button } from '../components/ui/Button';
import { FormGroup } from '../components/ui/FormGroup';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import * as authApi from '../api/auth';

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
  captchaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.5rem',
  },
  captchaImage: {
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.ruleColor,
    borderRadius: radii.sm,
    overflow: 'hidden',
    lineHeight: 0,
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

export function RegisterPage() {
  const navigate = useViewTransitionNavigate();
  const { register } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaId, setCaptchaId] = useState<string | null>(null);
  const [captchaHtml, setCaptchaHtml] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [error, setError] = useState('');

  const loadCaptcha = useCallback(async () => {
    try {
      const data = await authApi.getCaptchaChallenge();
      setCaptchaId(data.id);
      setCaptchaHtml(data.image);
      setCaptchaAnswer('');
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadCaptcha();
  }, [loadCaptcha]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!captchaId || !captchaAnswer.trim()) {
      setError('Please complete the captcha');
      return;
    }

    try {
      const verifyData = await authApi.verifyCaptcha(captchaId, captchaAnswer.trim());
      await register(username, email, password, verifyData.captcha_token);
      toast('Account created! Please sign in.', 'success');
      navigate('/login');
    } catch (err: any) {
      setError(err.message);
      loadCaptcha();
    }
  };

  return (
    <div {...stylex.props(styles.container)}>
      <h1 {...stylex.props(styles.title)}>Join the conversation</h1>
      <p {...stylex.props(styles.subtitle)}>Create your account</p>

      <form onSubmit={handleSubmit}>
        <FormGroup label="Username">
          <input
            {...stylex.props(styles.input)}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            minLength={3}
            maxLength={50}
            required
          />
        </FormGroup>
        <FormGroup label="Email">
          <input
            {...stylex.props(styles.input)}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormGroup>
        <FormGroup label="Password">
          <input
            {...stylex.props(styles.input)}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </FormGroup>
        <FormGroup label="Verify you are human" error={error || undefined}>
          <div {...stylex.props(styles.captchaRow)}>
            <div
              {...stylex.props(styles.captchaImage)}
              dangerouslySetInnerHTML={{ __html: captchaHtml }}
            />
            <Button variant="ghost" type="button" onClick={loadCaptcha} title="New captcha">
              &#x21bb;
            </Button>
          </div>
          <input
            {...stylex.props(styles.input)}
            type="text"
            placeholder="Enter the text above"
            value={captchaAnswer}
            onChange={(e) => setCaptchaAnswer(e.target.value)}
            maxLength={10}
            required
            autoComplete="off"
          />
        </FormGroup>
        <Button variant="primary" fullWidth type="submit" style={{ marginTop: '0.5rem' }}>
          Create Account
        </Button>
      </form>

      <p {...stylex.props(styles.footer)}>
        Already have an account?{' '}
        <a {...stylex.props(styles.link)} onClick={() => navigate('/login')}>
          Sign in
        </a>
      </p>
    </div>
  );
}
