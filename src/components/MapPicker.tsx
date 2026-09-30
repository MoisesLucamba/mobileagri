import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "./Icon";

const COLORS = {
  primary: "#1F6B3A",
  primarySoft: "#EAF3EA",
  accent: "#E2932F",
  text: "#16231C",
  muted: "#78877D",
  faint: "#AEB8AC",
  canvas: "#FAF8F3",
  surface: "#FFFFFF",
  border: "#EAE4D6",
};

const DEFAULT_CENTER = { lat: -8.839, lng: 13.289 }; // Luanda
const NOMINATIM = "https://nominatim.openstreetmap.org";
const HEADERS = { Accept: "application/json", "Accept-Language": "pt" };

export type Coords = { lat: number; lng: number };
export type PickedLocation = { lat: number; lng: number; address: string };

type SearchResult = { id: string; title: string; subtitle: string; lat: number; lng: number };

type Props = {
  visible: boolean;
  initialCoords?: Coords | null;
  initialQuery?: string;
  onClose: () => void;
  onConfirm: (picked: PickedLocation) => void;
};

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

function buildAddress(data: any) {
  const a = data?.address || {};
  const street = a.road || a.pedestrian || a.footway || a.path;
  const area = a.neighbourhood || a.suburb || a.quarter || a.city_district;
  const city = a.city || a.town || a.village || a.municipality || a.county;
  const parts = [street, area, city].filter(Boolean);
  if (parts.length) return parts.join(", ");
  return String(data?.display_name || "")
    .split(",")
    .slice(0, 3)
    .map((s: string) => s.trim())
    .filter(Boolean)
    .join(", ");
}

// Mapa Leaflet + OpenStreetMap com pin fixo no centro: o ponto escolhido é o centro do mapa.
function buildHtml(lat: number, lng: number, zoom: number) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #FAF8F3; }
    .leaflet-control-attribution { font-size: 9px; }
    #pin { position: absolute; left: 50%; top: 50%; width: 40px; height: 52px; margin-left: -20px; margin-top: -52px;
           z-index: 1000; pointer-events: none; transition: transform .18s ease; }
    #pin.lift { transform: translateY(-12px); }
    #dot { position: absolute; left: 50%; top: 50%; width: 14px; height: 6px; margin-left: -7px; margin-top: -3px;
           border-radius: 50%; background: rgba(0,0,0,.28); z-index: 999; pointer-events: none;
           transition: transform .18s ease, opacity .18s ease; }
    #dot.lift { transform: scale(.6); opacity: .5; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="dot"></div>
  <div id="pin">
    <svg viewBox="0 0 40 52" width="40" height="52">
      <path d="M20 0C9 0 0 8.7 0 19.5 0 34 20 52 20 52s20-18 20-32.5C40 8.7 31 0 20 0z" fill="#1F6B3A"/>
      <circle cx="20" cy="19" r="7" fill="#ffffff"/>
    </svg>
  </div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    function post(o) { window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
    var pin = document.getElementById('pin');
    var dot = document.getElementById('dot');
    var map = L.map('map', { zoomControl: false }).setView([${lat}, ${lng}], ${zoom});
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    map.on('dragstart', function () { post({ type: 'drag' }); });
    map.on('movestart', function () { pin.classList.add('lift'); dot.classList.add('lift'); });
    map.on('moveend', function () {
      pin.classList.remove('lift'); dot.classList.remove('lift');
      var c = map.getCenter();
      post({ type: 'move', lat: c.lat, lng: c.lng });
    });
    map.on('click', function (e) { map.panTo(e.latlng); });

    window.setPoint = function (la, ln, z) { map.setView([la, ln], z || 17, { animate: true }); };

    setTimeout(function () { map.invalidateSize(); post({ type: 'ready' }); }, 300);
  </script>
</body>
</html>`;
}

export default function MapPicker({ visible, initialCoords, initialQuery, onClose, onConfirm }: Props) {
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<Coords | null>(null);
  const reverseReq = useRef(0);
  const searchReq = useRef(0);
  const skipRef = useRef("");

  const [html, setHtml] = useState("");
  const [center, setCenter] = useState<Coords>(initialCoords ?? DEFAULT_CENTER);
  const [address, setAddress] = useState("");
  const [resolving, setResolving] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [noResults, setNoResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  const goTo = useCallback((c: Coords) => {
    setCenter(c);
    if (readyRef.current) {
      webRef.current?.injectJavaScript(`window.setPoint(${c.lat},${c.lng},17);true;`);
    } else {
      pendingRef.current = c;
    }
  }, []);

  const runSearch = useCallback(async (q: string): Promise<Coords[]> => {
    const id = ++searchReq.current;
    setSearching(true);
    try {
      const url = `${NOMINATIM}/search?format=jsonv2&limit=6&countrycodes=ao&accept-language=pt&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: HEADERS });
      const data = await res.json();
      if (id !== searchReq.current) return [];
      const list: SearchResult[] = (Array.isArray(data) ? data : [])
        .map((d: any) => {
          const parts = String(d.display_name || "")
            .split(",")
            .map((s: string) => s.trim());
          return {
            id: String(d.place_id),
            title: parts.slice(0, 2).join(", "),
            subtitle: parts.slice(2, 5).join(", "),
            lat: Number(d.lat),
            lng: Number(d.lon),
          };
        })
        .filter((r: SearchResult) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
      setResults(list);
      setNoResults(list.length === 0);
      return list.map((r) => ({ lat: r.lat, lng: r.lng }));
    } catch {
      if (id === searchReq.current) {
        setResults([]);
        setNoResults(false);
      }
      return [];
    } finally {
      if (id === searchReq.current) setSearching(false);
    }
  }, []);

  /* ---------- abrir: reinicia tudo e tenta centrar sozinho ---------- */
  useEffect(() => {
    if (!visible) return;
    readyRef.current = false;
    pendingRef.current = null;

    const start = initialCoords ?? DEFAULT_CENTER;
    const q = initialCoords ? "" : (initialQuery || "").trim();

    skipRef.current = q;
    setCenter(start);
    setAddress("");
    setResolving(false);
    setResults([]);
    setNoResults(false);
    setQuery(q);
    setHtml(buildHtml(start.lat, start.lng, initialCoords ? 17 : 13));

    let alive = true;
    (async () => {
      if (initialCoords) return;
      if (q.length >= 3) {
        const found = await runSearch(q);
        if (alive && found.length) goTo(found[0]);
        return;
      }
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted) return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (alive) goTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        /* sem localização: fica em Luanda */
      }
    })();

    return () => {
      alive = false;
    };
  }, [visible]);

  /* ---------- pesquisa automática enquanto escreves ---------- */
  useEffect(() => {
    if (!visible) return;
    const q = query.trim();
    if (q === skipRef.current) return;
    if (q.length < 3) {
      setResults([]);
      setNoResults(false);
      return;
    }
    const t = setTimeout(() => runSearch(q), 600);
    return () => clearTimeout(t);
  }, [query, visible]);

  /* ---------- endereço automático do ponto central ---------- */
  useEffect(() => {
    if (!visible) return;
    const id = ++reverseReq.current;
    setResolving(true);
    const t = setTimeout(async () => {
      try {
        const url = `${NOMINATIM}/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=pt&lat=${center.lat}&lon=${center.lng}`;
        const res = await fetch(url, { headers: HEADERS });
        const data = await res.json();
        if (id === reverseReq.current) setAddress(buildAddress(data));
      } catch {
        if (id === reverseReq.current) setAddress("");
      } finally {
        if (id === reverseReq.current) setResolving(false);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [center.lat, center.lng, visible]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const m = JSON.parse(e.nativeEvent.data);
      if (m.type === "ready") {
        readyRef.current = true;
        if (pendingRef.current) {
          const c = pendingRef.current;
          pendingRef.current = null;
          webRef.current?.injectJavaScript(`window.setPoint(${c.lat},${c.lng},17);true;`);
        }
      } else if (m.type === "move") {
        setCenter({ lat: m.lat, lng: m.lng });
      } else if (m.type === "drag") {
        setResults([]);
        setNoResults(false);
        Keyboard.dismiss();
      }
    } catch {
      /* mensagem inválida */
    }
  };

  const pickResult = (r: SearchResult) => {
    skipRef.current = r.title.trim();
    setQuery(r.title);
    setResults([]);
    setNoResults(false);
    Keyboard.dismiss();
    goTo({ lat: r.lat, lng: r.lng });
  };

  const locateMe = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Localização", "Permite o acesso à localização para usares esta opção.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setResults([]);
      setNoResults(false);
      Keyboard.dismiss();
      goTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      Alert.alert("Localização", "Não foi possível obter a tua localização.");
    } finally {
      setLocating(false);
    }
  };

  const confirm = () => {
    onConfirm({ lat: round6(center.lat), lng: round6(center.lng), address: address.trim() });
  };

  const submitSearch = () => {
    const q = query.trim();
    if (q.length >= 3) {
      skipRef.current = q;
      runSearch(q);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Local de entrega</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Fechar" style={styles.closeBtn}>
            <Icon name="close" size={18} color={COLORS.muted} />
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <View style={styles.searchBox}>
            <Icon name="search" size={17} color={COLORS.muted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Pesquisar rua, bairro ou ponto de referência"
              placeholderTextColor={COLORS.faint}
              returnKeyType="search"
              autoCorrect={false}
              onSubmitEditing={submitSearch}
            />
            {searching ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : query.length > 0 ? (
              <Pressable
                hitSlop={10}
                onPress={() => {
                  skipRef.current = "";
                  setQuery("");
                  setResults([]);
                  setNoResults(false);
                }}
              >
                <Icon name="close" size={16} color={COLORS.faint} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.mapWrap}>
          {html ? (
            <WebView
              ref={webRef}
              originWhitelist={["*"]}
              source={{ html, baseUrl: "https://www.openstreetmap.org" }}
              style={styles.webview}
              onMessage={onMessage}
              javaScriptEnabled
              domStorageEnabled
              mixedContentMode="always"
              setSupportMultipleWindows={false}
              startInLoadingState
              nestedScrollEnabled
              androidLayerType={Platform.OS === "android" ? "hardware" : undefined}
            />
          ) : null}

          {results.length > 0 || noResults ? (
            <View style={styles.results}>
              {noResults ? (
                <Text style={styles.noResults}>Sem resultados. Tenta outro nome ou move o mapa.</Text>
              ) : (
                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  {results.map((r, i) => (
                    <Pressable
                      key={r.id}
                      onPress={() => pickResult(r)}
                      style={[styles.resultRow, i > 0 && styles.resultBorder]}
                    >
                      <Icon name="pin" size={16} color={COLORS.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultTitle} numberOfLines={1}>{r.title}</Text>
                        {r.subtitle ? (
                          <Text style={styles.resultSub} numberOfLines={1}>{r.subtitle}</Text>
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          ) : null}
        </View>

        <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.addrRow}>
            <View style={styles.addrIcon}>
              <Icon name="pin" size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addrLabel}>Local selecionado</Text>
              <Text style={styles.addrText} numberOfLines={2}>
                {address || (resolving ? "A procurar endereço…" : "Move o mapa para ajustar o ponto")}
              </Text>
              <Text style={styles.coords}>
                {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
              </Text>
            </View>
            {resolving ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
          </View>

          <Pressable style={styles.locateBtn} onPress={locateMe} disabled={locating}>
            {locating ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Icon name="navigation" size={16} color={COLORS.primary} />
            )}
            <Text style={styles.locateText}>Usar a minha localização</Text>
          </Pressable>

          <Pressable style={styles.confirmBtn} onPress={confirm}>
            <Icon name="check" size={18} color="#FFFFFF" strokeWidth={3} />
            <Text style={styles.confirmText}>Confirmar este local</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.canvas,
  },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 10 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: COLORS.canvas,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 0 },

  mapWrap: { flex: 1, backgroundColor: COLORS.canvas },
  webview: { flex: 1, backgroundColor: COLORS.canvas },

  results: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    maxHeight: 260,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    zIndex: 10,
    shadowColor: "#16231C",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  resultBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  resultTitle: { fontSize: 13.5, fontWeight: "700", color: COLORS.text },
  resultSub: { fontSize: 11.5, color: COLORS.muted, marginTop: 2 },
  noResults: { padding: 14, fontSize: 12.5, color: COLORS.muted },

  panel: {
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  addrIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primarySoft,
  },
  addrLabel: { fontSize: 11, fontWeight: "700", color: COLORS.muted },
  addrText: { fontSize: 14, fontWeight: "800", color: COLORS.text, marginTop: 2 },
  coords: { fontSize: 11, color: COLORS.faint, marginTop: 2 },

  locateBtn: {
    height: 46,
    marginTop: 14,
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  locateText: { color: COLORS.primary, fontSize: 13.5, fontWeight: "800" },
  confirmBtn: {
    height: 54,
    marginTop: 10,
    borderRadius: 16,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  confirmText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
});