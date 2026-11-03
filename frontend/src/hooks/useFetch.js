import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../services/api.js';

/** GET avec état de chargement/erreur. `url` à null : pas de requête (ex. formulaire pas encore complet). */
export default function useFetch(url, params) {
  const [state, setState] = useState({ data: null, loading: Boolean(url), error: '' });
  const [tick, setTick] = useState(0);
  const paramsKey = JSON.stringify(params ?? {});

  useEffect(() => {
    if (!url) {
      setState({ data: null, loading: false, error: '' });
      return undefined;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: '' }));
    api.get(url, { params: JSON.parse(paramsKey) })
      .then((res) => !cancelled && setState({ data: res.data, loading: false, error: '' }))
      .catch((err) => !cancelled && setState({ data: null, loading: false, error: errorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [url, paramsKey, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
