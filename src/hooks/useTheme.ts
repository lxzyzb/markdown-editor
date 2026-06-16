import { useEffect } from 'react';
import { useSettingsStore, type ThemeMode } from '../store/settingsStore';

/**
 * 根据 settingsStore.theme 应用到 document.documentElement.dataset.theme。
 * - 'dark' / 'light'：直接使用
 * - 'system'：跟随系统 prefers-color-scheme，并响应变化
 */
export function useTheme() {
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    const apply = (mode: ThemeMode) => {
      const effective = mode === 'system' ? systemMode() : mode;
      document.documentElement.dataset.theme = effective;
    };

    apply(theme);

    if (theme !== 'system') return;

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [theme]);
}

function systemMode(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
