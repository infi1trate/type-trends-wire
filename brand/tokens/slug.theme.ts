// slug brand theme values. Map these onto the app's token contract (src/lib/theme): one object, three modes.
export const slugBrand = {
  "color": {
    "paper": "#F1ECE0",
    "ink": "#0A0A0A",
    "white": "#FFFFFF",
    "pink": "#FF8FC4",
    "green": "#19B560",
    "yellow": "#FFE600",
    "red": "#E8320E",
    "newsprint": "#CFC7B4",
    "muted": "#4A463D"
  },
  "role": {
    "paper": "The page.",
    "ink": "Type, rules, shadows, the mark, the night desk.",
    "white": "Cards you read from.",
    "pink": "The lead: one plate per screen, covers.",
    "green": "Rising, positive data, the trail, measured values.",
    "yellow": "The highlighter: what moved, focus, stickers.",
    "red": "Live and urgent: the dot, the stamp, a falling number.",
    "newsprint": "Quiet fills, steady stage, grain grounds.",
    "muted": "Captions and secondary text on paper or white."
  },
  "mode": {
    "light": {
      "surface-page": "#F1ECE0",
      "surface-card": "#FFFFFF",
      "surface-raised": "#FFE600",
      "surface-sunken": "#CFC7B4",
      "surface-inverse": "#0A0A0A",
      "text-primary": "#0A0A0A",
      "text-muted": "#4A463D",
      "text-inverse": "#F1ECE0",
      "rule": "#0A0A0A",
      "plate": "#FF8FC4",
      "on-plate": "#0A0A0A",
      "highlight": "#FFE600",
      "positive": "#19B560",
      "live": "#E8320E",
      "shadow": "#0A0A0A",
      "mark-ground": "#F1ECE0"
    },
    "dark": {
      "surface-page": "#0A0A0A",
      "surface-card": "#1D1B18",
      "surface-raised": "#FFE600",
      "surface-sunken": "#141210",
      "surface-inverse": "#F1ECE0",
      "text-primary": "#F1ECE0",
      "text-muted": "#CFC7B4",
      "text-inverse": "#0A0A0A",
      "rule": "#F1ECE0",
      "plate": "#FF8FC4",
      "on-plate": "#0A0A0A",
      "highlight": "#FFE600",
      "positive": "#19B560",
      "live": "#E8320E",
      "shadow": "#F1ECE0",
      "mark-ground": "#FF8FC4"
    },
    "vibes": {
      "surface-page": "#FF8FC4",
      "surface-card": "#FFE600",
      "surface-raised": "#FFFFFF",
      "surface-sunken": "#F57BB6",
      "surface-inverse": "#0A0A0A",
      "text-primary": "#0A0A0A",
      "text-muted": "#4A1030",
      "text-inverse": "#F1ECE0",
      "rule": "#0A0A0A",
      "plate": "#0A0A0A",
      "on-plate": "#F1ECE0",
      "highlight": "#FFE600",
      "positive": "#19B560",
      "live": "#E8320E",
      "shadow": "#0A0A0A",
      "mark-ground": "#FF8FC4"
    }
  },
  "stage": {
    "emerging": {
      "bg": "#FF8FC4",
      "fg": "#0A0A0A"
    },
    "rising": {
      "bg": "#19B560",
      "fg": "#0A0A0A"
    },
    "peaking": {
      "bg": "#E8320E",
      "fg": "#0A0A0A"
    },
    "fading": {
      "bg": "#0A0A0A",
      "fg": "#F1ECE0"
    },
    "steady": {
      "bg": "#CFC7B4",
      "fg": "#0A0A0A"
    }
  },
  "gumball": {
    "pink": {
      "light": "#FFD9EC",
      "base": "#FF8FC4",
      "dark": "#C93E86"
    },
    "green": {
      "light": "#8BE8B4",
      "base": "#19B560",
      "dark": "#0B6E38"
    },
    "yellow": {
      "light": "#FFF7A8",
      "base": "#FFE600",
      "dark": "#C7A600"
    },
    "red": {
      "light": "#FF9A82",
      "base": "#E8320E",
      "dark": "#8F1A03"
    },
    "ink": {
      "light": "#6B6B6B",
      "base": "#0A0A0A",
      "dark": "#000000"
    }
  },
  "font": {
    "display": "'Big Shoulders', 'Arial Narrow', Impact, sans-serif",
    "text": "'Newsreader', Georgia, 'Times New Roman', serif",
    "google": "https://fonts.googleapis.com/css2?family=Big+Shoulders:wght@700;900&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&display=swap"
  },
  "type": {
    "display": {
      "family": "display",
      "weight": 900,
      "size": 132,
      "leading": 0.88,
      "case": "upper",
      "tracking": 0
    },
    "h1": {
      "family": "display",
      "weight": 900,
      "size": 72,
      "leading": 0.92,
      "case": "upper",
      "tracking": 0
    },
    "h2": {
      "family": "display",
      "weight": 900,
      "size": 44,
      "leading": 0.95,
      "case": "upper",
      "tracking": 0
    },
    "h3": {
      "family": "display",
      "weight": 900,
      "size": 28,
      "leading": 1.0,
      "case": "upper",
      "tracking": 0
    },
    "kicker": {
      "family": "display",
      "weight": 700,
      "size": 15,
      "leading": 1.15,
      "case": "upper",
      "tracking": "0.12em"
    },
    "chip": {
      "family": "display",
      "weight": 700,
      "size": 12,
      "leading": 1.5,
      "case": "upper",
      "tracking": "0.12em"
    },
    "deck": {
      "family": "text",
      "weight": 400,
      "size": 26,
      "leading": 1.25
    },
    "body": {
      "family": "text",
      "weight": 400,
      "size": 18,
      "leading": 1.55,
      "measure": "62ch"
    },
    "caption": {
      "family": "text",
      "weight": 400,
      "size": 14,
      "leading": 1.4
    },
    "quote": {
      "family": "text",
      "weight": 400,
      "style": "italic",
      "size": 34,
      "leading": 1.15
    },
    "figure": {
      "family": "display",
      "weight": 900,
      "size": 96,
      "leading": 0.9,
      "numeric": "tabular-nums",
      "unit-weight": 700
    }
  },
  "space": [
    4,
    8,
    16,
    24,
    40,
    64,
    104
  ],
  "shape": {
    "radius": 0,
    "radius-sticker": 999,
    "radius-app-icon": "23%",
    "border-hairline": 1.5,
    "border-rule": 3,
    "shadow-raised": "6px 6px 0 #0A0A0A",
    "shadow-pressed": "0 0 0 #0A0A0A",
    "shadow-sticker": "4px 5px 0 #0A0A0A"
  },
  "density": {
    "quiet": {
      "empty": 0.7,
      "gap-block": 64,
      "gap-inner": 24,
      "air-above-title": 104
    },
    "steady": {
      "empty": 0.45,
      "gap-block": 40,
      "gap-inner": 16
    },
    "loud": {
      "empty": 0.15,
      "gap-block": 8,
      "gap-inner": 8
    }
  },
  "motion": {
    "tap": "120ms",
    "move": "240ms",
    "wipe": "480ms",
    "arrive": "700ms",
    "draw": "1600ms to 3000ms",
    "stagger": "110ms",
    "ease-ooze": "cubic-bezier(0.3, 1.5, 0.5, 1)",
    "ease-cut": "cubic-bezier(0.7, 0, 0.3, 1)",
    "ease-settle": "cubic-bezier(0.2, 0.8, 0.2, 1)"
  },
  "mark": {
    "font": "Shrikhand (SIL Open Font License), de-slanted 14 degrees and redrawn as outlines",
    "cuts": {
      "display": {
        "min-height-px": 96,
        "gap": -45,
        "bloat": 28,
        "slit": 16
      },
      "standard": {
        "min-height-px": 32,
        "gap": -34,
        "bloat": 24,
        "slit": 24
      },
      "micro": {
        "min-height-px": 0,
        "gap": -10,
        "bloat": 34,
        "slit": 0
      }
    },
    "clear-space": "half the x-height on every side",
    "colour": "#0A0A0A"
  }
} as const;
export type SlugBrand = typeof slugBrand;
