import { useCallback, useState } from 'react';

const KEY = 'parc_theme';

// Le thème initial est posé avant le rendu par un script dans index.html (évite un flash blanc).
export default function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');

  const toggle = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* stockage indisponible : le choix vaut pour cette session seulement */
    }
    setTheme(next);
  }, [theme]);

  return { theme, toggle };
}
