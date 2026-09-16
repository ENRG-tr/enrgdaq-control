'use client';

import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';

const POLLER_INTERVAL = 1000;
const MAX_BACKOFF = 30_000;
const MAX_BACKOFF_FAILURES = 5;

function getRetryDelay(failureCount: number): number {
  return Math.min(POLLER_INTERVAL * 2 ** failureCount, MAX_BACKOFF);
}

export default function GlobalPoller() {
  const fetchClients = useStore((state) => state.fetchClients);
  const fetchRuns = useStore((state) => state.fetchRuns);
  const pollClientStatus = useStore((state) => state.pollClientStatus);
  const setPollingState = useStore((state) => state.setPollingState);
  const stopRun = useStore((state) => state.stopRun);
  // Track which run ID we already triggered a client-side stop for,
  // to avoid duplicate stop calls.
  const lastStoppedRunId = useRef<number | null>(null);
  const pollInFlight = useRef(false);
  const failureCount = useRef(0);
  const visibilityPollPending = useRef(false);
  const currentPoll = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    let isActive = true;
    let scheduledPoll: ReturnType<typeof setTimeout> | null = null;

    const clearScheduledPoll = () => {
      if (scheduledPoll !== null) {
        clearTimeout(scheduledPoll);
        scheduledPoll = null;
      }
    };

    const checkScheduledStop = () => {
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

    const schedulePoll = (delay: number) => {
      clearScheduledPoll();
      if (!isActive || document.hidden) return;

      scheduledPoll = setTimeout(() => {
        scheduledPoll = null;
        void fetchData();
      }, delay);
    };

    const fetchData = async () => {
      if (!isActive || document.hidden) return;
      if (pollInFlight.current) {
        // A visibility event or a remounted effect may request a refresh while
        // one is already running. Queue it instead of starting an overlap.
        visibilityPollPending.current = true;
        setPollingState({ isPolling: true });
        return;
      }

      pollInFlight.current = true;
      setPollingState({ isPolling: true });
      let cycleSucceeded = false;

      try {
        // allSettled lets the scheduled-stop fallback run even if one of the
        // refresh requests fails. The store actions return false for failures.
        const results = await Promise.allSettled([
          fetchClients(),
          fetchRuns(),
          pollClientStatus(),
        ]);

        checkScheduledStop();
        cycleSucceeded = results.every(
          (result) =>
            result.status === 'fulfilled' && result.value !== false,
        );
        if (!cycleSucceeded) {
          throw new Error('One or more background refreshes failed');
        }

        // A successful cycle is the freshness point for the dashboard.
        failureCount.current = 0;
        if (isActive) {
          setPollingState({
            isPolling: false,
            lastUpdatedAt: Date.now(),
            pollingError: null,
          });
        }
      } catch (error) {
        if (isActive) {
          failureCount.current = Math.min(
            failureCount.current + 1,
            MAX_BACKOFF_FAILURES,
          );
          setPollingState({
            isPolling: false,
            pollingError: 'Background refresh failed; retrying.',
          });
          console.error('[GlobalPoller] Background refresh failed:', error);
        }
      } finally {
        pollInFlight.current = false;
        const shouldPollImmediately =
          visibilityPollPending.current && !document.hidden;
        visibilityPollPending.current = false;

        if (isActive) {
          if (!document.hidden) {
            if (shouldPollImmediately) {
              void fetchData();
            } else {
              schedulePoll(
                cycleSucceeded
                  ? POLLER_INTERVAL
                  : getRetryDelay(failureCount.current),
              );
            }
          }
        } else if (shouldPollImmediately) {
          // If Strict Mode replaces this effect while its request is in
          // flight, let the replacement effect continue polling when it
          // becomes available.
          void currentPoll.current?.();
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearScheduledPoll();
        visibilityPollPending.current = false;
        return;
      }

      clearScheduledPoll();
      if (pollInFlight.current) {
        // Do not overlap cycles. The current cycle will be followed by an
        // immediate refresh once it completes.
        visibilityPollPending.current = true;
      } else {
        // Returning to the app should not wait for the normal poll interval.
        void fetchData();
      }
    };

    currentPoll.current = fetchData;
    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (!document.hidden) {
      void fetchData();
    }

    return () => {
      isActive = false;
      clearScheduledPoll();
      visibilityPollPending.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (currentPoll.current === fetchData) {
        currentPoll.current = null;
      }
      setPollingState({ isPolling: false });
    };
  }, [fetchClients, fetchRuns, pollClientStatus, setPollingState, stopRun]);

  return null;
}
