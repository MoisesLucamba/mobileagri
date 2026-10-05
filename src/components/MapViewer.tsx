import { useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Linking,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import Icon from "./Icon";

// Paleta partilhada com o resto da app
const COLORS = {
  primary: "#2E8B4F",
  primaryDark: "#25703F",
  primarySoft: "#E9F5EC",
  text: "#16231C",
  muted: "#78877D",
  faint: "#AEB8AC",
  canvas: "#F6F8F5",
  surface: "#FFFFFF",
  border: "#E8ECE6",
};

export type MapViewerCoords = { lat: number; lng: number };
export type MapViewerRoute = { origin: MapViewerCoords; destination: MapViewerCoords };

type Props = {
  visible: boolean;
  coords: MapViewerCoords | null;
  route?: MapViewerRoute;
  title?: string;
  subtitle?: string;
  onClose: () => void;
};

function buildMapHtml(lat: number, lng: number) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #F6F8F5; }
    .leaflet-control-attribution { font-size: 9px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([${lat}, ${lng}], 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    L.marker([${lat}, ${lng}]).addTo(map);
    setTimeout(function () { map.invalidateSize(); }, 300);
  </script>
</body>
</html>`;
}

function buildRouteHtml({ origin, destination }: MapViewerRoute, roadCoords: [number, number][] | null) {
  const originPair = JSON.stringify([origin.lat, origin.lng]);
  const destinationPair = JSON.stringify([destination.lat, destination.lng]);
  const roadGeometry = JSON.stringify(roadCoords);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #F6F8F5; }
    .leaflet-control-attribution { font-size: 9px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var origin = ${originPair};
    var destination = ${destinationPair};
    var map = L.map('map', { zoomControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    function endpoint(point, label, color) {
      var icon = L.divIcon({
        className: 'route-endpoint',
        html: '<div style="width:34px;height:34px;border-radius:10px;border:3px solid #fff;background:' + color + ';color:#fff;display:flex;align-items:center;justify-content:center;font:bold 14px sans-serif;box-shadow:0 2px 9px #0005">' + label + '</div>',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });
      L.marker(point, { icon: icon, zIndexOffset: 1000 }).addTo(map);
    }
    endpoint(origin, 'A', '#2E8B4F');
    endpoint(destination, 'B', '#E2932F');
    var fallback = L.polyline([origin, destination], { color: '#2E8B4F', weight: 5, dashArray: '8 9', opacity: 0.8 }).addTo(map);
    map.fitBounds(L.latLngBounds([origin, destination]), { padding: [42, 42] });
    var road = ${roadGeometry};
    if (road && road.length > 1) {
      map.removeLayer(fallback);
      L.polyline(road, { color: '#FFFFFF', weight: 10, opacity: 0.9 }).addTo(map);
      L.polyline(road, { color: '#2E8B4F', weight: 5, opacity: 0.95 }).addTo(map);
      map.fitBounds(L.latLngBounds(road), { padding: [42, 42] });
    }
    setTimeout(function () { map.invalidateSize(); }, 300);
  </script>
</body>
</html>`;
}

export default function MapViewer({ visible, coords, route, title, subtitle, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const enter = useRef(new Animated.Value(0)).current;
  const [roadCoords, setRoadCoords] = useState<[number, number][] | null>(null);

  // O cartão nunca passa por baixo da barra de navegação / gestos do dispositivo
  const cardHeight = Math.min(560, screenH - insets.top - insets.bottom - 56);

  useEffect(() => {
    if (visible) {
      enter.setValue(0);
      Animated.spring(enter, { toValue: 1, bounciness: 4, speed: 14, useNativeDriver: true }).start();
    }
  }, [visible]);

  useEffect(() => {
    if (!route) {
      setRoadCoords(null);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    setRoadCoords(null);

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${route.origin.lng},${route.origin.lat};${route.destination.lng},${route.destination.lat}` +
      `?overview=full&geometries=geojson`;

    fetch(url, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        const coordinates = data?.routes?.[0]?.geometry?.coordinates;
        if (data?.code === "Ok" && coordinates?.length > 1 && !controller.signal.aborted) {
          setRoadCoords(coordinates.map(([lng, lat]: [number, number]) => [lat, lng]));
        }
      })
      .catch(() => {})
      .finally(() => clearTimeout(timeout));

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [route?.origin.lat, route?.origin.lng, route?.destination.lat, route?.destination.lng]);

  const html = useMemo(() => {
    if (route) return buildRouteHtml(route, roadCoords);
    return coords ? buildMapHtml(coords.lat, coords.lng) : "";
  }, [coords?.lat, coords?.lng, route?.origin.lat, route?.origin.lng, route?.destination.lat, route?.destination.lng, roadCoords]);

  const openExternalMaps = () => {
    const url = route
      ? `https://www.google.com/maps/dir/?api=1&origin=${route.origin.lat},${route.origin.lng}&destination=${route.destination.lat},${route.destination.lng}&travelmode=driving`
      : coords
        ? `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`
        : null;
    if (!url) return;
    Linking.openURL(url).catch(() => Alert.alert("Erro", "Não foi possível abrir o mapa."));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View
        style={[
          styles.overlay,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.card,
            {
              height: cardHeight,
              opacity: enter,
              transform: [
                { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
                { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
              ],
            },
          ]}
        >
          <View style={styles.inner}>
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <Icon name="map" size={18} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{route ? "Rota da entrega" : "Localização do produto"}</Text>
                {subtitle || title ? (
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {[title, subtitle].filter(Boolean).join(" · ")}
                  </Text>
                ) : null}
              </View>
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Fechar" style={styles.closeBtn}>
                <Icon name="close" size={18} color={COLORS.text} />
              </Pressable>
            </View>

            <View style={styles.mapWrap}>
              {html ? (
                <WebView
                  originWhitelist={["*"]}
                  source={{ html, baseUrl: "https://www.openstreetmap.org" }}
                  style={styles.webview}
                  javaScriptEnabled
                  domStorageEnabled
                  mixedContentMode="always"
                  setSupportMultipleWindows={false}
                  startInLoadingState
                  nestedScrollEnabled
                  androidLayerType={Platform.OS === "android" ? "hardware" : undefined}
                />
              ) : (
                <View style={styles.empty}>
                  <Icon name="pin" size={30} color={COLORS.faint} />
                  <Text style={styles.emptyText}>Localização não disponível.</Text>
                </View>
              )}
            </View>

            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.openBtn}
                onPress={openExternalMaps}
                disabled={!coords && !route}
                activeOpacity={0.85}
              >
                <Icon name="navigation" size={16} color="#FFFFFF" />
                <Text style={styles.openText}>Abrir no Maps</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeTextBtn} onPress={onClose} activeOpacity={0.85}>
                <Text style={styles.closeText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(22,35,28,0.5)",
    paddingHorizontal: 18,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  inner: { flex: 1, overflow: "hidden", borderRadius: 16, backgroundColor: COLORS.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primarySoft,
  },
  title: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  subtitle: { fontSize: 11.5, color: COLORS.muted, marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.canvas,
  },
  mapWrap: { flex: 1, backgroundColor: COLORS.canvas },
  webview: { flex: 1, backgroundColor: COLORS.canvas },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { fontSize: 12.5, color: COLORS.faint },
  footer: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  openBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  openText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  closeTextBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  closeText: { fontSize: 13.5, fontWeight: "800", color: COLORS.muted },
});