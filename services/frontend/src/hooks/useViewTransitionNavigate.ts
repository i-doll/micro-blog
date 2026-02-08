import { useCallback } from 'react';
import { useNavigate, type NavigateOptions, type To } from 'react-router';

/**
 * Wrapper around useNavigate that enables view transitions by default.
 * For numeric navigation (e.g. navigate(-1)), wraps in document.startViewTransition
 * since navigate(number) doesn't accept options.
 */
export function useViewTransitionNavigate() {
  const navigate = useNavigate();

  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      if (typeof to === 'number') {
        if (document.startViewTransition) {
          document.startViewTransition(() => navigate(to));
        } else {
          navigate(to);
        }
      } else {
        navigate(to, { viewTransition: true, ...options });
      }
    },
    [navigate],
  );
}
