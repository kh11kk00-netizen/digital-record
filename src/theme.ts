export const colors = {
  navy: "#102B4E",
  navyDeep: "#0B1F3A",
  primary: "#2463EB",
  primarySoft: "#EAF1FF",
  background: "#F7F9FC",
  surface: "#FFFFFF",
  ink: "#172B45",
  muted: "#7A8798",
  border: "#E3EAF2",
  success: "#20A66A",
  successSoft: "#E6F6EE",
  warning: "#F0A44B",
  warningSoft: "#FFF3E2",
  danger: "#C44752",
  dangerSoft: "#FCECEE",
  neutralSoft: "#EEF2F7",
  white: "#FFFFFF",
} as const;

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

export const shadow = {
  shadowColor: "#102B4E",
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;
