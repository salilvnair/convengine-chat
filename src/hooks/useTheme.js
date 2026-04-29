import { useCallback, useState } from 'react';

/**
 * Manages light / dark theme state for a single chat instance.
 * Only meaningful when `showDarkModeLightMode` is true.
 */
export function useTheme(showDarkModeLightMode = false) {
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = useCallback(() => {
    if (!showDarkModeLightMode) return;
    setIsDark((d) => !d);
  }, [showDarkModeLightMode]);

  return { isDark, toggleTheme };
}
