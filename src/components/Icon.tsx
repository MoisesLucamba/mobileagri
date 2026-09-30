import React from "react";
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from "react-native-svg";

export type IconName =
  | "leaf"
  | "check-circle"
  | "map"
  | "image"
  | "chevron-left"
  | "chevron-right"
  | "heart"
  | "message"
  | "phone"
  | "cart"
  | "send"
  | "close"
  | "pin"
  | "navigation"
  | "home"
  | "user"
  | "plus"
  | "file"
  | "truck"
  | "minus"
  | "check"
  | "clock"
  | "shield"
  | "arrow-right"
  | "share"
  | "flask"
  | "card"
  | "smartphone"
  | "lock"
  | "grid"
  | "search"
  | "bell"
  | "chevron-down"
  | "apple"
  | "citrus"
  | "layers"
  | "fish"
  | "utensils"
  | "egg"
  | "coffee"
  | "droplet"
  | "wine"
  | "sprout"
  | "close-circle"
  | "sliders"
  | "trending-up"
  | "arrow-down"
  | "arrow-up"
  | "package"
  | "users"
  | "alert-circle"
  | "arrow-left"
  | "settings"
  | "log-out"
  | "camera"
  | "mail"
  | "edit"
  | "receipt"
  | "copy"
  | "clipboard"
  | "bar-chart"
  | "star"
    | "star"
  | "eye"
  | "eye-off"
  | "key"
  | "trash"
  | "info"
    | "refresh" | "locate" | "list" | "maximize" | "cloud-off";

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  filled?: boolean;
  strokeWidth?: number;
};

export default function Icon({ name, size = 18, color = "#16231C", filled = false, strokeWidth = 2 }: Props) {
  const p = {
    stroke: color,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  let content: React.ReactNode = null;

  switch (name) {
    case "leaf":
      content = (
        <>
          <Path {...p} d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
          <Path {...p} d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
        </>
      );
      break;

    case "check-circle":
      content = (
        <>
          <Path {...p} d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <Polyline {...p} points="22 4 12 14.01 9 11.01" />
        </>
      );
      break;

    case "map":
      content = (
        <>
          <Polygon {...p} points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <Line {...p} x1="8" y1="2" x2="8" y2="18" />
          <Line {...p} x1="16" y1="6" x2="16" y2="22" />
        </>
      );
      break;

    case "image":
      content = (
        <>
          <Rect {...p} x="3" y="3" width="18" height="18" rx="2" />
          <Circle {...p} cx="8.5" cy="8.5" r="1.5" />
          <Polyline {...p} points="21 15 16 10 5 21" />
        </>
      );
      break;

    case "chevron-left":
      content = <Polyline {...p} points="15 18 9 12 15 6" />;
      break;

    case "chevron-right":
      content = <Polyline {...p} points="9 18 15 12 9 6" />;
      break;

    case "heart":
      content = (
        <Path
          {...p}
          fill={filled ? color : "none"}
          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        />
      );
      break;

    case "message":
      content = (
        <Path
          {...p}
          d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
        />
      );
      break;

    case "phone":
      content = (
        <Path
          {...p}
          d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
        />
      );
      break;

    case "cart":
      content = (
        <>
          <Circle {...p} cx="9" cy="21" r="1" />
          <Circle {...p} cx="20" cy="21" r="1" />
          <Path {...p} d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </>
      );
      break;

    case "send":
      content = (
        <>
          <Line {...p} x1="22" y1="2" x2="11" y2="13" />
          <Polygon {...p} points="22 2 15 22 11 13 2 9 22 2" />
        </>
      );
      break;

    case "close":
      content = (
        <>
          <Line {...p} x1="18" y1="6" x2="6" y2="18" />
          <Line {...p} x1="6" y1="6" x2="18" y2="18" />
        </>
      );
      break;

    case "pin":
      content = (
        <>
          <Path {...p} d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <Circle {...p} cx="12" cy="10" r="3" />
        </>
      );
      break;

    case "navigation":
      content = <Polygon {...p} points="3 11 22 2 13 21 11 13 3 11" />;
      break;

    case "home":
      content = (
        <>
          <Path {...p} d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <Polyline {...p} points="9 22 9 12 15 12 15 22" />
        </>
      );
      break;

    case "user":
      content = (
        <>
          <Path {...p} d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <Circle {...p} cx="12" cy="7" r="4" />
        </>
      );
      break;

    case "plus":
      content = (
        <>
          <Line {...p} x1="12" y1="5" x2="12" y2="19" />
          <Line {...p} x1="5" y1="12" x2="19" y2="12" />
        </>
      );
      break;

    case "file":
      content = (
        <>
          <Path {...p} d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <Polyline {...p} points="14 2 14 8 20 8" />
          <Line {...p} x1="16" y1="13" x2="8" y2="13" />
          <Line {...p} x1="16" y1="17" x2="8" y2="17" />
        </>
      );
      break;

    case "truck":
      content = (
        <>
          <Rect {...p} x="1" y="3" width="15" height="13" />
          <Polygon {...p} points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <Circle {...p} cx="5.5" cy="18.5" r="2.5" />
          <Circle {...p} cx="18.5" cy="18.5" r="2.5" />
        </>
      );
      break;

    case "minus":
      content = <Line {...p} x1="5" y1="12" x2="19" y2="12" />;
      break;

    case "check":
      content = <Polyline {...p} points="20 6 9 17 4 12" />;
      break;

    case "clock":
      content = (
        <>
          <Circle {...p} cx="12" cy="12" r="10" />
          <Polyline {...p} points="12 6 12 12 16 14" />
        </>
      );
      break;

    case "shield":
      content = (
        <>
          <Path {...p} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <Polyline {...p} points="9 12 11 14 15 10" />
        </>
      );
      break;

    case "arrow-right":
      content = (
        <>
          <Line {...p} x1="5" y1="12" x2="19" y2="12" />
          <Polyline {...p} points="12 5 19 12 12 19" />
        </>
      );
      break;

    case "share":
      content = (
        <>
          <Circle {...p} cx="18" cy="5" r="3" />
          <Circle {...p} cx="6" cy="12" r="3" />
          <Circle {...p} cx="18" cy="19" r="3" />
          <Line {...p} x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <Line {...p} x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </>
      );
      break;

    case "flask":
      content = (
        <>
          <Path
            {...p}
            d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"
          />
          <Line {...p} x1="8.5" y1="2" x2="15.5" y2="2" />
          <Line {...p} x1="7" y1="16" x2="17" y2="16" />
        </>
      );
      break;

    case "card":
      content = (
        <>
          <Rect {...p} x="1" y="4" width="22" height="16" rx="2" />
          <Line {...p} x1="1" y1="10" x2="23" y2="10" />
        </>
      );
      break;

    case "smartphone":
      content = (
        <>
          <Rect {...p} x="5" y="2" width="14" height="20" rx="2" />
          <Line {...p} x1="12" y1="18" x2="12.01" y2="18" />
        </>
      );
      break;

    case "lock":
      content = (
        <>
          <Rect {...p} x="3" y="11" width="18" height="11" rx="2" />
          <Path {...p} d="M7 11V7a5 5 0 0 1 10 0v4" />
        </>
      );
      break;

    case "grid":
      content = (
        <>
          <Rect {...p} x="3" y="3" width="7" height="7" />
          <Rect {...p} x="14" y="3" width="7" height="7" />
          <Rect {...p} x="14" y="14" width="7" height="7" />
          <Rect {...p} x="3" y="14" width="7" height="7" />
        </>
      );
      break;

    case "search":
      content = (
        <>
          <Circle {...p} cx="11" cy="11" r="8" />
          <Line {...p} x1="21" y1="21" x2="16.65" y2="16.65" />
        </>
      );
      break;

    case "bell":
      content = (
        <>
          <Path {...p} d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <Path {...p} d="M13.73 21a2 2 0 0 1-3.46 0" />
        </>
      );
      break;

    case "chevron-down":
      content = <Polyline {...p} points="6 9 12 15 18 9" />;
      break;

    case "apple":
      content = (
        <>
          <Path {...p} d="M12 7c-2-2-7-1-7 5 0 4 2.5 9 5 9 1 0 1.5-.5 2-.5s1 .5 2 .5c2.5 0 5-5 5-9 0-6-5-7-7-5z" />
          <Path {...p} d="M12 7c0-2 1-4 3-5" />
        </>
      );
      break;

    case "citrus":
      content = (
        <>
          <Circle {...p} cx="12" cy="12" r="9" />
          <Line {...p} x1="12" y1="3" x2="12" y2="21" />
          <Line {...p} x1="3" y1="12" x2="21" y2="12" />
          <Line {...p} x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
          <Line {...p} x1="18.4" y1="5.6" x2="5.6" y2="18.4" />
        </>
      );
      break;

    case "layers":
      content = (
        <>
          <Polygon {...p} points="12 2 2 7 12 12 22 7 12 2" />
          <Polyline {...p} points="2 17 12 22 22 17" />
          <Polyline {...p} points="2 12 12 17 22 12" />
        </>
      );
      break;

    case "fish":
      content = (
        <>
          <Path {...p} d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z" />
          <Path {...p} d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33" />
          <Path {...p} d="M18 12v.5" />
        </>
      );
      break;

    case "utensils":
      content = (
        <>
          <Path {...p} d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
          <Path {...p} d="M7 2v20" />
          <Path {...p} d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
        </>
      );
      break;

    case "egg":
      content = <Path {...p} d="M12 2C8 2 4 8 4 14a8 8 0 0 0 16 0c0-6-4-12-8-12" />;
      break;

    case "coffee":
      content = (
        <>
          <Path {...p} d="M18 8h1a4 4 0 0 1 0 8h-1" />
          <Path {...p} d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
          <Line {...p} x1="6" y1="1" x2="6" y2="4" />
          <Line {...p} x1="10" y1="1" x2="10" y2="4" />
          <Line {...p} x1="14" y1="1" x2="14" y2="4" />
        </>
      );
      break;

    case "droplet":
      content = <Path {...p} d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />;
      break;

    case "wine":
      content = (
        <>
          <Path {...p} d="M8 22h8" />
          <Path {...p} d="M7 10h10" />
          <Path {...p} d="M12 15v7" />
          <Path {...p} d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z" />
        </>
      );
      break;

    case "sprout":
      content = (
        <>
          <Path {...p} d="M7 20h10" />
          <Path {...p} d="M10 20c5.5-2.5.8-6.4 3-10" />
          <Path {...p} d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
          <Path {...p} d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
        </>
      );
      break;

    case "close-circle":
      content = (
        <>
          <Circle {...p} cx="12" cy="12" r="10" />
          <Line {...p} x1="15" y1="9" x2="9" y2="15" />
          <Line {...p} x1="9" y1="9" x2="15" y2="15" />
        </>
      );
      break;

    case "sliders":
      content = (
        <>
          <Line {...p} x1="4" y1="21" x2="4" y2="14" />
          <Line {...p} x1="4" y1="10" x2="4" y2="3" />
          <Line {...p} x1="12" y1="21" x2="12" y2="12" />
          <Line {...p} x1="12" y1="8" x2="12" y2="3" />
          <Line {...p} x1="20" y1="21" x2="20" y2="16" />
          <Line {...p} x1="20" y1="12" x2="20" y2="3" />
          <Line {...p} x1="1" y1="14" x2="7" y2="14" />
          <Line {...p} x1="9" y1="8" x2="15" y2="8" />
          <Line {...p} x1="17" y1="16" x2="23" y2="16" />
        </>
      );
      break;

    case "trending-up":
      content = (
        <>
          <Polyline {...p} points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <Polyline {...p} points="17 6 23 6 23 12" />
        </>
      );
      break;

    case "arrow-down":
      content = (
        <>
          <Line {...p} x1="12" y1="5" x2="12" y2="19" />
          <Polyline {...p} points="19 12 12 19 5 12" />
        </>
      );
      break;

    case "arrow-up":
      content = (
        <>
          <Line {...p} x1="12" y1="19" x2="12" y2="5" />
          <Polyline {...p} points="5 12 12 5 19 12" />
        </>
      );
      break;

    case "package":
      content = (
        <>
          <Path {...p} d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <Polyline {...p} points="3.27 6.96 12 12.01 20.73 6.96" />
          <Line {...p} x1="12" y1="22.08" x2="12" y2="12" />
        </>
      );
      break;

    case "users":
      content = (
        <>
          <Path {...p} d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <Circle {...p} cx="9" cy="7" r="4" />
          <Path {...p} d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <Path {...p} d="M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      );
      break;

    case "alert-circle":
      content = (
        <>
          <Circle {...p} cx="12" cy="12" r="10" />
          <Line {...p} x1="12" y1="8" x2="12" y2="12" />
          <Line {...p} x1="12" y1="16" x2="12.01" y2="16" />
        </>
      );
      break;

    case "arrow-left":
      content = (
        <>
          <Line {...p} x1="19" y1="12" x2="5" y2="12" />
          <Polyline {...p} points="12 19 5 12 12 5" />
        </>
      );
      break;

    case "settings":
      content = (
        <>
          <Circle {...p} cx="12" cy="12" r="3" />
          <Path
            {...p}
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
          />
        </>
      );
      break;

    case "log-out":
      content = (
        <>
          <Path {...p} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <Polyline {...p} points="16 17 21 12 16 7" />
          <Line {...p} x1="21" y1="12" x2="9" y2="12" />
        </>
      );
      break;

    case "camera":
      content = (
        <>
          <Path {...p} d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <Circle {...p} cx="12" cy="13" r="4" />
        </>
      );
      break;

    case "mail":
      content = (
        <>
          <Path {...p} d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <Polyline {...p} points="22 6 12 13 2 6" />
        </>
      );
      break;

    case "edit":
      content = (
        <>
          <Path {...p} d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <Path {...p} d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </>
      );
      break;

    case "receipt":
      content = (
        <>
          <Path {...p} d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
          <Path {...p} d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
          <Path {...p} d="M12 17.5v-11" />
        </>
      );
      break;

    case "copy":
      content = (
        <>
          <Rect {...p} x="9" y="9" width="13" height="13" rx="2" />
          <Path {...p} d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </>
      );
      break;

    case "clipboard":
      content = (
        <>
          <Path {...p} d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <Rect {...p} x="8" y="2" width="8" height="4" rx="1" />
        </>
      );
      break;

    case "bar-chart":
      content = (
        <>
          <Line {...p} x1="12" y1="20" x2="12" y2="10" />
          <Line {...p} x1="18" y1="20" x2="18" y2="4" />
          <Line {...p} x1="6" y1="20" x2="6" y2="16" />
        </>
      );
      break;

    case "star":
      content = (
        <Polygon
          {...p}
          fill={filled ? color : "none"}
          points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
        />
      );
      break;
          case "eye":
      content = (
        <>
          <Path {...p} d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <Circle {...p} cx="12" cy="12" r="3" />
        </>
      );
      break;

    case "eye-off":
      content = (
        <>
          <Path {...p} d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <Line {...p} x1="1" y1="1" x2="23" y2="23" />
        </>
      );
      break;

    case "key":
      content = (
        <>
          <Circle {...p} cx="7.5" cy="15.5" r="5.5" />
          <Path {...p} d="M21 2l-9.6 9.6" />
          <Path {...p} d="M15.5 7.5l3 3L22 7l-3-3" />
        </>
      );
      break;

    case "trash":
      content = (
        <>
          <Polyline {...p} points="3 6 5 6 21 6" />
          <Path {...p} d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 0V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2" />
          <Line {...p} x1="10" y1="11" x2="10" y2="17" />
          <Line {...p} x1="14" y1="11" x2="14" y2="17" />
        </>
      );
      break;

    case "info":
      content = (
        <>
          <Circle {...p} cx="12" cy="12" r="10" />
          <Line {...p} x1="12" y1="16" x2="12" y2="12" />
          <Line {...p} x1="12" y1="8" x2="12.01" y2="8" />
        </>
      );
      break;
          case "refresh":
      content = (
        <>
          <Polyline {...p} points="23 4 23 10 17 10" />
          <Path {...p} d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </>
      );
      break;

    case "locate":
      content = (
        <>
          <Circle {...p} cx="12" cy="12" r="10" />
          <Line {...p} x1="22" y1="12" x2="18" y2="12" />
          <Line {...p} x1="6" y1="12" x2="2" y2="12" />
          <Line {...p} x1="12" y1="6" x2="12" y2="2" />
          <Line {...p} x1="12" y1="22" x2="12" y2="18" />
        </>
      );
      break;

    case "list":
      content = (
        <>
          <Line {...p} x1="8" y1="6" x2="21" y2="6" />
          <Line {...p} x1="8" y1="12" x2="21" y2="12" />
          <Line {...p} x1="8" y1="18" x2="21" y2="18" />
          <Line {...p} x1="3" y1="6" x2="3.01" y2="6" />
          <Line {...p} x1="3" y1="12" x2="3.01" y2="12" />
          <Line {...p} x1="3" y1="18" x2="3.01" y2="18" />
        </>
      );
      break;

    case "maximize":
      content = (
        <>
          <Polyline {...p} points="15 3 21 3 21 9" />
          <Polyline {...p} points="9 21 3 21 3 15" />
          <Line {...p} x1="21" y1="3" x2="14" y2="10" />
          <Line {...p} x1="3" y1="21" x2="10" y2="14" />
        </>
      );
      break;

    case "cloud-off":
      content = (
        <>
          <Path {...p} d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3" />
          <Line {...p} x1="1" y1="1" x2="23" y2="23" />
        </>
      );
      break;
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {content}
    </Svg>
  );
}