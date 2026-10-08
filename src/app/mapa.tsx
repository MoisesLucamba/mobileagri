import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from "react-native";

import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import { type Href, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";
import Icon, { IconName } from "../components/Icon";
import ProcessingScreen from "../components/ProcessingScreen";

// Mesmo logo e mesma pasta usados no ecrã de login
const LOGO = require("../../assets/images/Agrilink_SD.png");

const { height: SCREEN_H } = Dimensions.get("window");

/* =====================================================================
   BRANDING — mesma palette do ProductCard
   ===================================================================== */

const COLORS = {
  primary: "#2E8B4F",
  primaryDark: "#25703F",
  tint: "#E9F5EC",
  text: "#16231C",
  muted: "#78877D",
  faint: "#AEB8AC",
  line: "#E8ECE6",
  field: "#F4F6F2",
  background: "#F9FAF8",
  white: "#FFFFFF",
  gold: "#B9741A",
  goldSoft: "#FBEBD3",
  blue: "#2F6DB5",
  blueSoft: "#E8EFF8",
  danger: "#DD5138",
};

// Sombra quase nula, igual ao cartão do feed
const SHADOW_FLAT = {
  shadowColor: "#16231C",
  shadowOpacity: 0.04,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
};

// Para elementos que flutuam sobre o mapa (precisam de um pouco mais de separação)
const SHADOW_FLOAT = {
  shadowColor: "#16231C",
  shadowOpacity: 0.1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 3,
};

const SHADOW_UP = {
  shadowColor: "#16231C",
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: -2 },
  elevation: 6,
};

/* =====================================================================
   TIPOS
   ===================================================================== */

type Kind = "produto" | "motorista" | "agente" | "agricultor";

type Entity = {
  id: string;
  rawId: string;
  kind: Kind;
  title: string;
  subtitle?: string;
  lat: number;
  lng: number;
  price?: number;
  quantity?: number;
  unit?: string;
  phone?: string;
  image_url?: string;
  harvest_date?: string;
};

type LatLng = { lat: number; lng: number };

type RouteResult = {
  coords: [number, number][];
  distance: number | null;
  duration: number | null;
};

type LocStatus = "idle" | "locating" | "granted" | "denied" | "off" | "unavailable";

const LAYERS: { kind: Kind; label: string; icon: IconName; color: string }[] = [
  { kind: "produto", label: "Produtos", icon: "leaf", color: COLORS.primary },
  { kind: "motorista", label: "Motoristas", icon: "truck", color: COLORS.blue },
  { kind: "agente", label: "Agentes", icon: "users", color: COLORS.gold },
  { kind: "agricultor", label: "Agricultores", icon: "sprout", color: COLORS.text },
];

const LAYER_BY_KIND = Object.fromEntries(
  LAYERS.map((l) => [l.kind, l]),
) as Record<Kind, (typeof LAYERS)[number]>;

// Mesmos desenhos do Icon.tsx, em SVG, para usar dentro dos pinos do mapa
const PIN_SVG: Record<string, string> = {
  produto:
    '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  motorista:
    '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  agente:
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  agricultor:
    '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
  pick: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
};

/* =====================================================================
   HELPERS
   ===================================================================== */

function distanceKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function fetchRoadRoute(from: LatLng, to: LatLng): Promise<RouteResult> {
  const fallback: RouteResult = {
    coords: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ],
    distance: null,
    duration: null,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    const url =
      "https://router.project-osrm.org/route/v1/driving/" +
      `${from.lng},${from.lat};${to.lng},${to.lat}` +
      "?overview=full&geometries=geojson";
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    const route = data?.routes?.[0];
    if (data?.code === "Ok" && route?.geometry?.coordinates?.length) {
      return {
        coords: route.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng] as [number, number],
        ),
        distance: route.distance ?? null,
        duration: route.duration ?? null,
      };
    }
  } catch {
    // sem rede ou timeout: linha reta
  }
  return fallback;
}

function formatDuration(seconds?: number | null) {
  if (seconds == null || !isFinite(seconds)) return "—";
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

function formatKz(value?: number) {
  return `${Number(value || 0).toLocaleString("pt-AO")} Kz`;
}

function pickCoords(row: any): LatLng | null {
  const lat = row.location_lat ?? row.lat ?? row.latitude;
  const lng = row.location_lng ?? row.lng ?? row.longitude;
  if (lat == null || lng == null) return null;
  const la = Number(lat);
  const ln = Number(lng);
  if (!isFinite(la) || !isFinite(ln)) return null;
  return { lat: la, lng: ln };
}

/* =====================================================================
   HTML DO MAPA — Leaflet no WebView, com CDN de reserva
   ===================================================================== */

const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #F9FAF8; }
  .leaflet-control-attribution { font-size: 9px; background: rgba(255,255,255,0.75); }
  .al-pin { background: transparent; border: none; }
  .al-tip {
    background:#16231C !important; color:#fff !important; border:none !important;
    font-weight:700 !important; font-size:11px !important; padding:5px 9px !important;
    border-radius:6px !important; box-shadow:0 2px 8px rgba(22,35,28,0.25) !important;
  }
  .al-tip::before { border-top-color:#16231C !important; }
</style>
</head>
<body>
<div id="map"></div>
<script>
(function () {
  var SVG = ${JSON.stringify(PIN_SVG)};

  function post(type, payload) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload || {} }));
    }
  }

  var BASES = [
    'https://unpkg.com/leaflet@1.9.4/dist/',
    'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/',
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/'
  ];

  function loadLeaflet(i) {
    if (i >= BASES.length) { post('fatal', { message: 'Não foi possível carregar o mapa.' }); return; }
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = BASES[i] + 'leaflet.css';
    document.head.appendChild(css);
    var s = document.createElement('script');
    s.src = BASES[i] + 'leaflet.js';
    s.onload = function () { try { boot(); } catch (e) { post('fatal', { message: String(e) }); } };
    s.onerror = function () { loadLeaflet(i + 1); };
    document.head.appendChild(s);
  }

  function boot() {
    var map = L.map('map', { zoomControl: false, attributionControl: true })
      .setView([-11.2, 17.8], 5);

    // Tiles públicos OpenStreetMap: sem chave; manter a atribuição visível.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
    }).addTo(map);

    var markers = {};
    var userMarker = null, userHalo = null, userAcc = null;
    var routeLayers = [];
    var animTimer = null;
    var pickMode = false, pickMarker = null;

    function pinHtml(color, kind, selected) {
      var size = selected ? 44 : 36;
      var inner = selected ? 20 : 17;
      var svg = '<svg width="' + inner + '" height="' + inner + '" viewBox="0 0 24 24" fill="none" stroke="#fff" ' +
        'stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">' + (SVG[kind] || '') + '</svg>';
      return '<div style="width:' + size + 'px;height:' + size + 'px;background:' + color +
        ';border:2.5px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);' +
        'display:flex;align-items:center;justify-content:center;' +
        'box-shadow:0 3px 10px rgba(22,35,28,0.28);">' +
        '<div style="transform:rotate(45deg);display:flex;align-items:center;justify-content:center;">' + svg + '</div></div>';
    }

    function clearRoute() {
      routeLayers.forEach(function (l) { try { map.removeLayer(l); } catch (e) {} });
      routeLayers = [];
      if (animTimer) { clearInterval(animTimer); animTimer = null; }
    }

    var API = {
      setEntities: function (list, selectedId) {
        Object.keys(markers).forEach(function (id) {
          try { map.removeLayer(markers[id]); } catch (e) {}
        });
        markers = {};
        list.forEach(function (item) {
          var sel = item.id === selectedId;
          var icon = L.divIcon({
            className: 'al-pin',
            html: pinHtml(item.color, item.kind, sel),
            iconSize: sel ? [44, 44] : [36, 36],
            iconAnchor: sel ? [22, 44] : [18, 36]
          });
          var m = L.marker([item.lat, item.lng], { icon: icon, zIndexOffset: sel ? 1000 : 0 })
            .addTo(map)
            .on('click', function () { post('select', { id: item.id }); });
          m.bindTooltip(item.title, { direction: 'top', offset: [0, -34], className: 'al-tip' });
          markers[item.id] = m;
        });
      },

      setUser: function (lat, lng, accuracy) {
        [userMarker, userHalo, userAcc].forEach(function (l) {
          if (l) { try { map.removeLayer(l); } catch (e) {} }
        });
        if (accuracy && accuracy > 20) {
          userAcc = L.circle([lat, lng], {
            radius: Math.min(accuracy, 2000), color: '#4C7EDB', weight: 1,
            fillColor: '#4C7EDB', fillOpacity: 0.08
          }).addTo(map);
        }
        userHalo = L.circleMarker([lat, lng], {
          radius: 18, color: '#2F6DB5', weight: 0, fillColor: '#2F6DB5', fillOpacity: 0.14
        }).addTo(map);
        var icon = L.divIcon({
          className: 'al-pin',
          html: '<div style="width:18px;height:18px;background:#2F6DB5;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(22,35,28,0.3);"></div>',
          iconSize: [18, 18], iconAnchor: [9, 9]
        });
        userMarker = L.marker([lat, lng], { icon: icon, zIndexOffset: 900 }).addTo(map);
      },

      flyTo: function (lat, lng, zoom) {
        map.flyTo([lat, lng], zoom || 14, { duration: 1.1 });
      },

      fitAll: function (points) {
        if (!points || !points.length) return;
        map.fitBounds(L.latLngBounds(points), { padding: [70, 70], maxZoom: 15 });
      },

      drawRoute: function (coords, color, animate, bottomPad) {
        clearRoute();
        if (!coords || coords.length < 2) return;
        var glow = L.polyline(coords, { color: color, weight: 9, opacity: 0.16 }).addTo(map);
        var line = L.polyline(coords, { color: color, weight: 3.5, opacity: 0.9, dashArray: '10 7' }).addTo(map);
        var origin = L.circleMarker(coords[0], { radius: 7, fillColor: '#fff', fillOpacity: 1, color: color, weight: 4 }).addTo(map);
        var dest = L.circleMarker(coords[coords.length - 1], { radius: 7, fillColor: color, fillOpacity: 1, color: '#fff', weight: 3 }).addTo(map);
        routeLayers.push(glow, line, origin, dest);

        map.fitBounds(L.latLngBounds(coords), {
          paddingTopLeft: [50, 220],
          paddingBottomRight: [50, bottomPad || 260]
        });

        if (animate) {
          var dot = L.circleMarker(coords[0], { radius: 9, fillColor: '#B9741A', fillOpacity: 1, color: '#fff', weight: 3 }).addTo(map);
          routeLayers.push(dot);
          var idx = 0, t = 0;
          var step = Math.max(1, Math.floor(coords.length / 400));
          animTimer = setInterval(function () {
            if (idx >= coords.length - 1) { idx = 0; t = 0; }
            var a = coords[idx], b = coords[Math.min(idx + step, coords.length - 1)];
            t += 0.08;
            if (t >= 1) { t = 0; idx += step; }
            dot.setLatLng([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
          }, 40);
        }
      },

      clearRoute: clearRoute,

      setPickMode: function (active) {
        pickMode = active;
        if (!active && pickMarker) {
          try { map.removeLayer(pickMarker); } catch (e) {}
          pickMarker = null;
        }
      }
    };

    map.on('click', function (ev) {
      if (!pickMode) return;
      if (pickMarker) { try { map.removeLayer(pickMarker); } catch (e) {} }
      var icon = L.divIcon({
        className: 'al-pin',
        html: pinHtml('#B9741A', 'pick', true),
        iconSize: [44, 44], iconAnchor: [22, 44]
      });
      pickMarker = L.marker(ev.latlng, { icon: icon }).addTo(map);
      post('pick', { lat: ev.latlng.lat, lng: ev.latlng.lng });
    });

    window.AL = function (raw) {
      try {
        var msg = JSON.parse(raw);
        if (API[msg.fn]) API[msg.fn].apply(null, msg.args || []);
      } catch (e) { post('error', { message: String(e) }); }
    };
    document.addEventListener('message', function (e) { window.AL(e.data); });
    window.addEventListener('message', function (e) { window.AL(e.data); });

    setTimeout(function () { map.invalidateSize(); }, 300);
    post('ready');
  }

  loadLeaflet(0);
})();
</script>
</body>
</html>`;

/* =====================================================================
   ECRÃ
   ===================================================================== */

export default function MapaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);

  const [webKey, setWebKey] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  const [entities, setEntities] = useState<Entity[]>([]);
  const [activeKinds, setActiveKinds] = useState<Kind[]>(
    LAYERS.map((l) => l.kind),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [userAccuracy, setUserAccuracy] = useState<number | null>(null);
  const [locStatus, setLocStatus] = useState<LocStatus>("idle");
  const [locationCanAskAgain, setLocationCanAskAgain] = useState(true);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const [listOpen, setListOpen] = useState(false);
  const [trackedId, setTrackedId] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<{
    km: number;
    duration: number | null;
  } | null>(null);
  const [startKm, setStartKm] = useState<number | null>(null);

  const [pickMode, setPickMode] = useState(false);
  const [pickedPoint, setPickedPoint] = useState<LatLng | null>(null);

  // refs para callbacks estáveis
  const entitiesRef = useRef<Entity[]>([]);
  const userRef = useRef<LatLng | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const locationRequestRef = useRef(0);
  const centeredRef = useRef(false);
  const routeReq = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchReq = useRef(0);

  entitiesRef.current = entities;
  userRef.current = userLocation;

  const selected = useMemo(
    () => entities.find((e) => e.id === selectedId) || null,
    [entities, selectedId],
  );
  const tracked = useMemo(
    () => entities.find((e) => e.id === trackedId) || null,
    [entities, trackedId],
  );
  const visible = useMemo(
    () => entities.filter((e) => activeKinds.includes(e.kind)),
    [entities, activeKinds],
  );

  const call = useCallback((fn: string, ...args: any[]) => {
    webRef.current?.injectJavaScript(
      `window.AL(${JSON.stringify(JSON.stringify({ fn, args }))}); true;`,
    );
  }, []);

  /* ---------------- Dados (Supabase) ---------------- */

  const loadEntities = useCallback(async () => {
    setLoading(true);
    const collected: Entity[] = [];

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .limit(200);
      if (error) console.log("Mapa: erro em products:", error.message);

      (data || []).forEach((row: any) => {
        const c = pickCoords(row);
        if (!c) return;
        collected.push({
          id: `produto:${row.id}`,
          rawId: String(row.id),
          kind: "produto",
          title: row.product_type || row.name || row.title || "Produto",
          subtitle: row.farmer_name || row.municipality_id,
          ...c,
          price: row.price,
          quantity: row.quantity,
          unit: "kg",
          phone: row.farmer_phone,
          image_url: row.image_url,
          harvest_date: row.harvest_date,
        });
      });
    } catch (e) {
      console.log("Mapa: falha em products", e);
    }

    const fleet: { table: string; kind: Kind }[] = [
      { table: "drivers", kind: "motorista" },
      { table: "field_agents", kind: "agente" },
      { table: "farmers", kind: "agricultor" },
    ];

    for (const src of fleet) {
      try {
        const { data, error } = await supabase
          .from(src.table)
          .select("*")
          .limit(200);
        if (error) continue; // tabela opcional

        (data || []).forEach((row: any) => {
          const c = pickCoords(row);
          if (!c) return;
          collected.push({
            id: `${src.kind}:${row.id}`,
            rawId: String(row.id),
            kind: src.kind,
            title: row.name || row.full_name || "Sem nome",
            subtitle: row.vehicle || row.municipality_id || row.phone,
            ...c,
            phone: row.phone,
          });
        });
      } catch {
        // ignora
      }
    }

    setEntities(collected);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadEntities();
  }, [loadEntities]);

  /* ---------------- Realtime (motoristas e agentes) ---------------- */

  useEffect(() => {
    const channel = supabase.channel("agrilink-mapa");

    const listen = (table: string, kind: Kind, fallback: string) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload: any) => {
          const row = payload.new;
          if (!row?.id) return;
          const c = pickCoords(row);
          if (!c) return;
          const id = `${kind}:${row.id}`;
          const entity: Entity = {
            id,
            rawId: String(row.id),
            kind,
            title: row.name || fallback,
            subtitle: row.vehicle || row.phone,
            ...c,
            phone: row.phone,
          };
          setEntities((cur) => {
            const i = cur.findIndex((e) => e.id === id);
            if (i < 0) return [...cur, entity];
            const next = [...cur];
            next[i] = { ...cur[i], ...entity };
            return next;
          });
        },
      );
    };

    listen("drivers", "motorista", "Motorista");
    listen("field_agents", "agente", "Agente");
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* ---------------- Geolocalização ---------------- */

  const startLocation = useCallback(async () => {
    const requestId = ++locationRequestRef.current;
    const isCurrentRequest = () => requestId === locationRequestRef.current;
    setLocStatus("locating");

    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (!isCurrentRequest()) return;
      setLocationCanAskAgain(permission.canAskAgain);
      if (!permission.granted) {
        setLocStatus("denied");
        return;
      }

      let enabled = await Location.hasServicesEnabledAsync();
      if (!enabled && Platform.OS === "android") {
        try {
          await Location.enableNetworkProviderAsync();
          enabled = await Location.hasServicesEnabledAsync();
        } catch (providerError) {
          console.warn("O utilizador não ativou a localização de alta precisão:", providerError);
        }
      }
      if (!isCurrentRequest()) return;
      if (!enabled) {
        setLocStatus("off");
        return;
      }

      const apply = (pos: Location.LocationObject) => {
        if (!isCurrentRequest()) return;
        hasPosition = true;
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setUserAccuracy(pos.coords.accuracy ?? null);
        setLocStatus("granted");
      };
      let hasPosition = false;

      const last = await Location.getLastKnownPositionAsync({
        maxAge: 120_000,
        requiredAccuracy: 1_000,
      });
      if (last) apply(last);
      if (!isCurrentRequest()) return;

      try {
        apply(
          await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            mayShowUserSettingsDialog: true,
          }),
        );
      } catch (locationError) {
        console.warn("Não foi possível obter uma posição GPS atual:", locationError);
        if (!hasPosition) setLocStatus("unavailable");
      }

      if (!isCurrentRequest()) return;
      watchRef.current?.remove();
      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 5,
          timeInterval: 3000,
        },
        apply,
        (watchError) => {
          console.warn("Falha ao acompanhar a localização do dispositivo:", watchError);
          if (isCurrentRequest() && !userRef.current) setLocStatus("unavailable");
        },
      );
      if (!isCurrentRequest()) {
        watchRef.current.remove();
        watchRef.current = null;
      }
    } catch (e) {
      console.log("Mapa: erro de localização", e);
      if (isCurrentRequest()) setLocStatus(userRef.current ? "granted" : "unavailable");
    }
  }, []);

  useEffect(() => {
    startLocation();
    return () => {
      locationRequestRef.current++;
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, [startLocation]);

  /* ---------------- Sincronizar estado -> mapa ---------------- */

  useEffect(() => {
    if (!mapReady) return;
    call(
      "setEntities",
      visible.map((e) => ({
        id: e.id,
        lat: e.lat,
        lng: e.lng,
        title: e.title,
        kind: e.kind,
        color: LAYER_BY_KIND[e.kind].color,
      })),
      selectedId,
    );
  }, [mapReady, visible, selectedId, call]);

  useEffect(() => {
    if (!mapReady || !userLocation) return;
    call("setUser", userLocation.lat, userLocation.lng, userAccuracy);
    if (!centeredRef.current) {
      centeredRef.current = true;
      call("flyTo", userLocation.lat, userLocation.lng, 12);
    }
  }, [mapReady, userLocation, userAccuracy, call]);

  useEffect(() => {
    if (!mapReady) return;
    call("setPickMode", pickMode);
    if (!pickMode) setPickedPoint(null);
  }, [mapReady, pickMode, call]);

  /* ---------------- Rotas ---------------- */

  const drawRouteTo = useCallback(
    async (entity: Entity, animate: boolean) => {
      const origin = userRef.current;
      if (!origin) return;

      const req = ++routeReq.current;
      const dest = { lat: entity.lat, lng: entity.lng };
      const route = await fetchRoadRoute(origin, dest);
      if (req !== routeReq.current) return; // resposta antiga

      const km =
        route.distance != null
          ? route.distance / 1000
          : distanceKm(origin, dest);

      const rounded = Math.round(km * 10) / 10;
      setRouteInfo({ km: rounded, duration: route.duration });
      setStartKm((cur) => (animate && cur == null ? rounded : cur));

      call(
        "drawRoute",
        route.coords,
        animate ? COLORS.primary : COLORS.blue,
        animate,
        animate ? 340 : 300,
      );
    },
    [call],
  );

  // Enquanto se rastreia, atualiza a rota (o motorista pode estar a mover-se)
  useEffect(() => {
    if (!tracked) return;
    const id = setInterval(() => drawRouteTo(tracked, true), 20000);
    return () => clearInterval(id);
  }, [tracked?.id, tracked?.lat, tracked?.lng, drawRouteTo]);

  /* ---------------- Ações ---------------- */

  const selectEntity = useCallback(
    (entity: Entity) => {
      setSelectedId(entity.id);
      setListOpen(false);
      setRouteInfo(null);
      if (userRef.current) {
        drawRouteTo(entity, false);
      } else {
        call("flyTo", entity.lat, entity.lng, 14);
      }
    },
    [call, drawRouteTo],
  );

  const onMessage = useCallback(
    (event: any) => {
      let msg: any;
      try {
        msg = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case "ready":
          setMapReady(true);
          setMapFailed(false);
          break;
        case "fatal":
          setMapFailed(true);
          break;
        case "select": {
          const ent = entitiesRef.current.find((e) => e.id === msg.payload.id);
          if (ent) selectEntity(ent);
          break;
        }
        case "pick":
          setPickedPoint(msg.payload);
          break;
      }
    },
    [selectEntity],
  );

  const retryMap = () => {
    setMapReady(false);
    setMapFailed(false);
    setWebKey((k) => k + 1);
  };

  const closeSelection = () => {
    routeReq.current++;
    setSelectedId(null);
    setRouteInfo(null);
    call("clearRoute");
  };

  const startTracking = (entity: Entity) => {
    if (!userLocation) {
      startLocation();
      return;
    }
    setStartKm(null);
    setTrackedId(entity.id);
    setSelectedId(entity.id);
    drawRouteTo(entity, true);
  };

  const stopTracking = () => {
    setTrackedId(null);
    setStartKm(null);
    closeSelection();
  };

  const toggleLayer = (kind: Kind) =>
    setActiveKinds((cur) =>
      cur.includes(kind) ? cur.filter((k) => k !== kind) : [...cur, kind],
    );

  const recenter = () => {
    if (userLocation) {
      call("flyTo", userLocation.lat, userLocation.lng, 14);
      void startLocation();
    } else if (locStatus === "denied" && !locationCanAskAgain) {
      Alert.alert(
        "Permissão de localização",
        "Ative a permissão de localização para a AgriLink nas definições do dispositivo.",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Abrir definições",
            onPress: () => {
              Linking.openSettings().catch((error) => {
                console.warn("Não foi possível abrir as definições:", error);
                Alert.alert("Definições indisponíveis", "Abra as definições do dispositivo e permita a localização para a AgriLink.");
              });
            },
          },
        ],
      );
    } else {
      void startLocation();
    }
  };

  const fitAll = () =>
    call(
      "fitAll",
      visible.map((e) => [e.lat, e.lng]),
    );

  /* ---------------- Pesquisa (Nominatim, com debounce) ---------------- */

  const runSearch = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (value.trim().length < 3) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const req = ++searchReq.current;
      try {
        const url =
          "https://nominatim.openstreetmap.org/search?format=json&limit=5" +
          "&countrycodes=ao&q=" +
          encodeURIComponent(value.trim());
        const res = await fetch(url, {
          headers: { "Accept-Language": "pt" },
        });
        const json = await res.json();
        if (req === searchReq.current) setSearchResults(json);
      } catch {
        if (req === searchReq.current) setSearchResults([]);
      } finally {
        if (req === searchReq.current) setSearching(false);
      }
    }, 500);
  };

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  /* ---------------- Derivados ---------------- */

  const distanceLabel = (entity: Entity) => {
    if (!userLocation) return null;
    if (selectedId === entity.id && routeInfo) {
      return `${routeInfo.km} km · ${formatDuration(routeInfo.duration)}`;
    }
    return `${Math.round(distanceKm(userLocation, entity))} km`;
  };

  const remainingKm =
    tracked && userLocation ? distanceKm(userLocation, tracked) : null;
  const progress =
    startKm && remainingKm != null && startKm > 0
      ? Math.max(0.04, Math.min(1, 1 - remainingKm / startKm))
      : 0.04;
  const arrived = remainingKm != null && remainingKm < 0.1;

  const hasPanel = !!selected || !!tracked;
  const fabBottom =
    insets.bottom + (tracked ? 360 : selected ? 300 : 96);

  const locBanner =
    locStatus === "denied"
      ? locationCanAskAgain
        ? "Permita a localização para mostrar a sua posição real e as distâncias."
        : "Ative a permissão de localização da AgriLink nas definições do dispositivo."
      : locStatus === "off"
        ? "A localização está desligada. Ative o GPS para ver a sua posição real."
        : locStatus === "locating"
          ? "A procurar a posição GPS deste dispositivo..."
          : locStatus === "unavailable"
            ? "Não foi possível obter a localização. Verifique o GPS e tente novamente."
            : null;

  const timeline: {
    state: "done" | "active" | "pending";
    icon: IconName;
    title: string;
    detail: string;
  }[] = tracked
    ? [
        {
          state: "done",
          icon: "leaf",
          title: "Colhido",
          detail: tracked.harvest_date
            ? new Date(tracked.harvest_date).toLocaleDateString("pt-AO")
            : "Data por confirmar",
        },
        {
          state: "done",
          icon: "user",
          title: "Recolhido pelo agente",
          detail: "Local de recolha confirmado",
        },
        {
          state: arrived ? "done" : "active",
          icon: "package",
          title: "Em trânsito",
          detail: arrived
            ? "Chegou ao destino"
            : routeInfo
              ? `${routeInfo.km} km · ${formatDuration(routeInfo.duration)}`
              : "A calcular rota...",
        },
        {
          state: arrived ? "active" : "pending",
          icon: "check-circle",
          title: "Entrega",
          detail: arrived ? "A confirmar entrega" : "Por concluir",
        },
      ]
    : [];

  /* =====================================================================
     RENDER
     ===================================================================== */

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <WebView
        key={webKey}
        ref={webRef}
        source={{ html: MAP_HTML, baseUrl: "https://agrilink.ao" }}
        originWhitelist={["*"]}
        onMessage={onMessage}
        onError={() => setMapFailed(true)}
        onHttpError={() => {}}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        geolocationEnabled
        style={styles.web}
        androidLayerType={Platform.OS === "android" ? "hardware" : undefined}
        setSupportMultipleWindows={false}
      />

      {/* ================= HEADER FLUTUANTE ================= */}
      <View
        style={[styles.headerWrap, { paddingTop: insets.top + 8 }]}
        pointerEvents="box-none"
      >
        <View style={styles.topCard}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Icon name="arrow-left" size={19} color={COLORS.text} />
          </TouchableOpacity>

          <Image source={LOGO} style={styles.logo} resizeMode="contain" />

          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Mapa de rastreio
            </Text>
            <Text style={styles.headerSubtitle}>
              {visible.length} elementos no mapa
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.iconBtn, pickMode && styles.iconBtnActive]}
            onPress={() => setPickMode((c) => !c)}
            activeOpacity={0.8}
            accessibilityLabel="Escolher local no mapa"
          >
            <Icon name="pin" size={18} color={pickMode ? "#FFFFFF" : COLORS.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconBtn, { marginLeft: 8 }]}
            onPress={loadEntities}
            activeOpacity={0.8}
            accessibilityLabel="Atualizar"
          >
            <Icon name="refresh" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Icon name="search" size={18} color={COLORS.muted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={runSearch}
            placeholder="Pesquisar local em Angola"
            placeholderTextColor={COLORS.faint}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searching && <Text style={styles.searchStatus}>A procurar…</Text>}
          {!!search && !searching && (
            <TouchableOpacity
              onPress={() => {
                setSearch("");
                setSearchResults([]);
              }}
              hitSlop={8}
            >
              <Icon name="close-circle" size={18} color={COLORS.muted} />
            </TouchableOpacity>
          )}
        </View>

        {searchResults.length > 0 && (
          <View style={styles.searchResults}>
            {searchResults.map((r, i) => (
              <TouchableOpacity
                key={r.place_id || i}
                style={[
                  styles.searchRow,
                  i < searchResults.length - 1 && styles.rowDivider,
                ]}
                onPress={() => {
                  call("flyTo", parseFloat(r.lat), parseFloat(r.lon), 13);
                  setSearch("");
                  setSearchResults([]);
                }}
              >
                <View style={styles.searchIcon}>
                  <Icon name="pin" size={15} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.searchTitle} numberOfLines={1}>
                    {String(r.display_name).split(",")[0]}
                  </Text>
                  <Text style={styles.searchSub} numberOfLines={1}>
                    {r.display_name}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.layerScroll}
          contentContainerStyle={styles.layerRow}
        >
          {LAYERS.map((layer) => {
            const active = activeKinds.includes(layer.kind);
            const count = entities.filter((e) => e.kind === layer.kind).length;
            return (
              <TouchableOpacity
                key={layer.kind}
                style={[
                  styles.layerChip,
                  active && { backgroundColor: layer.color, borderColor: layer.color },
                ]}
                onPress={() => toggleLayer(layer.kind)}
                activeOpacity={0.85}
              >
                <Icon
                  name={layer.icon}
                  size={15}
                  color={active ? "#FFFFFF" : layer.color}
                />
                <Text style={[styles.layerText, active && { color: "#FFFFFF" }]}>
                  {layer.label}
                </Text>
                <View
                  style={[
                    styles.layerCount,
                    active && { backgroundColor: "rgba(255,255,255,0.25)" },
                  ]}
                >
                  <Text
                    style={[styles.layerCountText, active && { color: "#FFFFFF" }]}
                  >
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Aviso de localização */}
      {!!locBanner && (
        <TouchableOpacity
          style={[styles.locBanner, { top: insets.top + 204 }]}
          onPress={recenter}
          disabled={locStatus === "locating"}
          activeOpacity={0.9}
        >
          <Icon name="navigation" size={19} color={COLORS.gold} />
          <Text style={styles.locBannerText}>{locBanner}</Text>
          {locStatus !== "locating" && (
            <Text style={styles.locBannerAction}>
              {locStatus === "denied" && !locationCanAskAgain ? "Definições" : "Tentar"}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* ================= MODO PINO ================= */}
      {pickMode && (
        <View style={[styles.sheet, styles.pickSheet, { paddingBottom: insets.bottom + 18 }]}>
          <View style={styles.sheetHandle} />
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={styles.pickIcon}>
              <Icon name="pin" size={20} color={COLORS.gold} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cardTitle}>
                {pickedPoint ? "Local selecionado" : "Toque no mapa"}
              </Text>
              <Text style={styles.cardSub}>
                {pickedPoint
                  ? `${pickedPoint.lat.toFixed(5)}, ${pickedPoint.lng.toFixed(5)}`
                  : "Escolha o ponto de recolha ou entrega"}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.pillButton, { marginTop: 14 }, !pickedPoint && styles.disabled]}
            disabled={!pickedPoint}
            activeOpacity={0.85}
            onPress={() => {
              if (!pickedPoint) return;
              router.push({
                pathname: "/publicar-produto",
                params: {
                  lat: String(pickedPoint.lat),
                  lng: String(pickedPoint.lng),
                },
              });
              setPickMode(false);
            }}
          >
            <Text style={styles.pillButtonText}>Usar este local</Text>
            <Icon name="arrow-right" size={17} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* ================= FABs ================= */}
      {!pickMode && (
        <View style={[styles.fabColumn, { bottom: fabBottom }]}>
          <TouchableOpacity style={styles.fab} onPress={recenter} activeOpacity={0.85}>
            <Icon
              name="locate"
              size={20}
              color={userLocation ? COLORS.primary : COLORS.muted}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.fab, { marginTop: 10 }]}
            onPress={fitAll}
            activeOpacity={0.85}
          >
            <Icon name="maximize" size={19} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* ================= CARTÃO SELECIONADO ================= */}
      {selected && !tracked && !pickMode && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
          <View style={styles.sheetHandle} />

          <View style={styles.rowCenter}>
            <View
              style={[styles.badge, { backgroundColor: LAYER_BY_KIND[selected.kind].color }]}
            >
              <Icon name={LAYER_BY_KIND[selected.kind].icon} size={20} color="#FFFFFF" />
            </View>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {selected.title}
              </Text>
              <Text style={styles.cardSub} numberOfLines={1}>
                {LAYER_BY_KIND[selected.kind].label.replace(/s$/, "")}
                {selected.subtitle ? ` · ${selected.subtitle}` : ""}
              </Text>
            </View>

            <TouchableOpacity style={styles.closeChip} onPress={closeSelection}>
              <Icon name="close" size={17} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {selected.kind === "produto" && (
            <View style={styles.metricsRow}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Preço</Text>
                <Text style={styles.metricValue}>{formatKz(selected.price)}</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Quantidade</Text>
                <Text style={styles.metricValue}>
                  {selected.quantity ?? "—"} {selected.unit || ""}
                </Text>
              </View>
            </View>
          )}

          {!!distanceLabel(selected) && (
            <View style={styles.distancePill}>
              <Icon name="navigation" size={14} color={COLORS.blue} />
              <Text style={styles.distanceText}>
                A {distanceLabel(selected)} de si
              </Text>
            </View>
          )}

          <View style={[styles.rowCenter, { marginTop: 14, gap: 10 }]}>
            <TouchableOpacity
              style={[styles.pillButton, { flex: 1 }]}
              onPress={() => startTracking(selected)}
              activeOpacity={0.85}
            >
              <Icon name="navigation" size={16} color="#FFFFFF" />
              <Text style={styles.pillButtonText}>Rastrear</Text>
            </TouchableOpacity>

            {!!selected.phone && (
              <TouchableOpacity
                style={styles.roundAction}
                onPress={() => Linking.openURL(`tel:${selected.phone}`)}
                activeOpacity={0.85}
              >
                <Icon name="phone" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            )}

            {selected.kind === "produto" && (
              <TouchableOpacity
                style={styles.roundAction}
                onPress={() =>
                  router.push({ pathname: "/product/[id]", params: { id: selected.rawId } } as Href)
                }
                activeOpacity={0.85}
              >
                <Icon name="info" size={19} color={COLORS.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ================= PAINEL DE RASTREIO ================= */}
      {tracked && !pickMode && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
          <View style={styles.sheetHandle} />

          <View style={styles.rowCenter}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Rastreabilidade</Text>
              <Text style={styles.cardSub} numberOfLines={1}>
                {tracked.title}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeChip} onPress={stopTracking}>
              <Icon name="close" size={17} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 16 }}>
            {timeline.map((step, i, all) => (
              <View key={step.title} style={styles.stepRow}>
                {i < all.length - 1 && (
                  <View
                    style={[
                      styles.stepLine,
                      step.state === "done" && { backgroundColor: COLORS.primary },
                    ]}
                  />
                )}
                <View
                  style={[
                    styles.stepDot,
                    step.state === "done" && {
                      borderColor: COLORS.primary,
                      backgroundColor: COLORS.tint,
                    },
                    step.state === "active" && {
                      borderColor: COLORS.gold,
                      backgroundColor: COLORS.goldSoft,
                    },
                  ]}
                >
                  <Icon
                    name={step.icon}
                    size={14}
                    color={
                      step.state === "done"
                        ? COLORS.primary
                        : step.state === "active"
                          ? COLORS.gold
                          : COLORS.muted
                    }
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDetail}>{step.detail}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.progressBox}>
            <View style={styles.progressHeader}>
              <Text style={styles.metricLabel}>Progresso da rota</Text>
              <Text style={styles.progressValue}>
                {arrived ? 100 : Math.round(progress * 100)}%
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${arrived ? 100 : progress * 100}%` }]}
              />
            </View>
          </View>
        </View>
      )}

      {/* ================= BOTÃO DA LISTA ================= */}
      {!hasPanel && !pickMode && (
        <TouchableOpacity
          style={[styles.listButton, { bottom: insets.bottom + 22 }]}
          onPress={() => setListOpen(true)}
          activeOpacity={0.9}
        >
          <Icon name="list" size={17} color="#FFFFFF" />
          <Text style={styles.pillButtonText}>Ver lista ({visible.length})</Text>
        </TouchableOpacity>
      )}

      {/* ================= LISTA ================= */}
      <Modal
        visible={listOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setListOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setListOpen(false)}>
          <Pressable
            style={[styles.sheetModal, { paddingBottom: insets.bottom + 20 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>No mapa</Text>
            <Text style={styles.cardSub}>Toque para centrar e traçar a rota</Text>

            <FlatList
              data={visible}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: SCREEN_H * 0.5, marginTop: 10 }}
              ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.listRow}
                  onPress={() => selectEntity(item)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.listThumb,
                      { backgroundColor: LAYER_BY_KIND[item.kind].color + "22" },
                    ]}
                  >
                    {item.image_url ? (
                      <Image source={{ uri: item.image_url }} style={styles.listThumbImage} />
                    ) : (
                      <Icon
                        name={LAYER_BY_KIND[item.kind].icon}
                        size={20}
                        color={LAYER_BY_KIND[item.kind].color}
                      />
                    )}
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.listTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.cardSub} numberOfLines={1}>
                      {item.kind === "produto" && item.price
                        ? `${formatKz(item.price)} · `
                        : ""}
                      {item.subtitle || LAYER_BY_KIND[item.kind].label}
                    </Text>
                  </View>

                  {!!distanceLabel(item) && (
                    <Text style={styles.listDistance}>{distanceLabel(item)}</Text>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ paddingVertical: 40, alignItems: "center" }}>
                  <Text style={styles.cardSub}>
                    Nenhum elemento nas camadas ativas.
                  </Text>
                </View>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* ================= ESTADOS ================= */}
      {!loading && mapReady && entities.length === 0 && !hasPanel && !pickMode && (
        <View style={[styles.emptyCard, { bottom: insets.bottom + 84 }]}>
          <Text style={styles.cardTitle}>Ainda não há elementos com localização</Text>
          <Text style={[styles.cardSub, { marginTop: 4 }]}>
            Os produtos aparecem aqui quando têm coordenadas guardadas.
          </Text>
        </View>
      )}

      {mapFailed && (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <Icon name="cloud-off" size={34} color={COLORS.danger} />
            <Text style={styles.overlayTitle}>Não foi possível carregar o mapa</Text>
            <Text style={styles.overlaySub}>Verifique a ligação à internet.</Text>
            <TouchableOpacity
              style={[styles.pillButton, { marginTop: 16, paddingHorizontal: 28 }]}
              onPress={retryMap}
              activeOpacity={0.85}
            >
              <Text style={styles.pillButtonText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!mapFailed && (loading || !mapReady) && (
        <ProcessingScreen />
      )}
    </View>
  );
}

/* =====================================================================
   ESTILOS
   ===================================================================== */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  web: { flex: 1, backgroundColor: COLORS.background },

  rowCenter: { flexDirection: "row", alignItems: "center" },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.line },
  disabled: { opacity: 0.55 },

  // HEADER FLUTUANTE (o mapa continua visível por baixo)
  headerWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    gap: 10,
  },
  topCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.line,
    ...SHADOW_FLOAT,
  },
  // Mesmo botão do ícone de mapa do ProductCard
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.tint,
  },
  logo: { width: 28, height: 28, marginLeft: 10 },
  headerTitle: { fontSize: 15, fontWeight: "900", color: COLORS.text },
  headerSubtitle: { fontSize: 11.5, color: COLORS.muted, marginTop: 1 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.tint,
  },
  iconBtnActive: { backgroundColor: COLORS.gold },

  // PESQUISA
  searchBox: {
    height: 46,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.line,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
    ...SHADOW_FLOAT,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, padding: 0 },
  searchStatus: { color: COLORS.muted, fontSize: 11, fontWeight: "600" },
  searchResults: {
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.line,
    overflow: "hidden",
    ...SHADOW_FLOAT,
  },
  searchRow: { flexDirection: "row", alignItems: "center", padding: 12, gap: 10 },
  searchIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  searchTitle: { fontSize: 13.5, fontWeight: "800", color: COLORS.text },
  searchSub: { fontSize: 11.5, color: COLORS.muted, marginTop: 2 },

  // CAMADAS
  layerScroll: { marginHorizontal: -18 },
  layerRow: { paddingHorizontal: 18, gap: 8, paddingBottom: 6 },
  layerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.line,
    ...SHADOW_FLOAT,
  },
  layerText: { fontSize: 12.5, fontWeight: "800", color: COLORS.text },
  layerCount: {
    minWidth: 20,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 6,
    backgroundColor: COLORS.field,
    alignItems: "center",
    justifyContent: "center",
  },
  layerCountText: { fontSize: 10.5, fontWeight: "800", color: COLORS.muted },

  // AVISO DE LOCALIZAÇÃO
  locBanner: {
    position: "absolute",
    left: 18,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.goldSoft,
    borderWidth: 1,
    borderColor: COLORS.gold,
    ...SHADOW_FLOAT,
  },
  locBannerText: { flex: 1, fontSize: 12.5, color: COLORS.text, fontWeight: "600" },
  locBannerAction: { fontSize: 13, fontWeight: "800", color: COLORS.primaryDark },

  // FABs
  fabColumn: { position: "absolute", right: 18 },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.line,
    ...SHADOW_FLOAT,
  },

  // FOLHAS
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: COLORS.line,
    paddingHorizontal: 18,
    paddingTop: 10,
    ...SHADOW_UP,
  },
  pickSheet: { borderTopWidth: 3, borderTopColor: COLORS.gold },
  sheetModal: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.line,
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 19, fontWeight: "900", color: COLORS.text },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(22,35,28,0.42)",
    justifyContent: "flex-end",
  },

  badge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pickIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.goldSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 16, fontWeight: "900", color: COLORS.text },
  cardSub: { fontSize: 12.5, color: COLORS.muted, marginTop: 2 },
  closeChip: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.field,
    alignItems: "center",
    justifyContent: "center",
  },

  metricsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  metricBox: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.field,
  },
  metricLabel: { fontSize: 12, fontWeight: "700", color: COLORS.muted },
  metricValue: { fontSize: 15, fontWeight: "900", color: COLORS.text, marginTop: 3 },

  distancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.blueSoft,
    alignSelf: "flex-start",
  },
  distanceText: { fontSize: 12.5, fontWeight: "700", color: COLORS.blue },

  // Botão igual ao "Comprar" do ProductCard
  pillButton: {
    height: 42,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  pillButtonText: { color: "#FFFFFF", fontSize: 13.5, fontWeight: "800" },
  roundAction: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: COLORS.tint,
    alignItems: "center",
    justifyContent: "center",
  },

  listButton: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 42,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    ...SHADOW_FLOAT,
  },

  // LISTA
  listRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  listThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  listThumbImage: { width: "100%", height: "100%" },
  listTitle: { fontSize: 14.5, fontWeight: "900", color: COLORS.text },
  listDistance: { fontSize: 12, fontWeight: "800", color: COLORS.primaryDark },

  // TIMELINE
  stepRow: { flexDirection: "row", paddingBottom: 16, position: "relative" },
  stepLine: {
    position: "absolute",
    left: 15,
    top: 32,
    bottom: 0,
    width: 2,
    backgroundColor: COLORS.line,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    backgroundColor: COLORS.field,
    alignItems: "center",
    justifyContent: "center",
  },
  stepTitle: { fontSize: 14, fontWeight: "800", color: COLORS.text },
  stepDetail: { fontSize: 12.5, color: COLORS.muted, marginTop: 2 },

  progressBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.field,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressValue: { fontSize: 13, fontWeight: "900", color: COLORS.primaryDark },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.line,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3, backgroundColor: COLORS.primary },

  // ESTADOS
  emptyCard: {
    position: "absolute",
    left: 18,
    right: 18,
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.line,
    ...SHADOW_FLOAT,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(249,250,248,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  overlayCard: {
    paddingVertical: 26,
    paddingHorizontal: 32,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: "center",
    ...SHADOW_FLAT,
  },
  overlayTitle: { fontSize: 15, fontWeight: "900", color: COLORS.text, marginTop: 14 },
  overlaySub: { fontSize: 12.5, color: COLORS.muted, marginTop: 4 },
});