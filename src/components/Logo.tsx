import Svg, { Rect } from "react-native-svg";
import { colors } from "@/theme";

/** Geometric "open record book" mark — matches the app icon. */
export function LogoMark({ size = 64, color = colors.navy, page = "#AFC6F5" }: { size?: number; color?: string; page?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect x={27} y={22} width={35} height={56} rx={7} fill={color} />
      <Rect x={50} y={26} width={23} height={48} rx={6} fill={page} />
      <Rect x={55} y={30} width={14} height={32} rx={4} fill={color} />
      <Rect x={47} y={66} width={26} height={8} rx={4} fill={color} />
    </Svg>
  );
}
