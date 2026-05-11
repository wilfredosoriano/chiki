import { useThemeStore } from '@/stores/themeStore';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';

export function useTheme() {
  const resolved = useThemeStore((s) => s.resolved);
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return {
    colors: Colors[resolved],
    typography: Typography,
    spacing: Spacing,
    radius: Radius,
    shadow: Shadow,
    isDark: false,
    mode,
    setMode,
  };
}
