'use client';

import { useEffect } from 'react';

export const NAVIGATION_ATTEMPT_EVENT = 'enrgdaq:navigation-attempt';

interface NavigationAttemptDetail {
  href: string;
  handled?: boolean;
}

export function useNavigationGuard(
  isDirty: boolean,
  onNavigationAttempt: (href: string) => void,
) {
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    const handleNavigationAttempt = (event: Event) => {
      const customEvent = event as CustomEvent<NavigationAttemptDetail>;
      if (!customEvent.detail?.href) return;
      customEvent.detail.handled = true;
      onNavigationAttempt(customEvent.detail.href);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener(NAVIGATION_ATTEMPT_EVENT, handleNavigationAttempt);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener(
        NAVIGATION_ATTEMPT_EVENT,
        handleNavigationAttempt,
      );
    };
  }, [isDirty, onNavigationAttempt]);
}
