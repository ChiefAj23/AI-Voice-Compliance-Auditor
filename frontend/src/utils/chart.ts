import { useTheme } from '../contexts/ThemeContext';

// Categorical series colors in fixed order (never cycle past 8; fold extras into
// "Other"). Validated with the dataviz palette checker: light on #ffffff, dark on
// #11151f, all gates pass. Slots 3–5 are under 3:1 on light, so multi-series
// charts need direct labels or a table view.
const SERIES = {
  light: ['#3e63dd', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark: ['#4a6be6', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};

// Chart chrome: hairline grid one step off the card surface, recessive axes.
const CHROME = {
  light: { surface: '#ffffff', grid: '#eaecf0', axis: '#d0d5dd', tick: '#667085' },
  dark: { surface: '#11151f', grid: '#212736', axis: '#343d50', tick: '#808ba0' },
};

// Diverging pair for polarity (sentiment): cool positive, warm negative, gray midpoint.
const POLARITY = {
  light: { positive: '#3e63dd', neutral: '#cfd4dc', negative: '#e34948' },
  dark: { positive: '#4a6be6', neutral: '#3a4356', negative: '#e66767' },
};

export function useChartTheme() {
  const { theme } = useTheme();
  const mode = theme === 'dark' ? 'dark' : 'light';
  const chrome = CHROME[mode];
  return {
    mode,
    series: SERIES[mode],
    polarity: POLARITY[mode],
    surface: chrome.surface,
    tick: chrome.tick,
    /** Raw chrome colors, e.g. for ReferenceLine strokes or bar hover washes. */
    colors: chrome,
    /** Spread onto <XAxis>/<YAxis>. */
    axis: {
      stroke: chrome.axis,
      tick: { fill: chrome.tick, fontSize: 12 },
      tickLine: false,
      axisLine: { stroke: chrome.axis },
    },
    /** Spread onto <CartesianGrid>: solid horizontal hairlines only. */
    grid: {
      stroke: chrome.grid,
      vertical: false,
    },
    /** Vertical crosshair for line and area tooltips. */
    cursor: { stroke: chrome.axis, strokeWidth: 1 },
  };
}

export type ChartTheme = ReturnType<typeof useChartTheme>;
