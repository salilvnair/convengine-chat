import { useCallback, useState } from 'react';

/**
 * Manages light / dark theme state for a single chat instance.
 * Only meaningful when `showDarkModeLightMode` is true.
 *
 * @param {boolean} showDarkModeLightMode - enables the toggle button
 * @param {boolean} defaultDark           - seed initial state (e.g. for playground preview)
 */
export function useTheme(showDarkModeLightMode = false, defaultDark = false) {
  const [isDark, setIsDark] = useState(defaultDark);

  const toggleTheme = useCallback(() => {
    if (!showDarkModeLightMode) return;
    setIsDark((d) => !d);
  }, [showDarkModeLightMode]);

  return { isDark, toggleTheme };
}
