import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";

const { height: SCREEN_H } = Dimensions.get("window");

/* =====================================================================
   DESIGN TOKENS — alinhados com o HomeScreen da app
   ===================================================================== */

const COLORS = {
  primary: "#1F6B3A",
  primaryDark: "#123C22",
  primarySoft: "#EAF3EA",
  primaryLight: "#D9EEDD",

  accent: "#E2932F",
  accentDark: "#B9741A",
  accentSoft: "#FBEBD3",

  text: "#16231C",
  muted: "#78877D",
  faint: "#AEB8AC",

  canvas: "#FAF8F3",
  surface: "#FFFFFF",
  border: "#EAE4D6",

  red: "#DD5138",
  blue: "#4C7EDB",
  blueSoft: "#E8EFFB",
};

const RADIUS = { sm: 10, md: 14, lg: 19, xl: 26 };

const SHADOW = {
  card: {
    shadowColor: "#16231C",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  float: {
    shadowColor: "#16231C",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
};

/* =====================================================================
   TIPOS
   ===================================================================== */

type Kind = "produto" | "motorista" | "agente" | "agricultor";

type Entity = {
  id: string;
  kind: Kind;
  title: string;
  subtitle?: string;
  lat: number;
  lng: number;
  price?: number;
  quantity?: number;
  unit?: string;
  phone?: string;
  email?: string;
  image_url?: string;
  status?: string;
  harvest_date?: string;
  updated_at?: string;
};

type LatLng = { lat: number; lng: number };

type RouteResult = {
  coords: [number, number][];
  distance: number | null;
  duration: number | null;
};

const LAYERS: {
  kind: Kind;
  label: string;
  emoji: string;
  color: string;
  icon: string;
}[] = [
  {
    kind: "produto",
    label: "Produtos",
    emoji: "🌿",
    color: COLORS.primary,
    icon: "leaf-outline",
  },
  {
    kind: "motorista",
    label: "Motoristas",
    emoji: "🚚",
    color: COLORS.blue,
    icon: "car-outline",
  },
  {
    kind: "agente",
    label: "Agentes",
    emoji: "🎒",
    color: COLORS.accent,
    icon: "person-outline",
  },
  {
    kind: "agricultor",
    label: "Agricultores",
    emoji: "🌾",
    color: COLORS.primaryDark,
    icon: "people-outline",
  },
];

const LAYER_BY_KIND = Object.fromEntries(
  LAYERS.map((layer) => [layer.kind, layer]),
) as Record<Kind, (typeof LAYERS)[number]>;

/* =====================================================================
   HELPERS — distância, OSRM, formatação
   ===================================================================== */

function distanceKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
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

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    const data = await response.json();
    const route = data?.routes?.[0];

    if (data?.code === "Ok" && route?.geometry?.coordinates?.length) {
      const coords = route.geometry.coordinates.map(
        ([lng, lat]: [number, number]) => [lat, lng] as [number, number],
      );
      return {
        coords,
        distance: route.distance ?? null,
        duration: route.duration ?? null,
      };
    }
  } catch {
    // silêncio: caímos na linha reta
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

/* =====================================================================
   HTML DO MAPA — Leaflet dentro do WebView
   Gratuito, sem chave de API. Comunica por postMessage.
   ===================================================================== */

const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #FAF8F3; }
  .leaflet-control-attribution { font-size: 9px; background: rgba(255,255,255,0.75); }
  .al-pin { display:flex; align-items:center; justify-content:center; }
  .al-tip {
    background:#16231C !important; color:#fff !important; border:none !important;
    font-weight:700 !important; font-size:11px !important; padding:5px 9px !important;
    border-radius:8px !important; box-shadow:0 4px 12px rgba(0,0,0,0.25) !important;
  }
  .al-tip::before { border-top-color:#16231C !important; }
</style>
</head>
<body>
<div id="map"></div>
<script>
(function () {
  var map = L.map('map', { zoomControl: false, attributionControl: true })
    .setView([-11.2, 17.8], 5);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap &middot; &copy; CARTO'
  }).addTo(map);

  var markers = {};
  var userMarker = null;
  var userHalo = null;
  var routeLayers = [];
  var movingDot = null;
  var animTimer = null;
  var pickMode = false;
  var pickMarker = null;

  function post(type, payload) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload }));
    }
  }

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
    routeLayers.forEach(function (layer) { try { map.removeLayer(layer); } catch (e) {} });
    routeLayers = [];
    if (animTimer) { clearInterval(animTimer); animTimer = null; }
    movingDot = null;
  }

  var API = {
    setEntities: function (list, selectedId) {
      Object.keys(markers).forEach(function (id) {
        try { map.removeLayer(markers[id]); } catch (e) {}
      });
      markers = {};

      list.forEach(function (item) {
        var selected = item.id === selectedId;
        var icon = L.divIcon({
          className: 'al-pin',
          html: pinHtml(item.color, item.emoji, selected),
          iconSize: selected ? [44, 44] : [36, 36],
          iconAnchor: selected ? [22, 44] : [18, 36]
        });
        var marker = L.marker([item.lat, item.lng], { icon: icon, zIndexOffset: selected ? 1000 : 0 })
          .addTo(map)
          .on('click', function () { post('select', { id: item.id }); });
        marker.bindTooltip(item.title, { direction: 'top', offset: [0, -34], className: 'al-tip' });
        markers[item.id] = marker;
      });
    },

    setUser: function (lat, lng) {
      if (userMarker) { try { map.removeLayer(userMarker); } catch (e) {} }
      if (userHalo) { try { map.removeLayer(userHalo); } catch (e) {} }
      userHalo = L.circleMarker([lat, lng], {
        radius: 18, color: '#4C7EDB', weight: 0, fillColor: '#4C7EDB', fillOpacity: 0.14
      }).addTo(map);
      var icon = L.divIcon({
        className: '',
        html: '<div style="width:18px;height:18px;background:#4C7EDB;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>',
        iconSize: [18, 18], iconAnchor: [9, 9]
      });
      userMarker = L.marker([lat, lng], { icon: icon }).addTo(map);
    },

    flyTo: function (lat, lng, zoom) {
      map.flyTo([lat, lng], zoom || 14, { duration: 1.1 });
    },

    fitAll: function (points) {
      if (!points || !points.length) return;
      map.fitBounds(L.latLngBounds(points), { padding: [70, 70] });
    },

    drawRoute: function (coords, color, animate) {
      clearRoute();
      if (!coords || coords.length < 2) return;

      var glow = L.polyline(coords, { color: color, weight: 9, opacity: 0.16 }).addTo(map);
      var line = L.polyline(coords, { color: color, weight: 3.5, opacity: 0.9, dashArray: '10 7' }).addTo(map);
      routeLayers.push(glow, line);

      var origin = L.circleMarker(coords[0], {
        radius: 7, fillColor: '#fff', fillOpacity: 1, color: color, weight: 4
      }).addTo(map);
      var dest = L.circleMarker(coords[coords.length - 1], {
        radius: 7, fillColor: color, fillOpacity: 1, color: '#fff', weight: 3
      }).addTo(map);
      routeLayers.push(origin, dest);

      map.fitBounds(L.latLngBounds(coords), { padding: [80, 160] });

      if (animate) {
        movingDot = L.circleMarker(coords[0], {
          radius: 9, fillColor: '#E2932F', fillOpacity: 1, color: '#fff', weight: 3
        }).addTo(map);
        routeLayers.push(movingDot);

        var idx = 0, t = 0;
        animTimer = setInterval(function () {
          if (idx >= coords.length - 1) { idx = 0; t = 0; }
          var from = coords[idx], to = coords[idx + 1];
          if (from && to) {
            t += 0.06;
            if (t >= 1) { t = 0; idx++; }
            movingDot.setLatLng([
              from[0] + (to[0] - from[0]) * t,
              from[1] + (to[1] - from[1]) * t
            ]);
          }
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

  map.on('click', function (event) {
    if (!pickMode) return;
    var lat = event.latlng.lat, lng = event.latlng.lng;
    if (pickMarker) { try { map.removeLayer(pickMarker); } catch (e) {} }
    var icon = L.divIcon({
      className: 'al-pin',
      html: pinHtml('#E2932F', '📍', true),
      iconSize: [44, 44], iconAnchor: [22, 44]
    });
    pickMarker = L.marker([lat, lng], { icon: icon }).addTo(map);
    post('pick', { lat: lat, lng: lng });
  });

  window.AL = function (raw) {
    try {
      var msg = JSON.parse(raw);
      if (API[msg.fn]) API[msg.fn].apply(null, msg.args || []);
    } catch (e) {
      post('error', { message: String(e) });
    }
  };

  document.addEventListener('message', function (e) { window.AL(e.data); });
  window.addEventListener('message', function (e) { window.AL(e.data); });

  post('ready', {});
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

  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const [entities, setEntities] = useState<Entity[]>([]);
  const [activeKinds, setActiveKinds] = useState<Kind[]>([
    "produto",
    "motorista",
    "agente",
    "agricultor",
  ]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const [listOpen, setListOpen] = useState(false);
  const [tracked, setTracked] = useState<Entity | null>(null);
  const [routeInfo, setRouteInfo] = useState<{
    km: number;
    duration: number | null;
  } | null>(null);

  const [pickMode, setPickMode] = useState(false);
  const [pickedPoint, setPickedPoint] = useState<LatLng | null>(null);

  const selected = useMemo(
    () => entities.find((item) => item.id === selectedId) || null,
    [entities, selectedId],
  );

  const visible = useMemo(
    () => entities.filter((item) => activeKinds.includes(item.kind)),
    [entities, activeKinds],
  );

  /* ---------------------------------------------------------------
     Ponte para o WebView
     --------------------------------------------------------------- */

  const call = useCallback((fn: string, ...args: any[]) => {
    webRef.current?.injectJavaScript(
      `window.AL(${JSON.stringify(JSON.stringify({ fn, args }))}); true;`,
    );
  }, []);

  /* ---------------------------------------------------------------
     Carregar dados do Supabase
     --------------------------------------------------------------- */

  const loadEntities = useCallback(async () => {
    setLoading(true);
    const collected: Entity[] = [];

    // Produtos (tabela que já existe)
    try {
      const { data } = await supabase
        .from("products")
        .select("*")
        .limit(200);

      (data || []).forEach((row: any) => {
        if (row.location_lat == null || row.location_lng == null) return;
        collected.push({
          id: `produto:${row.id}`,
          kind: "produto",
          title: row.product_type || row.name || row.title || "Produto",
          subtitle: row.farmer_name || row.municipality_id,
          lat: Number(row.location_lat),
          lng: Number(row.location_lng),
          price: row.price,
          quantity: row.quantity,
          unit: "kg",
          phone: row.farmer_phone,
          email: row.farmer_email,
          image_url: row.image_url,
          status: row.status,
          harvest_date: row.harvest_date,
        });
      });
    } catch {
      // ignorar
    }

    // Camadas de logística — opcionais: se a tabela não existir, saltamos
    const fleet: { table: string; kind: Kind; titleField: string }[] = [
      { table: "drivers", kind: "motorista", titleField: "name" },
      { table: "field_agents", kind: "agente", titleField: "name" },
      { table: "farmers", kind: "agricultor", titleField: "name" },
    ];

    for (const source of fleet) {
      try {
        const { data, error } = await supabase
          .from(source.table)
          .select("*")
          .limit(200);

        if (error) continue;

        (data || []).forEach((row: any) => {
          const lat = row.location_lat ?? row.lat ?? row.latitude;
          const lng = row.location_lng ?? row.lng ?? row.longitude;
          if (lat == null || lng == null) return;

          collected.push({
            id: `${source.kind}:${row.id}`,
            kind: source.kind,
            title: row[source.titleField] || row.full_name || "Sem nome",
            subtitle: row.vehicle || row.municipality_id || row.phone,
            lat: Number(lat),
            lng: Number(lng),
            phone: row.phone,
            email: row.email,
            status: row.status,
            updated_at: row.updated_at,
          });
        });
      } catch {
        // tabela ainda não existe — segue
      }
    }

    setEntities(collected);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadEntities();
  }, [loadEntities]);

  /* ---------------------------------------------------------------
     Realtime — posições que se movem (motoristas e agentes)
     --------------------------------------------------------------- */

  useEffect(() => {
    const channel = supabase
      .channel("agrilink-mapa")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drivers" },
        (payload: any) => {
          const row = payload.new;
          if (!row) return;
          const lat = row.location_lat ?? row.lat ?? row.latitude;
          const lng = row.location_lng ?? row.lng ?? row.longitude;
          if (lat == null || lng == null) return;

          setEntities((current) => {
            const id = `motorista:${row.id}`;
            const next = [...current];
            const index = next.findIndex((item) => item.id === id);
            const entity: Entity = {
              id,
              kind: "motorista",
              title: row.name || "Motorista",
              subtitle: row.vehicle || row.phone,
              lat: Number(lat),
              lng: Number(lng),
              phone: row.phone,
              status: row.status,
              updated_at: row.updated_at,
            };
            if (index >= 0) next[index] = entity;
            else next.push(entity);
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* ---------------------------------------------------------------
     Localização do utilizador
     --------------------------------------------------------------- */

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setUserLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    })();
  }, []);

  /* ---------------------------------------------------------------
     Sincronizar estado -> mapa
     --------------------------------------------------------------- */

  useEffect(() => {
    if (!mapReady) return;

    call(
      "setEntities",
      visible.map((item) => ({
        id: item.id,
        lat: item.lat,
        lng: item.lng,
        title: item.title,
        emoji: LAYER_BY_KIND[item.kind].emoji,
        color: LAYER_BY_KIND[item.kind].color,
      })),
      selectedId,
    );
  }, [mapReady, visible, selectedId, call]);

  useEffect(() => {
    if (!mapReady || !userLocation) return;
    call("setUser", userLocation.lat, userLocation.lng);
    call("flyTo", userLocation.lat, userLocation.lng, 11);
  }, [mapReady, userLocation, call]);

  useEffect(() => {
    if (!mapReady) return;
    call("setPickMode", pickMode);
    if (!pickMode) setPickedPoint(null);
  }, [mapReady, pickMode, call]);

  /* ---------------------------------------------------------------
     Rota — utilizador até ao elemento selecionado
     --------------------------------------------------------------- */

  const drawRouteTo = useCallback(
    async (entity: Entity, animate: boolean) => {
      if (!userLocation) return;

      const route = await fetchRoadRoute(userLocation, {
        lat: entity.lat,
        lng: entity.lng,
      });

      const km =
        route.distance != null
          ? route.distance / 1000
          : distanceKm(userLocation, { lat: entity.lat, lng: entity.lng });

      setRouteInfo({ km: Math.round(km * 10) / 10, duration: route.duration });

      call(
        "drawRoute",
        route.coords,
        animate ? COLORS.primary : COLORS.blue,
        animate,
      );
    },
    [userLocation, call],
  );

  /* ---------------------------------------------------------------
     Mensagens vindas do WebView
     --------------------------------------------------------------- */

  const onMessage = useCallback(
    (event: any) => {
      let message: any;
      try {
        message = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }

      if (message.type === "ready") {
        setMapReady(true);
        return;
      }

      if (message.type === "select") {
        setSelectedId(message.payload.id);
        setListOpen(false);
        return;
      }

      if (message.type === "pick") {
        setPickedPoint(message.payload);
      }
    },
    [],
  );

  /* ---------------------------------------------------------------
     Pesquisa de locais (Nominatim, gratuito)
     --------------------------------------------------------------- */

  const runSearch = useCallback(async (value: string) => {
    setSearch(value);

    if (!value.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const url =
        "https://nominatim.openstreetmap.org/search?format=json&limit=5" +
        "&countrycodes=ao&q=" +
        encodeURIComponent(value);

      const response = await fetch(url, {
        headers: {
          "Accept-Language": "pt",
          "User-Agent": "AgriLink/1.0 (app mobile)",
        },
      });

      setSearchResults(await response.json());
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  /* ---------------------------------------------------------------
     Ações
     --------------------------------------------------------------- */

  const toggleLayer = (kind: Kind) => {
    setActiveKinds((current) =>
      current.includes(kind)
        ? current.filter((item) => item !== kind)
        : [...current, kind],
    );
  };

  const selectEntity = (entity: Entity) => {
    setSelectedId(entity.id);
    setListOpen(false);
    call("flyTo", entity.lat, entity.lng, 14);
    drawRouteTo(entity, false);
  };

  const closeSelection = () => {
    setSelectedId(null);
    setRouteInfo(null);
    call("clearRoute");
  };

  const startTracking = (entity: Entity) => {
    setTracked(entity);
    drawRouteTo(entity, true);
  };

  const recenter = () => {
    if (userLocation) {
      call("flyTo", userLocation.lat, userLocation.lng, 13);
    } else {
      call(
        "fitAll",
        visible.map((item) => [item.lat, item.lng]),
      );
    }
  };

  const distanceLabel = (entity: Entity) => {
    if (!userLocation) return null;
    if (selectedId === entity.id && routeInfo) {
      return `${routeInfo.km} km · ${formatDuration(routeInfo.duration)}`;
    }
    const km = distanceKm(userLocation, { lat: entity.lat, lng: entity.lng });
    return `${Math.round(km)} km`;
  };

  /* ---------------------------------------------------------------
     RENDER
     --------------------------------------------------------------- */

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />

      <WebView
        ref={webRef}
        source={{ html: MAP_HTML, baseUrl: "https://agrilink.local" }}
        originWhitelist={["*"]}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        style={styles.web}
        androidLayerType={Platform.OS === "android" ? "hardware" : undefined}
        setSupportMultipleWindows={false}
      />

      {/* ============================================================
          HEADER
      ============================================================= */}

      <SafeAreaView style={[styles.headerWrap, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.roundButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={19} color={COLORS.text} />
          </TouchableOpacity>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Mapa de rastreio</Text>
            <Text style={styles.headerSubtitle}>
              {visible.length} elementos ativos
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.roundButton, pickMode && styles.roundButtonActive]}
            onPress={() => setPickMode((current) => !current)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="location-outline"
              size={19}
              color={pickMode ? "#FFFFFF" : COLORS.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roundButton, { marginLeft: 8 }]}
            onPress={loadEntities}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={19} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* PESQUISA */}

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={17} color={COLORS.muted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={runSearch}
            placeholder="Pesquisar local em Angola..."
            placeholderTextColor={COLORS.muted}
            returnKeyType="search"
          />
          {searching && <ActivityIndicator size="small" color={COLORS.primary} />}
          {!!search && !searching && (
            <TouchableOpacity
              onPress={() => {
                setSearch("");
                setSearchResults([]);
              }}
            >
              <Ionicons name="close-circle" size={18} color={COLORS.faint} />
            </TouchableOpacity>
          )}
        </View>

        {searchResults.length > 0 && (
          <View style={styles.searchResults}>
            {searchResults.map((result, index) => (
              <TouchableOpacity
                key={result.place_id || index}
                style={[
                  styles.searchResultRow,
                  index < searchResults.length - 1 && styles.rowDivider,
                ]}
                onPress={() => {
                  call(
                    "flyTo",
                    parseFloat(result.lat),
                    parseFloat(result.lon),
                    12,
                  );
                  setSearch("");
                  setSearchResults([]);
                }}
              >
                <View style={styles.searchResultIcon}>
                  <Ionicons
                    name="location-outline"
                    size={15}
                    color={COLORS.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.searchResultTitle} numberOfLines={1}>
                    {String(result.display_name).split(",")[0]}
                  </Text>
                  <Text style={styles.searchResultSub} numberOfLines={1}>
                    {result.display_name}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* CAMADAS */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.layerRow}
        >
          {LAYERS.map((layer) => {
            const active = activeKinds.includes(layer.kind);
            const count = entities.filter(
              (item) => item.kind === layer.kind,
            ).length;

            return (
              <TouchableOpacity
                key={layer.kind}
                style={[
                  styles.layerChip,
                  active && {
                    backgroundColor: layer.color,
                    borderColor: layer.color,
                  },
                ]}
                onPress={() => toggleLayer(layer.kind)}
                activeOpacity={0.85}
              >
                <Text style={styles.layerEmoji}>{layer.emoji}</Text>
                <Text
                  style={[styles.layerText, active && styles.layerTextActive]}
                >
                  {layer.label}
                </Text>
                <View
                  style={[
                    styles.layerCount,
                    active && { backgroundColor: "rgba(255,255,255,0.25)" },
                  ]}
                >
                  <Text
                    style={[
                      styles.layerCountText,
                      active && { color: "#FFFFFF" },
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>

      {/* ============================================================
          MODO PINO — barra de confirmação
      ============================================================= */}

      {pickMode && (
        <View style={[styles.pickBar, { bottom: insets.bottom + 26 }]}>
          <Ionicons name="pin-outline" size={18} color={COLORS.accentDark} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.pickTitle}>
              {pickedPoint ? "Local selecionado" : "Toque no mapa"}
            </Text>
            <Text style={styles.pickCoords}>
              {pickedPoint
                ? `${pickedPoint.lat.toFixed(5)}, ${pickedPoint.lng.toFixed(5)}`
                : "Escolha o ponto de recolha ou entrega"}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.pickConfirm,
              !pickedPoint && { backgroundColor: COLORS.faint },
            ]}
            disabled={!pickedPoint}
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
            <Text style={styles.pickConfirmText}>Usar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ============================================================
          BOTÕES FLUTUANTES
      ============================================================= */}

      {!pickMode && (
        <View style={[styles.fabColumn, { bottom: insets.bottom + 120 }]}>
          <TouchableOpacity
            style={styles.fab}
            onPress={recenter}
            activeOpacity={0.85}
          >
            <Ionicons name="locate" size={20} color={COLORS.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.fab, { marginTop: 10 }]}
            onPress={() =>
              call(
                "fitAll",
                visible.map((item) => [item.lat, item.lng]),
              )
            }
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name="arrow-expand-all"
              size={19}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* ============================================================
          CARTÃO DO ELEMENTO SELECIONADO
      ============================================================= */}

      {selected && !pickMode && (
        <View style={[styles.selectedCard, { bottom: insets.bottom + 18 }]}>
          <View style={styles.selectedHeader}>
            <View
              style={[
                styles.selectedBadge,
                { backgroundColor: LAYER_BY_KIND[selected.kind].color },
              ]}
            >
              <Text style={{ fontSize: 17 }}>
                {LAYER_BY_KIND[selected.kind].emoji}
              </Text>
            </View>

            <View style={{ flex: 1, marginLeft: 11 }}>
              <Text style={styles.selectedTitle} numberOfLines={1}>
                {selected.title}
              </Text>
              <Text style={styles.selectedSub} numberOfLines={1}>
                {LAYER_BY_KIND[selected.kind].label.replace(/s$/, "")}
                {selected.subtitle ? ` · ${selected.subtitle}` : ""}
              </Text>
            </View>

            <TouchableOpacity style={styles.closeChip} onPress={closeSelection}>
              <Ionicons name="close" size={17} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {selected.kind === "produto" && (
            <View style={styles.metricsRow}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Preço</Text>
                <Text style={styles.metricValue}>
                  {formatKz(selected.price)}
                </Text>
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
              <Ionicons name="navigate" size={14} color={COLORS.blue} />
              <Text style={styles.distanceText}>
                A {distanceLabel(selected)} de si
              </Text>
            </View>
          )}

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.primaryAction}
              onPress={() => startTracking(selected)}
              activeOpacity={0.85}
            >
              <Ionicons name="navigate-outline" size={17} color="#FFFFFF" />
              <Text style={styles.primaryActionText}>Rastrear</Text>
            </TouchableOpacity>

            {!!selected.phone && (
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={() => Linking.openURL(`tel:${selected.phone}`)}
                activeOpacity={0.85}
              >
                <Ionicons name="call-outline" size={17} color={COLORS.primary} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() =>
                router.push({
                  pathname: "/product",
                  params: { id: selected.id.split(":")[1] },
                })
              }
              activeOpacity={0.85}
            >
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ============================================================
          BOTÃO DA LISTA
      ============================================================= */}

      {!selected && !pickMode && (
        <TouchableOpacity
          style={[styles.listButton, { bottom: insets.bottom + 22 }]}
          onPress={() => setListOpen(true)}
          activeOpacity={0.9}
        >
          <Ionicons name="list" size={18} color="#FFFFFF" />
          <Text style={styles.listButtonText}>
            Ver lista ({visible.length})
          </Text>
        </TouchableOpacity>
      )}

      {/* ============================================================
          FOLHA DA LISTA
      ============================================================= */}

      <Modal
        visible={listOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setListOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setListOpen(false)}
        >
          <Pressable
            style={styles.sheet}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>No mapa</Text>
            <Text style={styles.sheetSubtitle}>
              Toque para centrar e traçar a rota
            </Text>

            <FlatList
              data={visible}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: SCREEN_H * 0.5 }}
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
                      {
                        backgroundColor: LAYER_BY_KIND[item.kind].color + "22",
                      },
                    ]}
                  >
                    {item.image_url ? (
                      <Image
                        source={{ uri: item.image_url }}
                        style={styles.listThumbImage}
                      />
                    ) : (
                      <Text style={{ fontSize: 20 }}>
                        {LAYER_BY_KIND[item.kind].emoji}
                      </Text>
                    )}
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.listTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.listSub} numberOfLines={1}>
                      {item.kind === "produto" && item.price
                        ? `${formatKz(item.price)} · `
                        : ""}
                      {item.subtitle || LAYER_BY_KIND[item.kind].label}
                    </Text>
                  </View>

                  {!!distanceLabel(item) && (
                    <Text style={styles.listDistance}>
                      {distanceLabel(item)}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>
                    Nenhum elemento nas camadas ativas.
                  </Text>
                </View>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* ============================================================
          FOLHA DE RASTREABILIDADE
      ============================================================= */}

      <Modal
        visible={!!tracked}
        transparent
        animationType="slide"
        onRequestClose={() => setTracked(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setTracked(null)}
        >
          <Pressable
            style={styles.sheet}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Rastreabilidade</Text>
                <Text style={styles.sheetSubtitle}>{tracked?.title}</Text>
              </View>
              <TouchableOpacity
                style={styles.closeChip}
                onPress={() => setTracked(null)}
              >
                <Ionicons name="close" size={17} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {[
              {
                state: "done",
                icon: "leaf-outline",
                title: "Colhido",
                detail: tracked?.harvest_date
                  ? new Date(tracked.harvest_date).toLocaleDateString("pt-AO")
                  : "Data por confirmar",
                sub: tracked?.subtitle || "Origem",
              },
              {
                state: "done",
                icon: "person-outline",
                title: "Recolhido pelo agente",
                detail: "Local de recolha confirmado",
                sub: "Agente de campo",
              },
              {
                state: "active",
                icon: "cube-outline",
                title: "Em trânsito",
                detail: routeInfo
                  ? `${routeInfo.km} km · ${formatDuration(routeInfo.duration)}`
                  : "A calcular rota...",
                sub: "A caminho do destino",
              },
              {
                state: "pending",
                icon: "checkmark-circle-outline",
                title: "Entrega prevista",
                detail: "Próximas 24h",
                sub: "Destino final",
              },
            ].map((step, index, all) => (
              <View key={step.title} style={styles.stepRow}>
                {index < all.length - 1 && (
                  <View
                    style={[
                      styles.stepLine,
                      step.state === "done" && {
                        backgroundColor: COLORS.primaryLight,
                      },
                    ]}
                  />
                )}

                <View
                  style={[
                    styles.stepDot,
                    step.state === "done" && {
                      borderColor: COLORS.primary,
                      backgroundColor: COLORS.primarySoft,
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
                          ? COLORS.accentDark
                          : COLORS.faint
                    }
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDetail}>{step.detail}</Text>
                  <Text style={styles.stepSub}>{step.sub}</Text>
                </View>
              </View>
            ))}

            <View style={styles.progressBox}>
              <View style={styles.progressHeader}>
                <Text style={styles.metricLabel}>Progresso da rota</Text>
                <Text style={styles.progressValue}>60%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={styles.progressFill} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ============================================================
          LOADING
      ============================================================= */}

      {(loading || !mapReady) && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingTitle}>A carregar mapa</Text>
            <Text style={styles.loadingSub}>Aguarde um momento...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

/* =====================================================================
   STYLES
   ===================================================================== */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.canvas },
  web: { flex: 1, backgroundColor: COLORS.canvas },

  // HEADER

  headerWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(250,248,243,0.94)",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 10,
  },

  header: {
    height: 54,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  roundButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  roundButtonActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },

  headerTitle: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  headerSubtitle: { fontSize: 11, color: COLORS.muted, marginTop: 1 },

  // SEARCH

  searchBox: {
    marginHorizontal: 14,
    height: 46,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 9,
    ...SHADOW.card,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    padding: 0,
  },

  searchResults: {
    marginHorizontal: 14,
    marginTop: 8,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    ...SHADOW.float,
  },

  searchResultRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
  },

  searchResultIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  searchResultTitle: { fontSize: 13, fontWeight: "800", color: COLORS.text },
  searchResultSub: { fontSize: 11, color: COLORS.muted, marginTop: 2 },

  rowDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.border },

  // CAMADAS

  layerRow: { paddingHorizontal: 14, paddingTop: 10, gap: 8 },

  layerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  layerEmoji: { fontSize: 13 },
  layerText: { fontSize: 12, fontWeight: "700", color: COLORS.text },
  layerTextActive: { color: "#FFFFFF" },

  layerCount: {
    minWidth: 20,
    paddingHorizontal: 5,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.canvas,
    alignItems: "center",
    justifyContent: "center",
  },

  layerCountText: { fontSize: 10, fontWeight: "800", color: COLORS.muted },

  // FABS

  fabColumn: { position: "absolute", right: 14 },

  fab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.float,
  },

  // MODO PINO

  pickBar: {
    position: "absolute",
    left: 14,
    right: 14,
    minHeight: 64,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.accent,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    ...SHADOW.float,
  },

  pickTitle: { fontSize: 13, fontWeight: "800", color: COLORS.text },
  pickCoords: { fontSize: 11, color: COLORS.muted, marginTop: 2 },

  pickConfirm: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  pickConfirmText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },

  // CARTÃO SELECIONADO

  selectedCard: {
    position: "absolute",
    left: 14,
    right: 14,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
    ...SHADOW.float,
  },

  selectedHeader: { flexDirection: "row", alignItems: "center" },

  selectedBadge: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },

  selectedTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  selectedSub: { fontSize: 11, color: COLORS.muted, marginTop: 2 },

  closeChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.canvas,
    alignItems: "center",
    justifyContent: "center",
  },

  metricsRow: { flexDirection: "row", gap: 9, marginTop: 13 },

  metricBox: {
    flex: 1,
    padding: 11,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
  },

  metricLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  metricValue: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
    marginTop: 3,
  },

  distancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 11,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.blueSoft,
  },

  distanceText: { fontSize: 12, fontWeight: "700", color: COLORS.blue },

  actionRow: { flexDirection: "row", gap: 9, marginTop: 13 },

  primaryAction: {
    flex: 1,
    height: 46,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  primaryActionText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },

  secondaryAction: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  // BOTÃO DA LISTA

  listButton: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    ...SHADOW.float,
  },

  listButtonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },

  // FOLHAS

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,20,17,0.5)",
    justifyContent: "flex-end",
  },

  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 13,
    paddingBottom: 32,
  },

  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginBottom: 18,
  },

  sheetHeaderRow: { flexDirection: "row", alignItems: "center" },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: COLORS.text },
  sheetSubtitle: { fontSize: 12, color: COLORS.muted, marginTop: 4 },

  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },

  listThumb: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  listThumbImage: { width: "100%", height: "100%" },

  listTitle: { fontSize: 14, fontWeight: "800", color: COLORS.text },
  listSub: { fontSize: 11, color: COLORS.muted, marginTop: 3 },
  listDistance: { fontSize: 11, fontWeight: "700", color: COLORS.primary },

  emptyBox: { paddingVertical: 40, alignItems: "center" },
  emptyText: { fontSize: 13, color: COLORS.muted },

  // TIMELINE

  stepRow: { flexDirection: "row", paddingBottom: 18, position: "relative" },

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
    backgroundColor: COLORS.canvas,
    alignItems: "center",
    justifyContent: "center",
  },

  stepTitle: { fontSize: 13, fontWeight: "800", color: COLORS.text },
  stepDetail: { fontSize: 12, color: COLORS.muted, marginTop: 3 },
  stepSub: { fontSize: 11, color: COLORS.faint, marginTop: 2 },

  progressBox: {
    marginTop: 6,
    padding: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primarySoft,
  },

  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  progressValue: { fontSize: 12, fontWeight: "800", color: COLORS.primary },

  progressTrack: {
    height: 6,
    borderRadius: 4,
    backgroundColor: COLORS.primaryLight,
    overflow: "hidden",
  },

  progressFill: {
    width: "60%",
    height: "100%",
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },

  // LOADING

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(250,248,243,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingCard: {
    paddingVertical: 26,
    paddingHorizontal: 34,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    ...SHADOW.float,
  },

  loadingTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
    marginTop: 14,
  },

  loadingSub: { fontSize: 12, color: COLORS.muted, marginTop: 4 },
});