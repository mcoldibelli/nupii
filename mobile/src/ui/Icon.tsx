import Svg, { Circle, Ellipse, G, Line, Path, Polyline, Rect, Text as SvgText } from "react-native-svg";

import { colors } from "./theme";

// The drawings of the design canvas (ADR 0030): the stroke icons, the logo
// and the mascot. Only this file imports react-native-svg.
const icons = {
  home: <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  pin: (
    <>
      <Path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <Circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  heart: <Path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />,
  user: (
    <>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
  bell: (
    <>
      <Path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z" />
      <Path d="M10 21h4" />
    </>
  ),
  scan: (
    <>
      <Path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <Ellipse cx="12" cy="12.5" rx="4.5" ry="3.5" />
    </>
  ),
  card: (
    <>
      <Rect x="3" y="5" width="18" height="14" rx="3" />
      <Circle cx="9" cy="11" r="2" />
      <Path d="M6 16c.6-1.5 1.7-2.2 3-2.2s2.4.7 3 2.2M15 10h3M15 13.5h3" />
    </>
  ),
  calendar: (
    <>
      <Rect x="4" y="5" width="16" height="15" rx="3" />
      <Path d="M8 3v4M16 3v4M4 10h16" />
    </>
  ),
  alert: (
    <>
      <Path d="M12 4 2.5 20h19z" />
      <Path d="M12 10v4M12 17.5v.01" />
    </>
  ),
  check: <Path d="M5 12.5l4.5 4.5L19 7" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  chevronDown: <Path d="m6 9 6 6 6-6" />,
  chevronRight: <Path d="M9 6l6 6-6 6" />,
  back: <Path d="M15 6l-6 6 6 6" />,
  arrowRight: <Path d="M5 12h14M13 6l6 6-6 6" />,
  mail: (
    <>
      <Rect x="3" y="5" width="18" height="14" rx="3" />
      <Path d="m4 7 8 6 8-6" />
    </>
  ),
  lock: (
    <>
      <Rect x="5" y="10" width="14" height="10" rx="2.5" />
      <Path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  eye: (
    <>
      <Path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
      <Circle cx="12" cy="12" r="3" />
    </>
  ),
  syringe: <Path d="m18 2 4 4M17 7l3-3M19 9 8.7 19.3a2 2 0 0 1-2.8 0l-1.2-1.2a2 2 0 0 1 0-2.8L15 5M9 11l4 4M5 19l-3 3M14 4l6 6" />,
  pill: (
    <>
      <Path d="M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7z" />
      <Path d="m8.5 8.5 7 7" />
    </>
  ),
  stethoscope: (
    <>
      <Path d="M5 3v6a4 4 0 0 0 8 0V3" />
      <Path d="M9 13v2a5 5 0 0 0 10 0v-2" />
      <Circle cx="19" cy="11" r="2" />
    </>
  ),
  pencil: <Path d="M4 20h4L19 9l-4-4L4 16z" />,
  camera: (
    <>
      <Path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <Circle cx="12" cy="13" r="3.5" />
    </>
  ),
  frame: (
    <>
      <Rect x="5" y="5" width="14" height="14" rx="2" />
      <Path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5" />
    </>
  ),
  sun: (
    <>
      <Circle cx="12" cy="12" r="4" />
      <Path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  phone: (
    <>
      <Rect x="7" y="2" width="10" height="20" rx="2.5" />
      <Path d="M11 18h2" />
    </>
  ),
  close: <Path d="M6 6l12 12M18 6 6 18" />,
  sex: (
    <>
      <Circle cx="10" cy="14" r="5" />
      <Path d="M14 10l6-6M15 4h5v5" />
    </>
  ),
  weight: (
    <>
      <Path d="M6 8h12l2 12H4z" />
      <Path d="M9 8a3 3 0 0 1 6 0" />
    </>
  ),
  size: <Path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  more: <Path d="M12 5h.01M12 12h.01M12 19h.01" strokeWidth={3.6} />,
  refresh: (
    <>
      <Path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <Path d="M4 4v4h4" />
    </>
  ),
  image: (
    <>
      <Rect x="4" y="4" width="16" height="16" rx="3" />
      <Circle cx="9" cy="9.5" r="1.5" />
      <Path d="m20 15-4-4-8 8" />
    </>
  ),
  flask: (
    <>
      <Path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" />
      <Path d="M7.5 15h9" />
    </>
  ),
} as const;

export type IconName = keyof typeof icons;

/** A stroke icon of the canvas. The icon is decoration: the control around it has the label. */
export function Icon({ name, size = 22, color = colors.ink, strokeWidth = 2, filled = false }: { name: IconName; size?: number; color?: string; strokeWidth?: number; filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : "none"} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {icons[name]}
    </Svg>
  );
}

/** The face mark of the logo, in the color of the background it sits on. */
export function LogoMark({ size = 28, color = colors.brand, eyes = colors.background }: { size?: number; color?: string; eyes?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" aria-hidden>
      <Path d="M13 3c5 0 9 3.6 9 8.6 0 5.6-4.4 10.4-9 10.4S4 17.2 4 11.6C4 6.6 8 3 13 3z" fill={color} />
      <Ellipse cx="9.4" cy="12.6" rx="1.9" ry="2.6" fill={eyes} />
      <Ellipse cx="16.6" cy="12.6" rx="1.9" ry="2.6" fill={eyes} />
    </Svg>
  );
}

/** The dog of the sign-in header of the canvas. It is decoration. */
export function Mascot({ width = 186 }: { width?: number }) {
  return (
    <Svg width={width} height={(width * 260) / 240} viewBox="0 0 240 260" aria-hidden>
      <Path d="M44 260 C44 188 82 156 120 156 C158 156 196 188 196 260 Z" fill="#2B2730" />
      <Path d="M94 260 C94 214 106 192 120 192 C134 192 146 214 146 260 Z" fill="#F7E8D4" />
      <Path d="M64 82 C46 66 40 40 52 24 C72 30 90 50 98 70 Z" fill="#1E1B20" />
      <Path d="M176 82 C194 66 200 40 188 24 C168 30 150 50 142 70 Z" fill="#1E1B20" />
      <Ellipse cx="120" cy="108" rx="64" ry="58" fill="#3A3540" />
      <Path d="M120 54 C110 70 108 90 112 104 L128 104 C132 90 130 70 120 54 Z" fill="#F7E8D4" fillOpacity={0.85} />
      <Ellipse cx="120" cy="136" rx="34" ry="25" fill="#F7E8D4" />
      <Circle cx="96" cy="98" r="9.5" fill="#FFFFFF" />
      <Circle cx="96" cy="98" r="6.5" fill="#1E1B18" />
      <Circle cx="144" cy="98" r="9.5" fill="#FFFFFF" />
      <Circle cx="144" cy="98" r="6.5" fill="#1E1B18" />
      <Circle cx="98.5" cy="95.5" r="2.2" fill="#FFFFFF" />
      <Circle cx="146.5" cy="95.5" r="2.2" fill="#FFFFFF" />
      <Path d="M105 121 C105 113 135 113 135 121 C135 129 127 134 120 134 C113 134 105 129 105 121 Z" fill="#1E1B18" />
      <Path d="M114 148 C114 160 126 160 126 148 Z" fill="#E8636B" />
      <Path d="M120 134 V144 M120 144 C115 149 108 149 104 145 M120 144 C125 149 132 149 136 145" stroke="#1E1B18" strokeWidth={3} fill="none" strokeLinecap="round" />
      <Path d="M76 170 C100 182 140 182 164 170 L162 184 C140 196 100 196 78 184 Z" fill={colors.brand} />
      <Circle cx="120" cy="194" r="7.5" fill="#F2C14E" />
    </Svg>
  );
}

/** The background and the caramel dog of the welcome header (Landing-Mobile artboard). */
export function WelcomeArt({ collar, width, noseBox = false }: { collar: string; width: number; noseBox?: boolean }) {
  const paw = (x: number, y: number, rotate: number, scale: number) => (
    <G fill="#FFFFFF" fillOpacity={0.3} transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <Ellipse cx="0" cy="8" rx="9" ry="7.5" />
      <Ellipse cx="-9" cy="-4" rx="3.6" ry="4.6" />
      <Ellipse cx="-3" cy="-10" rx="3.6" ry="4.6" />
      <Ellipse cx="4" cy="-10" rx="3.6" ry="4.6" />
      <Ellipse cx="10" cy="-4" rx="3.6" ry="4.6" />
    </G>
  );
  const scale = width / 390;
  return (
    <Svg width={width} height={470 * scale} viewBox="0 0 390 470" aria-hidden style={{ position: "absolute", left: 0, top: 0 }}>
      <Circle cx="195" cy="420" r="190" fill="#FFFFFF" fillOpacity={0.1} />
      <Circle cx="195" cy="420" r="140" fill="#FFFFFF" fillOpacity={0.1} />
      <Path d="M-30 250 C 50 200, 90 300, 160 250" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <Path d="M300 220 c 40 -10 70 20 110 0" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      {paw(350, 300, 20, 1.2)}
      {paw(36, 340, -18, 0.9)}
      <G transform="translate(79 219) scale(0.9667)">
        <Path d="M44 260 C44 188 82 156 120 156 C158 156 196 188 196 260 Z" fill="#D88B3F" />
        <Path d="M94 260 C94 214 106 192 120 192 C134 192 146 214 146 260 Z" fill="#F7E8D4" />
        <Path d="M64 82 C46 66 40 40 52 24 C72 30 90 50 98 70 Z" fill="#A9622A" />
        <Path d="M176 82 C194 66 200 40 188 24 C168 30 150 50 142 70 Z" fill="#A9622A" />
        <Ellipse cx="120" cy="108" rx="64" ry="58" fill="#E39C52" />
        <Path d="M120 54 C110 70 108 90 112 104 L128 104 C132 90 130 70 120 54 Z" fill="#F7E8D4" fillOpacity={0.85} />
        <Ellipse cx="120" cy="136" rx="34" ry="25" fill="#F7E8D4" />
        <Circle cx="96" cy="98" r="7" fill="#1E1B18" />
        <Circle cx="144" cy="98" r="7" fill="#1E1B18" />
        <Circle cx="98.5" cy="95.5" r="2.2" fill="#FFFFFF" />
        <Circle cx="146.5" cy="95.5" r="2.2" fill="#FFFFFF" />
        <Path d="M105 121 C105 113 135 113 135 121 C135 129 127 134 120 134 C113 134 105 129 105 121 Z" fill="#1E1B18" />
        <Path d="M114 148 C114 160 126 160 126 148 Z" fill="#E8636B" />
        <Path d="M120 134 V144 M120 144 C115 149 108 149 104 145 M120 144 C125 149 132 149 136 145" stroke="#1E1B18" strokeWidth={3} fill="none" strokeLinecap="round" />
        <Path d="M76 170 C100 182 140 182 164 170 L162 184 C140 196 100 196 78 184 Z" fill={collar} />
        <Circle cx="120" cy="194" r="7.5" fill="#F2C14E" />
      </G>
      {noseBox && <Rect x="166" y="323" width="58" height="45" rx="14" fill="none" stroke="#FFFFFF" strokeWidth={2.5} strokeDasharray="6 5" />}
    </Svg>
  );
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** The weight chart of the home (Inicio-Mobile artboard): a line with a dot per point and the month under it. */
export function WeightChart({ points, width }: { points: { date: string; kg: number }[]; width: number }) {
  const height = 96;
  const values = points.map((point) => point.kg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (points.length === 1 ? width / 2 : 10 + (i * (width - 20)) / (points.length - 1));
  const y = (kg: number) => 70 - ((kg - min) / span) * 42;
  const line = points.map((point, i) => `${x(i)},${y(point.kg)}`).join(" ");
  const label = points.map((point) => `${MONTHS[Number(point.date.slice(5, 7)) - 1]} ${point.kg.toString().replace(".", ",")} kg`).join("; ");
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} accessibilityLabel={`Peso: ${label}`}>
      {[14, 44, 74].map((lineY) => (
        <Line key={lineY} x1="0" y1={lineY} x2={width} y2={lineY} stroke="#E3E2DF" strokeWidth={1} strokeDasharray="3 4" />
      ))}
      <Polyline points={line} fill="none" stroke={colors.brand} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point, i) => {
        const lastPoint = i === points.length - 1;
        return (
          <G key={point.date}>
            <Circle cx={x(i)} cy={y(point.kg)} r={lastPoint ? 6 : 3.5} fill={lastPoint ? colors.brand : "#FFFFFF"} stroke={lastPoint ? "#FFFFFF" : colors.brand} strokeWidth={lastPoint ? 2.5 : 2} />
            <SvgText x={x(i)} y={93} fontSize={12} fill={lastPoint ? colors.ink : colors.textMuted} fontWeight={lastPoint ? "700" : "400"} textAnchor="middle">
              {MONTHS[Number(point.date.slice(5, 7)) - 1]}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

/** The examples of the noseprint intro (Focinho-Intro artboard): the nose up close, or the dog far away. */
export function NoseExample({ good, size }: { good: boolean; size: number }) {
  return good ? (
    <Svg width={size} height={size} viewBox="0 0 150 150" aria-hidden>
      <Rect width="150" height="150" fill="#3A3F46" />
      <Path d="M75 22c38 0 66 20 66 50 0 30-30 50-66 50S9 102 9 72C9 42 37 22 75 22z" fill="#2A2E33" />
      <Path d="M45 56c10-5 22 1 23 13 1 10-7 17-17 16-10-1-16-9-15-18 1-5 4-9 9-11z" fill="#0D0E10" />
      <Path d="M105 56c-10-5-22 1-23 13-1 10 7 17 17 16 10-1 16-9 15-18-1-5-4-9-9-11z" fill="#0D0E10" />
      <Path d="M75 88v22" stroke="#0D0E10" strokeWidth={4} strokeLinecap="round" />
    </Svg>
  ) : (
    <Svg width={size} height={size} viewBox="0 0 150 150" aria-hidden>
      <Rect width="150" height="150" fill="#2A2622" />
      <G transform="translate(45 40) scale(0.25)">
        <Path d="M64 82 C46 66 40 40 52 24 C72 30 90 50 98 70 Z" fill="#A9622A" />
        <Path d="M176 82 C194 66 200 40 188 24 C168 30 150 50 142 70 Z" fill="#A9622A" />
        <Ellipse cx="120" cy="108" rx="64" ry="58" fill="#E39C52" />
        <Ellipse cx="120" cy="136" rx="34" ry="25" fill="#F7E8D4" />
        <Circle cx="96" cy="98" r="7" fill="#1E1B18" />
        <Circle cx="144" cy="98" r="7" fill="#1E1B18" />
        <Path d="M105 121 C105 113 135 113 135 121 C135 129 127 134 120 134 C113 134 105 129 105 121 Z" fill="#1E1B18" />
        <Path d="M44 260 C44 188 82 156 120 156 C158 156 196 188 196 260 Z" fill="#D88B3F" />
      </G>
    </Svg>
  );
}

const paw = (
  <>
    <Ellipse cx="0" cy="8" rx="9" ry="7.5" />
    <Ellipse cx="-9" cy="-4" rx="3.6" ry="4.6" />
    <Ellipse cx="-3" cy="-10" rx="3.6" ry="4.6" />
    <Ellipse cx="4" cy="-10" rx="3.6" ry="4.6" />
    <Ellipse cx="10" cy="-4" rx="3.6" ry="4.6" />
  </>
);

/** The art behind the photo of the pet profile (Pet artboard): a circle, a line and two paw prints. */
export function ProfileArt({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <Circle cx={width - 70} cy={height - 90} r="120" fill="#FFFFFF" fillOpacity={0.45} />
      <Path d="M-20 90 C 60 30, 110 140, 190 80" stroke={colors.surface} strokeOpacity={0.7} strokeWidth={2.5} fill="none" />
      <G fill={colors.surface} fillOpacity={0.6} transform={`translate(48 ${height - 90}) rotate(-18) scale(1.2)`}>
        {paw}
      </G>
      <G fill={colors.surface} fillOpacity={0.6} transform={`translate(${width - 60} 70) rotate(20) scale(0.9)`}>
        {paw}
      </G>
    </Svg>
  );
}
