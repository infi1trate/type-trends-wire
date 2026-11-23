// W3d · a FIXTURE, not stored data: 18 US App Store categories of 100 icons built from the owner's dry probe of 22 Nov 2026 (blue leads
// 11 of 18, never above 33; black leads Entertainment, Music, Photo & Video; white leads Productivity, Medical, Developer Tools; Food &
// Drink ties red and white at 24; Finance blue 23, white 21, green 15). Counts the probe did not give are made up to fill each category
// to 100. Used by tests and, until a real week arrives, by the proof pictures (which say so).
import type { IconIn } from "../measure";

type Spec = Partial<Record<"red" | "orange" | "yellow" | "green" | "teal" | "blue" | "violet" | "pink" | "white" | "grey" | "black" | "mixed", number>>;
const BASE: Record<keyof Spec, string[]> = {
  red: ["#E5332A", "#C8102E", "#FF4F4F", "#9E1B1B"], orange: ["#FF7A00", "#F26A1B", "#FF9F43", "#C45A00"], yellow: ["#FFD100", "#F5C518", "#FFE066", "#C9A100"],
  green: ["#1DB954", "#00A86B", "#4CD964", "#0B6E4F"], teal: ["#00B3A4", "#1ABC9C", "#5AD8CC", "#007C80"], blue: ["#0A84FF", "#1F5FD0", "#5AA9FF", "#0B3D91"],
  violet: ["#7B4DFF", "#6236C9", "#B08BFF", "#3F1E8C"], pink: ["#FF3E8A", "#E6007E", "#FF8FC2", "#A3005A"],
  white: ["#FFFFFF", "#F7F7F5", "#FAFAFA", "#F2F4F7"], grey: ["#8E8E93", "#6B7280", "#B0B5BC", "#4B5058"], black: ["#000000", "#111111", "#1C1C1E", "#0B0B0D"], mixed: ["#E5332A", "#0A84FF", "#FFD100", "#1DB954"],
};
export const PROBE: [number, string, Spec][] = [
  [6003, "Travel", { blue: 33, white: 18, black: 9, red: 7, orange: 8, green: 6, teal: 8, violet: 3, grey: 3, pink: 2, yellow: 1, mixed: 2 }],
  [6000, "Business", { blue: 32, white: 22, black: 12, red: 8, orange: 6, green: 6, teal: 4, violet: 4, grey: 3, pink: 1, yellow: 1, mixed: 1 }],
  [6017, "Education", { blue: 28, white: 17, black: 8, red: 9, orange: 10, green: 9, teal: 5, violet: 5, grey: 2, pink: 3, yellow: 3, mixed: 1 }],
  [6014, "Games", { blue: 28, black: 14, red: 12, orange: 9, green: 6, white: 4, teal: 5, violet: 7, grey: 2, pink: 5, yellow: 4, mixed: 4 }],
  [6026, "Developer Tools", { white: 31, blue: 28, black: 18, grey: 6, orange: 4, green: 3, teal: 3, violet: 4, red: 2, pink: 1 }],
  [6009, "News", { blue: 26, white: 24, black: 16, red: 21, orange: 3, grey: 4, teal: 2, yellow: 2, green: 1, violet: 1 }],
  [6015, "Finance", { blue: 23, white: 21, green: 15, black: 12, teal: 7, violet: 6, orange: 5, red: 4, grey: 3, yellow: 2, pink: 2 }],
  [6013, "Health & Fitness", { blue: 21, white: 19, black: 13, orange: 9, red: 8, green: 9, teal: 9, violet: 4, pink: 5, grey: 2, yellow: 1 }],
  [6012, "Lifestyle", { blue: 20, white: 19, black: 15, red: 10, orange: 8, green: 6, teal: 5, violet: 6, pink: 6, grey: 3, yellow: 2 }],
  [6024, "Shopping", { blue: 22, red: 17, white: 16, orange: 14, black: 10, green: 7, pink: 5, yellow: 4, teal: 2, violet: 2, grey: 1 }],
  [6005, "Social Networking", { blue: 27, black: 18, white: 12, violet: 9, pink: 8, red: 8, orange: 5, green: 5, teal: 4, yellow: 3, grey: 1 }],
  [6002, "Utilities", { blue: 29, white: 20, black: 17, grey: 8, green: 7, orange: 5, red: 5, teal: 5, violet: 3, yellow: 1 }],
  [6016, "Entertainment", { black: 29, blue: 18, red: 16, white: 10, violet: 8, orange: 6, pink: 5, teal: 3, green: 2, yellow: 2, grey: 1 }],
  [6011, "Music", { black: 29, white: 14, red: 13, blue: 12, orange: 9, violet: 8, pink: 7, green: 4, teal: 2, grey: 1, yellow: 1 }],
  [6008, "Photo & Video", { black: 30, white: 16, blue: 14, red: 9, orange: 8, violet: 7, pink: 6, yellow: 4, teal: 3, green: 2, grey: 1 }],
  [6007, "Productivity", { white: 42, blue: 25, black: 11, orange: 5, red: 4, green: 4, teal: 3, grey: 3, violet: 2, yellow: 1 }],
  [6020, "Medical", { white: 35, blue: 30, red: 9, teal: 8, green: 7, black: 4, grey: 3, violet: 2, orange: 1, pink: 1 }],
  [6023, "Food & Drink", { red: 24, white: 24, orange: 15, green: 10, black: 9, yellow: 7, blue: 5, pink: 3, teal: 2, grey: 1 }],
];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
/** The fixture rows for one ISO week (default the week of 23 November 2026). */
export function probeRows(week = "2026-W48"): IconIn[] {
  const out: IconIn[] = [];
  for (const [id, name, spec] of PROBE) {
    let rank = 1, k = 0;
    for (const [g, n] of Object.entries(spec) as [keyof Spec, number][]) for (let j = 0; j < n; j++, k++) {
      const v = BASE[g], hex = v[(j * 7 + k) % v.length]!, app = `${id}${String(rank).padStart(3, "0")}`;
      const palette = g === "mixed" ? v.map(h => ({ hex: h, share: 0.24 })) : [{ hex, share: 0.62 }, { hex: g === "white" ? "#0A84FF" : "#FFFFFF", share: 0.3 }];
      out.push({ app_id: app, rank, name: `${name} app ${rank}`, maker: `${name} maker`, link: `https://apps.apple.com/us/app/${slug(name)}-${rank}/id${app}`, palette, genre_id: id, genre_name: name, week });
      rank++;
    }
  }
  return out;
}
