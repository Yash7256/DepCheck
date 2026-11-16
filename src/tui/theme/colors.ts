export const tuiColors = {
  accent: '#FF6A00',
  success: 'green',
  warning: 'yellow',
  error: 'red',
  info: 'blue',
  muted: 'gray',
  text: 'white',
} as const;

export type TuiColor = (typeof tuiColors)[keyof typeof tuiColors];
