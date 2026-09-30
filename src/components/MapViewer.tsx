import React, { useEffect, useMemo, useRef } from "react";
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
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import Icon from "./Icon";

const COLORS = {
  primary: "#1F6B3A",
  text: "#16231C",
  muted: "#78877D",
  faint: "#AEB8AC",
  canvas: "#FAF8F3",
  surface: "#FFFFFF",
  border: "#EAE4D6",
};

export type MapViewerCoords = { lat: number; lng: number };

type Props = {
  visible: boolean;
  coords: MapViewerCoords | null;
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
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #FAF8F3; }
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

export default function MapViewer({ visible, coords, title, subtitle, onClose }: Props) {
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      enter.setValue(0);
      Animated.spring(enter, { toValue: 1, bounciness: 6, speed: 14, useNativeDriver: true }).start();
    }
  }, [visible]);

  const html = useMemo(() => (coords ? buildMapHtml(coords.lat, coords.lng) : ""), [coords?.lat, coords?.lng]);

  const openExternalMaps = () => {
    if (!coords) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
    Linking.openURL(url).catch(() => Alert.alert("Erro", "Não foi possível abrir o mapa."));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.card,
            {
              opacity: enter,
              transform: [
                { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
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
                <Text style={styles.title}>Localização do produto</Text>
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
              {coords && html ? (
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
              <TouchableOpacity style={styles.openBtn} onPress={openExternalMaps} disabled={!coords}>
                <Icon name="navigation" size={16} color="#FFFFFF" />
                <Text style={styles.openText}>Abrir no Maps</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeTextBtn} onPress={onClose}>
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
    padding: 22,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    height: 520,
    borderRadius: 26,
    backgroundColor: COLORS.surface,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  inner: { flex: 1, overflow: "hidden", borderRadius: 26, backgroundColor: COLORS.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF3EA",
  },
  title: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  subtitle: { fontSize: 11.5, color: COLORS.muted, marginTop: 2 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
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
    borderRadius: 14,
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
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.canvas,
  },
  closeText: { fontSize: 13.5, fontWeight: "800", color: COLORS.muted },
});