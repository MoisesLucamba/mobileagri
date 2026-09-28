import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
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
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";

// Mesmo logo e mesma pasta usados no ecrã de login
const LOGO = require("../../assets/images/Agrilink_SD.png");

const { height: SCREEN_H } = Dimensions.get("window");

/* =====================================================================
   BRANDING — tokens iguais aos do ecrã de login
   ===================================================================== */

const COLORS = {
  // Fundo marfim igual ao perfil; verde original mantido nos botões.
  primary: "#1F6B3A",
  secondary: "#79C267",
  dark: "#465044",
  deep: "#343B32",
  text: "#3D403A",
  muted: "#77796F",
  border: "#E8E5DC",
  field: "#F5F3EC",
  background: "#FBFAF6",
  soft: "#EEF0E9",
  accent: "#E2932F",
  accentSoft: "#F5EEDF",
  blue: "#2F6DB5",
  blueSoft: "#EDF1F5",
  danger: "#B95E54",
};

const SHADOW_UP = {
  shadowColor: COLORS.deep,
  shadowOpacity: 0.15,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: -6 },
  elevation: 12,
};

const SHADOW_SOFT = {
  shadowColor: COLORS.dark,
  shadowOpacity: 0.22,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 5 },
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

type LocStatus = "idle" | "granted" | "denied" | "off";

const LAYERS: { kind: Kind; label: string; emoji: string; color: string }[] = [
  { kind: "produto", label: "Produtos", emoji: "🌿", color: COLORS.primary },
  { kind: "motorista", label: "Motoristas", emoji: "🚚", color: COLORS.blue },
  { kind: "agente", label: "Agentes", emoji: "🎒", color: COLORS.accent },
  { kind: "agricultor", label: "Agricultores", emoji: "🌾", color: COLORS.dark },
];

const LAYER_BY_KIND = Object.fromEntries(
  LAYERS.map((l) => [l.kind, l]),
) as Record<Kind, (typeof LAYERS)[number]>;

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
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #FBFAF6; }
  .leaflet-control-attribution { font-size: 9px; background: rgba(255,255,255,0.75); }
  .al-pin { background: transparent; border: none; }
  .al-tip {
    background:#465044 !important; color:#fff !important; border:none !important;
    font-weight:700 !important; font-size:11px !important; padding:5px 9px !important;
    border-radius:8px !important; box-shadow:0 4px 12px rgba(0,0,0,0.25) !important;
  }
  .al-tip::before { border-top-color:#465044 !important; }
</style>
</head>
<body>
<div id="map"></div>
<script>
(function () {
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

    function pinHtml(color, emoji, selected) {
      var size = selected ? 44 : 36;
      var inner = selected ? 19 : 16;
      return '<div style="width:' + size + 'px;height:' + size + 'px;background:' + color +
        ';border:2.5px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);' +
        'display:flex;align-items:center;justify-content:center;' +
        'box-shadow:0 5px 14px rgba(0,0,0,0.32);">' +
        '<div style="transform:rotate(45deg);font-size:' + inner + 'px;line-height:1;">' + emoji + '</div></div>';
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
            html: pinHtml(item.color, item.emoji, sel),
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
          html: '<div style="width:18px;height:18px;background:#2F6DB5;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>',
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
          var dot = L.circleMarker(coords[0], { radius: 9, fillColor: '#E2932F', fillOpacity: 1, color: '#fff', weight: 3 }).addTo(map);
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
        html: pinHtml('#E2932F', '📍', true),
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
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setLocStatus("denied");
        return;
      }

      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setLocStatus("off");
        return;
      }

      setLocStatus("granted");

      const apply = (pos: Location.LocationObject) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setUserAccuracy(pos.coords.accuracy ?? null);
      };

      // posição rápida primeiro, depois a precisa
      const last = await Location.getLastKnownPositionAsync();
      if (last) apply(last);

      try {
        apply(
          await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
        );
      } catch {
        // o watch abaixo continua a tentar
      }

      watchRef.current?.remove();
      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 15,
          timeInterval: 5000,
        },
        apply,
      );
    } catch (e) {
      console.log("Mapa: erro de localização", e);
      setLocStatus("off");
    }
  }, []);

  useEffect(() => {
    startLocation();
    return () => {
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
        emoji: LAYER_BY_KIND[e.kind].emoji,
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
    } else if (locStatus === "denied" || locStatus === "off") {
      Linking.openSettings().catch(() => {});
    } else {
      startLocation();
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
      ? "Ative a localização para ver a sua posição e as distâncias."
      : locStatus === "off"
        ? "O GPS está desligado. Ligue-o para ver a sua posição."
        : null;

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

      {/* ================= HEADER ================= */}
      <View style={[styles.headerWrap, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.logoWrap}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          </View>

          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Mapa de rastreio
            </Text>
            <Text style={styles.headerSubtitle}>
              {visible.length} elementos no mapa
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.backBtn, pickMode && styles.backBtnActive]}
            onPress={() => setPickMode((c) => !c)}
            activeOpacity={0.8}
          >
            <Ionicons name="location-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.backBtn, { marginLeft: 8 }]}
            onPress={loadEntities}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={19} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={19} color={COLORS.muted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={runSearch}
            placeholder="Pesquisar local em Angola"
            placeholderTextColor="#A3A398"
            returnKeyType="search"
            autoCorrect={false}
          />
          {searching && <ActivityIndicator size="small" color={COLORS.primary} />}
          {!!search && !searching && (
            <TouchableOpacity
              onPress={() => {
                setSearch("");
                setSearchResults([]);
              }}
            >
              <Ionicons name="close-circle" size={19} color={COLORS.muted} />
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
                  <Ionicons name="location-outline" size={16} color={COLORS.primary} />
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
                  active && {
                    backgroundColor: layer.color,
                    borderColor: "rgba(255,255,255,0.7)",
                  },
                ]}
                onPress={() => toggleLayer(layer.kind)}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 13 }}>{layer.emoji}</Text>
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
          style={[styles.locBanner, { top: insets.top + 214 }]}
          onPress={recenter}
          activeOpacity={0.9}
        >
          <Ionicons name="navigate-circle-outline" size={20} color={COLORS.accent} />
          <Text style={styles.locBannerText}>{locBanner}</Text>
          <Text style={styles.locBannerAction}>Ativar</Text>
        </TouchableOpacity>
      )}

      {/* ================= MODO PINO ================= */}
      {pickMode && (
        <View style={[styles.sheet, styles.pickSheet, { paddingBottom: insets.bottom + 18 }]}>
          <View style={styles.sheetHandle} />
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={styles.pickIcon}>
              <Ionicons name="pin-outline" size={20} color={COLORS.accent} />
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
            style={[styles.pillButton, { marginTop: 16 }, !pickedPoint && styles.disabled]}
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
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* ================= FABs ================= */}
      {!pickMode && (
        <View style={[styles.fabColumn, { bottom: fabBottom }]}>
          <TouchableOpacity style={styles.fab} onPress={recenter} activeOpacity={0.85}>
            <Ionicons
              name={userLocation ? "locate" : "locate-outline"}
              size={21}
              color={userLocation ? COLORS.primary : COLORS.muted}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.fab, { marginTop: 10 }]}
            onPress={fitAll}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="arrow-expand-all" size={20} color={COLORS.primary} />
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
              <Text style={{ fontSize: 19 }}>{LAYER_BY_KIND[selected.kind].emoji}</Text>
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
              <Ionicons name="close" size={18} color={COLORS.text} />
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
              <Ionicons name="navigate" size={15} color={COLORS.blue} />
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
              <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
              <Text style={styles.pillButtonText}>Rastrear</Text>
            </TouchableOpacity>

            {!!selected.phone && (
              <TouchableOpacity
                style={styles.roundAction}
                onPress={() => Linking.openURL(`tel:${selected.phone}`)}
                activeOpacity={0.85}
              >
                <Ionicons name="call-outline" size={19} color={COLORS.primary} />
              </TouchableOpacity>
            )}

            {selected.kind === "produto" && (
              <TouchableOpacity
                style={styles.roundAction}
                onPress={() =>
                  router.push({ pathname: "/product", params: { id: selected.rawId } })
                }
                activeOpacity={0.85}
              >
                <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
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
              <Ionicons name="close" size={18} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 16 }}>
            {[
              {
                state: "done",
                icon: "leaf-outline",
                title: "Colhido",
                detail: tracked.harvest_date
                  ? new Date(tracked.harvest_date).toLocaleDateString("pt-AO")
                  : "Data por confirmar",
              },
              {
                state: "done",
                icon: "person-outline",
                title: "Recolhido pelo agente",
                detail: "Local de recolha confirmado",
              },
              {
                state: arrived ? "done" : "active",
                icon: "cube-outline",
                title: "Em trânsito",
                detail: arrived
                  ? "Chegou ao destino"
                  : routeInfo
                    ? `${routeInfo.km} km · ${formatDuration(routeInfo.duration)}`
                    : "A calcular rota...",
              },
              {
                state: arrived ? "active" : "pending",
                icon: "checkmark-circle-outline",
                title: "Entrega",
                detail: arrived ? "A confirmar entrega" : "Por concluir",
              },
            ].map((step, i, all) => (
              <View key={step.title} style={styles.stepRow}>
                {i < all.length - 1 && (
                  <View
                    style={[
                      styles.stepLine,
                      step.state === "done" && { backgroundColor: COLORS.secondary },
                    ]}
                  />
                )}
                <View
                  style={[
                    styles.stepDot,
                    step.state === "done" && {
                      borderColor: COLORS.primary,
                      backgroundColor: COLORS.soft,
                    },
                    step.state === "active" && {
                      borderColor: COLORS.accent,
                      backgroundColor: COLORS.accentSoft,
                    },
                  ]}
                >
                  <Ionicons
                    name={step.icon as any}
                    size={14}
                    color={
                      step.state === "done"
                        ? COLORS.primary
                        : step.state === "active"
                          ? COLORS.accent
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
          <Ionicons name="list" size={19} color="#FFFFFF" />
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
                      <Text style={{ fontSize: 20 }}>{LAYER_BY_KIND[item.kind].emoji}</Text>
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
            <Ionicons name="cloud-offline-outline" size={34} color={COLORS.danger} />
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
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.overlayCard}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.overlayTitle}>A carregar mapa</Text>
            <Text style={styles.overlaySub}>Aguarde um momento...</Text>
          </View>
        </View>
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
  rowDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  disabled: { opacity: 0.55 },

  // HEADER
  headerWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 14,
    shadowColor: COLORS.deep,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  header: {
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  backBtnActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  logoWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginLeft: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: `${COLORS.secondary}88`,
  },
  logo: { width: 28, height: 28 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  headerSubtitle: { fontSize: 11.5, color: COLORS.muted, marginTop: 1 },

  // PESQUISA
  searchBox: {
    marginHorizontal: 16,
    marginTop: 10,
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.field,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text, padding: 0 },
  searchResults: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  searchRow: { flexDirection: "row", alignItems: "center", padding: 12, gap: 10 },
  searchIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  searchTitle: { fontSize: 13.5, fontWeight: "800", color: COLORS.text },
  searchSub: { fontSize: 11.5, color: COLORS.muted, marginTop: 2 },

  // CAMADAS
  layerRow: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  layerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  layerText: { fontSize: 12.5, fontWeight: "700", color: COLORS.text },
  layerCount: {
    minWidth: 20,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: COLORS.field,
    alignItems: "center",
    justifyContent: "center",
  },
  layerCountText: { fontSize: 10.5, fontWeight: "800", color: COLORS.muted },

  // AVISO DE LOCALIZAÇÃO
  locBanner: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    ...SHADOW_SOFT,
  },
  locBannerText: { flex: 1, fontSize: 12.5, color: COLORS.text, fontWeight: "600" },
  locBannerAction: { fontSize: 13, fontWeight: "800", color: COLORS.primary },

  // FABs
  fabColumn: { position: "absolute", right: 16 },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOW_SOFT,
  },

  // FOLHAS (mesma linguagem do painel do login)
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 22,
    paddingTop: 12,
    ...SHADOW_UP,
  },
  pickSheet: { borderTopWidth: 3, borderTopColor: COLORS.accent },
  sheetModal: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 22, fontWeight: "800", color: COLORS.text },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(52,59,50,0.42)",
    justifyContent: "flex-end",
  },

  badge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: `${COLORS.secondary}55`,
  },
  pickIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 17, fontWeight: "800", color: COLORS.text },
  cardSub: { fontSize: 12.5, color: COLORS.muted, marginTop: 2 },
  closeChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.field,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },

  metricsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  metricBox: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    backgroundColor: COLORS.field,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  metricLabel: { fontSize: 12, fontWeight: "700", color: COLORS.muted },
  metricValue: { fontSize: 16, fontWeight: "800", color: COLORS.text, marginTop: 3 },

  distancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: COLORS.blueSoft,
    alignSelf: "flex-start",
  },
  distanceText: { fontSize: 12.5, fontWeight: "700", color: COLORS.blue },

  pillButton: {
    height: 54,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...SHADOW_SOFT,
  },
  pillButtonText: { color: "#FFFFFF", fontSize: 15.5, fontWeight: "800" },
  roundAction: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },

  listButton: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 52,
    paddingHorizontal: 26,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    ...SHADOW_SOFT,
  },

  // LISTA
  listRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  listThumb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  listThumbImage: { width: "100%", height: "100%" },
  listTitle: { fontSize: 14.5, fontWeight: "800", color: COLORS.text },
  listDistance: { fontSize: 12, fontWeight: "700", color: COLORS.primary },

  // TIMELINE
  stepRow: { flexDirection: "row", paddingBottom: 16, position: "relative" },
  stepLine: {
    position: "absolute",
    left: 15,
    top: 32,
    bottom: 0,
    width: 2,
    backgroundColor: COLORS.border,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.field,
    alignItems: "center",
    justifyContent: "center",
  },
  stepTitle: { fontSize: 14, fontWeight: "800", color: COLORS.text },
  stepDetail: { fontSize: 12.5, color: COLORS.muted, marginTop: 2 },

  progressBox: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: COLORS.field,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressValue: { fontSize: 13, fontWeight: "800", color: COLORS.primary },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.border,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 4, backgroundColor: COLORS.primary },

  // ESTADOS
  emptyCard: {
    position: "absolute",
    left: 16,
    right: 16,
    padding: 16,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOW_SOFT,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(251,250,246,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  overlayCard: {
    paddingVertical: 28,
    paddingHorizontal: 34,
    borderRadius: 28,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    ...SHADOW_UP,
  },
  overlayTitle: { fontSize: 15, fontWeight: "800", color: COLORS.text, marginTop: 14 },
  overlaySub: { fontSize: 12.5, color: COLORS.muted, marginTop: 4 },
});
