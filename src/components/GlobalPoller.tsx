'use client';

import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';

const POLLER_INTERVAL = 1000;

export default function GlobalPoller() {
  const { fetchClients, fetchRuns, pollClientStatus } = useStore();
  const isMounted = useRef(false);

  useEffect(() => {
    // Prevent double execution in strict mode during development if needed,
    // though for polling it's just an extra call.
    isMounted.current = true;

    const fetchData = async () => {
      await Promise.all([fetchClients(), fetchRuns(), pollClientStatus()]);
    };

    fetchData();

    const interval = setInterval(() => {
      if (isMounted.current) {
        fetchData();
      }
    }, POLLER_INTERVAL);

    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [fetchClients, fetchRuns, pollClientStatus]);

  return null;
}
