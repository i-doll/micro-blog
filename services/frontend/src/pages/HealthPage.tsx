import React from 'react';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts, radii } from '../theme/tokens.stylex';
import { Container } from '../components/layout/Container';
import { SectionRule } from '../components/ui/SectionRule';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { useHealthQuery } from '../hooks/queries';

const styles = stylex.create({
  pageTitle: {
    fontFamily: fonts.display,
    fontSize: 'clamp(2rem, 5vw, 3.5rem)',
    fontWeight: 900,
    letterSpacing: '-0.03em',
    lineHeight: 1.1,
    marginBottom: '0.5rem',
    color: colors.textPrimary,
  },
  pageSubtitle: {
    fontFamily: fonts.body,
    fontSize: '1.125rem',
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: '2rem',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overall: {
    fontFamily: fonts.sans,
    fontWeight: 700,
    fontSize: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    color: colors.textPrimary,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '1rem',
    marginTop: '1.5rem',
  },
  card: {
    background: colors.bgCard,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: '1.25rem',
    transition: 'border-color 0.2s',
  },
  cardOk: {
    borderColor: colors.success,
  },
  cardErr: {
    borderColor: colors.error,
  },
  cardName: {
    fontFamily: fonts.sans,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: colors.textMuted,
    marginBottom: '0.5rem',
  },
  cardStatus: {
    fontFamily: fonts.sans,
    fontSize: '0.875rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    color: colors.textPrimary,
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
    display: 'inline-block',
  },
  dotOk: { background: colors.success },
  dotErr: { background: colors.error },
});

export function HealthPage() {
  const { data, isLoading, isError, refetch } = useHealthQuery();

  const services = data?.services || {};
  const overallStatus = data?.status || (isError ? 'unreachable' : 'unknown');
  const isOverallOk = overallStatus === 'ok' || overallStatus === 'healthy';

  return (
    <Container variant="narrow">
      <h1 {...stylex.props(styles.pageTitle)}>System Status</h1>
      <p {...stylex.props(styles.pageSubtitle)}>Service health dashboard</p>
      <SectionRule />

      <div {...stylex.props(styles.topBar)}>
        <div {...stylex.props(styles.overall)}>
          {!isLoading && (
            <>
              <span
                {...stylex.props(styles.statusDot, isOverallOk ? styles.dotOk : styles.dotErr)}
              />
              System {overallStatus}
            </>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      <div {...stylex.props(styles.grid)}>
        {isLoading ? (
          <Skeleton />
        ) : Object.keys(services).length > 0 ? (
          Object.entries(services).map(([name, status]) => {
            const isOk = status === 'ok' || status === 'healthy' || status === 'up';
            return (
              <div
                key={name}
                {...stylex.props(styles.card, isOk ? styles.cardOk : styles.cardErr)}
              >
                <div {...stylex.props(styles.cardName)}>{name}</div>
                <div {...stylex.props(styles.cardStatus)}>
                  <span
                    {...stylex.props(styles.statusDot, isOk ? styles.dotOk : styles.dotErr)}
                  />
                  {status}
                </div>
              </div>
            );
          })
        ) : (
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
            {isError ? 'Could not reach health endpoint' : 'No service data available'}
          </p>
        )}
      </div>
    </Container>
  );
}
