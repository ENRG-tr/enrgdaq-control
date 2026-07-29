'use client';

import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';

const POLLER_INTERVAL = 1000;

export default function GlobalPoller() {
  const { fetchClients, fetchRuns, pollClientStatus, activeRun, stopRun } =
    useStore();
  const isMounted = useRef(false);
  // Track which run ID we already triggered a client-side stop for,
  // to avoid duplicate stop calls.
  const lastStoppedRunId = useRef<number | null>(null);

  useEffect(() => {
    isMounted.current = true;

    const fetchData = async () => {
      await Promise.all([fetchClients(), fetchRuns(), pollClientStatus()]);

      // Client-side fallback: if after fetching runs the active run still
      // has a scheduledEndTime that has passed, trigger stopRun directly.
      // This handles cases where the server-side auto-stop in getActiveRun()
      // didn't fire (e.g. due to a transient error or the background job
      // not having run yet).
      const currentRun = useStore.getState().activeRun;
      if (
        currentRun &&
        currentRun.scheduledEndTime &&
        new Date() >= new Date(currentRun.scheduledEndTime) &&
        currentRun.id !== lastStoppedRunId.current
      ) {
        lastStoppedRunId.current = currentRun.id;
        console.log(
          `[GlobalPoller] Client-side fallback: stopping run ${currentRun.id} (scheduled end time passed)`,
        );
        stopRun().catch((e) =>
          console.error('[GlobalPoller] Client-side stop failed:', e),
        );
      }

      // Reset the tracker when the active run changes to something else
      if (!currentRun || currentRun.id !== lastStoppedRunId.current) {
        // Only reset if the current run does NOT need stopping
        if (
          !currentRun?.scheduledEndTime ||
          new Date() < new Date(currentRun.scheduledEndTime)
        ) {
          lastStoppedRunId.current = null;
        }
      }
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
  }, [fetchClients, fetchRuns, pollClientStatus, stopRun]);

  return null;
}
