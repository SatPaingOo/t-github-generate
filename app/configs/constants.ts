import type { Platform } from '@/lib/types';

export const PLATFORMS: {
  value: Platform;
  label: string;
  icon: string;
  desc: string;
  tag: string;
  available: boolean;
}[] = [
  { value: 'android', label: 'Android', icon: '🤖', desc: 'APK file', tag: 'Available', available: true },
  { value: 'windows', label: 'Windows', icon: '🪟', desc: 'exe installer', tag: 'Available', available: true },
  { value: 'ios', label: 'iOS', icon: '🍎', desc: 'IPA', tag: 'Soon', available: false },
  { value: 'macos', label: 'macOS', icon: '💻', desc: 'dmg', tag: 'Soon', available: false },
];

export const PRESET_COLORS = [
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#06B6D4',
  '#3B82F6',
];

export const STEPS = [
  { n: '01', title: 'Fill the form', desc: 'Name, colors, logo, platform.' },
  { n: '02', title: 'We build it', desc: 'GitHub Actions compiles your app.' },
  { n: '03', title: 'Get the link', desc: 'Repo + download link by email.' },
];

export const DEFAULT_PACKAGE_BY_PLATFORM: Record<Platform, string> = {
  android: 'com.tgen.myapp',
  windows: 'com.tgen.myapp',
  ios: 'com.tgen.myapp',
  macos: 'com.tgen.myapp',
};
