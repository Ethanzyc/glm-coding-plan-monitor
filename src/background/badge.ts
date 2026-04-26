import type { DisplayColor } from '../shared/types';

interface ColorThresholds {
  green: number;
  yellow: number;
}

/**
 * Badge 管理器
 * 使用 chrome.action API 在工具栏图标上显示剩余配额百分比
 */
export class BadgeManager {
  private thresholds: ColorThresholds;

  constructor(thresholds: ColorThresholds = { green: 50, yellow: 20 }) {
    this.thresholds = thresholds;
  }

  setThresholds(thresholds: ColorThresholds): void {
    this.thresholds = thresholds;
  }

  updateDisplay(percent: number | null): void {
    if (percent == null || percent < 0) {
      this.clear();
      return;
    }

    const text = percent >= 1000 ? '999+' : String(Math.round(percent));
    const color = this.getColor(percent);

    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });
  }

  setLoading(): void {
    chrome.action.setBadgeText({ text: '...' });
    chrome.action.setBadgeBackgroundColor({ color: '#888888' });
  }

  clear(): void {
    chrome.action.setBadgeText({ text: '' });
  }

  private getColor(percent: number): string {
    const c = this.getDisplayColor(percent);
    switch (c) {
      case 'green': return '#4CAF50';
      case 'yellow': return '#FF9800';
      case 'red': return '#F44336';
    }
  }

  // Color logic: percentage is usage rate (how much is used)
  // < 20% used → green, 20-50% → yellow, > 50% → red
  private getDisplayColor(percent: number): DisplayColor {
    if (percent < 20) return 'green';
    if (percent < 50) return 'yellow';
    return 'red';
  }
}
