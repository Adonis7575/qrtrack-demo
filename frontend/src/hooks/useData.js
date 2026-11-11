import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../utils/api';

function useFetch(fetchFn, deps = []) {
  const requestId = useRef(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const execute = useCallback(async (signal) => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setLoading(true);
    setError(null);

    try {
      const result = await fetchFn({ signal });
      if (!signal?.aborted && currentRequest === requestId.current) {
        setData(result);
      }
    } catch (err) {
      if (err.name !== 'AbortError' && currentRequest === requestId.current) {
        setError(err.message);
      }
    } finally {
      if (!signal?.aborted && currentRequest === requestId.current) {
        setLoading(false);
      }
    }
  }, deps);

  useEffect(() => {
    const controller = new AbortController();
    execute(controller.signal);
    return () => controller.abort();
  }, [execute]);

  return { data, setData, loading, error, refetch: () => execute() };
}

export function useOverview() {
  return useFetch(({ signal } = {}) => api.listQRs({ signal }));
}

export function useQRDetail(id) {
  return useFetch(({ signal } = {}) => api.getQR(id, { signal }), [id]);
}

export function useTimeline(qrId, days = 30) {
  return useFetch(({ signal } = {}) => api.getTimeline(qrId, days, { signal }), [qrId, days]);
}

export function useBreakdown(qrId) {
  return useFetch(({ signal } = {}) => api.getBreakdown(qrId, { signal }), [qrId]);
}
