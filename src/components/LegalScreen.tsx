import React, { useRef, useState } from "react";
import {
  LayoutAnimation,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "./Icon";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const COLORS = {
  primary: "#1F6B3A",
  dark: "#465044",
  text: "#3D403A",
  muted: "#77796F",
  faint: "#A3A398",
  border: "#E8E5DC",
  field: "#F5F3EC",
  background: "#FBFAF6",
  soft: "#EEF0E9",
  gold: "#B7833D",
  goldSoft: "#F5EEDF",
};

/** Linhas que começam por "- " são apresentadas como itens de lista. */
export type LegalSection = { title: string; body: string[] };
export type LegalDoc = {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
};

export default function LegalScreen({ doc }: { doc: LegalDoc }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Record<number, number>>({});
  const [showIndex, setShowIndex] = useState(false);

  const toggleIndex = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowIndex((v) => !v);
  };

  const goTo = (i: number) => {
    scrollRef.current?.scrollTo({ y: Math.max((offsets.current[i] ?? 0) - 10, 0), animated: true });
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 40 }}
      >
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Icon name="arrow-left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {doc.title}
          </Text>
        </View>

        <View style={styles.body}>
          <View style={styles.introCard}>
            <View style={styles.introIcon}>
              <Icon name="file" size={22} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.introUpdated}>Última atualização: {doc.updated}</Text>
              <Text style={styles.introText}>{doc.intro}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <TouchableOpacity style={styles.indexHeader} onPress={toggleIndex} activeOpacity={0.85}>
              <Text style={styles.indexTitle}>Índice</Text>
              <Icon name={showIndex ? "minus" : "plus"} size={16} color={COLORS.faint} />
            </TouchableOpacity>
            {showIndex &&
              doc.sections.map((s, i) => (
                <TouchableOpacity key={i} style={styles.indexItem} onPress={() => goTo(i)} activeOpacity={0.7}>
                  <Text style={styles.indexNum}>{i + 1}.</Text>
                  <Text style={styles.indexText}>{s.title}</Text>
                </TouchableOpacity>
              ))}
          </View>

          {doc.sections.map((s, i) => (
            <View
              key={i}
              style={styles.section}
              onLayout={(e) => {
                offsets.current[i] = e.nativeEvent.layout.y + 230;
              }}
            >
              <Text style={styles.sectionTitle}>
                {i + 1}. {s.title}
              </Text>
              {s.body.map((line, j) =>
                line.startsWith("- ") ? (
                  <View key={j} style={styles.bulletRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.bulletText}>{line.slice(2)}</Text>
                  </View>
                ) : (
                  <Text key={j} style={styles.paragraph}>
                    {line}
                  </Text>
                )
              )}
            </View>
          ))}

          <View style={styles.footer}>
            <Text style={styles.footerText}>© {new Date().getFullYear()} AgriLink</Text>
            <Text style={styles.footerText}>
              Desenvolvida pela <Text style={styles.footerBrand}>THE TEAM</Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 22, paddingBottom: 18 },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  headerTitle: { flex: 1, fontSize: 21, fontWeight: "800", color: COLORS.text },
  body: { paddingHorizontal: 22, gap: 14 },

  introCard: {
    flexDirection: "row",
    gap: 14,
    padding: 18,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
  },
  introIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  introUpdated: { fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.8)" },
  introText: { fontSize: 13.5, color: "#FFFFFF", marginTop: 4, lineHeight: 19 },

  card: { backgroundColor: COLORS.field, borderRadius: 22, paddingVertical: 6, paddingHorizontal: 14 },
  indexHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13 },
  indexTitle: { fontSize: 14.5, fontWeight: "800", color: COLORS.text },
  indexItem: { flexDirection: "row", gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  indexNum: { width: 26, fontSize: 13, fontWeight: "700", color: COLORS.primary },
  indexText: { flex: 1, fontSize: 13, color: COLORS.text },

  section: { marginTop: 8, gap: 8 },
  sectionTitle: { fontSize: 16.5, fontWeight: "800", color: COLORS.text },
  paragraph: { fontSize: 14, color: COLORS.text, lineHeight: 21 },
  bulletRow: { flexDirection: "row", gap: 8, paddingLeft: 4 },
  bullet: { fontSize: 14, color: COLORS.primary, lineHeight: 21 },
  bulletText: { flex: 1, fontSize: 14, color: COLORS.text, lineHeight: 21 },

  footer: { alignItems: "center", marginTop: 26, gap: 3 },
  footerText: { fontSize: 11.5, color: "#8A968C" },
  footerBrand: { fontWeight: "800", color: COLORS.dark, letterSpacing: 0.5 },
});