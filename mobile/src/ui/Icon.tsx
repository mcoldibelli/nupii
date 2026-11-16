import { Image, View } from "react-native";
import Svg, { Circle, Ellipse, G, Line, Path, Polyline, Rect, Text as SvgText } from "react-native-svg";

import { colors } from "./theme";

const welcomeDog = require("../../assets/photos/welcome-dog.webp");
const noseGood = require("../../assets/photos/nose-good.webp");
const noseBad = require("../../assets/photos/nose-bad.webp");

// The drawings of the design canvas (ADR 0030): the stroke icons, the logo
// and the art around the dog photos. Only this file imports react-native-svg.
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
  upload: (
    <>
      <Path d="M12 16V4M7 9l5-5 5 5" />
      <Path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
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
  menu: <Path d="M5 7h14M5 12h14M5 17h14" />,
  link: <Path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  chat: <Path d="M4 20l1.4-4A8 8 0 1 1 9 19.5z" />,
  share: (
    <>
      <Path d="M12 3v12M7 8l5-5 5 5" />
      <Path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" />
    </>
  ),
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

/** The mark of the logo: a dog nose with the line of the mouth below (#319). */
export function LogoMark({ size = 28, color = colors.brand }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" aria-hidden>
      <Path d="M5.5 7.2C5.5 5.3 8.2 4.6 13 4.6S20.5 5.3 20.5 7.2C20.5 10.8 16.4 14.4 13 14.4S5.5 10.8 5.5 7.2Z" fill={color} />
      <Path d="M13 14V17.4M4.2 16.2C6 21.4 11.2 21.6 13 17.4 14.8 21.6 20 21.4 21.8 16.2" stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** The circles, the line and the paw behind the side of Login-Web and Cadastro-Web (#232). */
export function AuthSideArt() {
  return (
    <Svg viewBox="0 0 600 800" preserveAspectRatio="xMidYMax slice" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} aria-hidden>
      <Circle cx="300" cy="860" r="380" fill="#FFFFFF" fillOpacity={0.08} />
      <Circle cx="300" cy="860" r="270" fill="#FFFFFF" fillOpacity={0.08} />
      <Path d="M-20 300 C 90 230, 170 360, 300 280 S 520 230, 640 300" stroke="#FFFFFF" strokeOpacity={0.25} strokeWidth={3} fill="none" strokeLinecap="round" />
      <G fill="#FFFFFF" fillOpacity={0.2} transform="translate(510 170) rotate(18) scale(1.8)">
        <Ellipse cx="0" cy="8" rx="9" ry="7.5" />
        <Ellipse cx="-9" cy="-4" rx="3.6" ry="4.6" />
        <Ellipse cx="-3" cy="-10" rx="3.6" ry="4.6" />
        <Ellipse cx="4" cy="-10" rx="3.6" ry="4.6" />
        <Ellipse cx="10" cy="-4" rx="3.6" ry="4.6" />
      </G>
    </Svg>
  );
}

/** The background and the dog photo of the welcome header (Landing-Mobile artboard). */
export function WelcomeArt({ width, noseBox = false }: { width: number; noseBox?: boolean }) {
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
  // The photo and the nose box use the units of the 390 x 470 artboard.
  return (
    <View style={{ position: "absolute", left: 0, top: 0, width, height: 470 * scale }}>
    <Svg width={width} height={470 * scale} viewBox="0 0 390 470" aria-hidden>
      <Circle cx="195" cy="420" r="190" fill="#FFFFFF" fillOpacity={0.1} />
      <Circle cx="195" cy="420" r="140" fill="#FFFFFF" fillOpacity={0.1} />
      <Path d="M-30 250 C 50 200, 90 300, 160 250" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <Path d="M300 220 c 40 -10 70 20 110 0" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      {paw(350, 300, 20, 1.2)}
      {paw(36, 340, -18, 0.9)}
    </Svg>
    {/* Photo: Simon Lohmann on Unsplash, cut out (ADR 0030, item 28). */}
    <Image source={welcomeDog} accessibilityIgnoresInvertColors style={{ position: "absolute", left: 119 * scale, top: 200 * scale, width: 152 * scale, height: 270 * scale }} />
    {noseBox && <View style={{ position: "absolute", left: 161 * scale, top: 250 * scale, width: 58 * scale, height: 45 * scale, borderRadius: 14 * scale, borderWidth: 2.5, borderStyle: "dashed", borderColor: "#FFFFFF" }} />}
    </View>
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

/** The examples of the noseprint intro (Focinho-Intro artboard): the face from close, or the dog from far (ADR 0036). */
export function NoseExample({ good, size }: { good: boolean; size: number }) {
  // Photos: Nick Fewings on Unsplash (ADR 0030, item 28).
  return <Image source={good ? noseGood : noseBad} accessibilityIgnoresInvertColors style={{ width: size, height: size }} />;
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

