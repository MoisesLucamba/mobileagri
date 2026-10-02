
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { useRouter } from "expo-router";

import { useUserRole } from "../../context/RoleContext";
import Icon from "../Icon";

import {
    FALLBACK_ACTION,
    ROLE_ACTIONS,
} from "../../constants/roleActions";

interface RoleActionButtonProps {
  compact?: boolean;
}

export default function RoleActionButton({
  compact = false,
}: RoleActionButtonProps) {
  const router = useRouter();

  const { role, loading } = useUserRole();

  const action =
    role && ROLE_ACTIONS[role]
      ? ROLE_ACTIONS[role]
      : FALLBACK_ACTION;

  function handlePress() {
    if (loading) return;

    router.push(action.route as any);
  }

  return (
    <View
      style={[
        styles.wrapper,
        compact && styles.wrapperCompact,
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        disabled={loading}
        onPress={handlePress}
        style={[
          styles.button,
          compact && styles.buttonCompact,
          {
            backgroundColor: loading
              ? "#D1D5DB"
              : action.color,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator
            color="#FFFFFF"
            size="small"
          />
        ) : (
          <Icon
            name={action.icon}
            size={compact ? 20 : 26}
            color="#FFFFFF"
          />
        )}
      </TouchableOpacity>

      {!compact && (
        <Text
          style={styles.label}
          numberOfLines={1}
        >
          {loading ? "..." : action.label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: 86,
  },

  wrapperCompact: {
    width: 42,
  },

  button: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -22,

    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 6,
  },

  buttonCompact: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginTop: 0,
    shadowOpacity: 0,
    elevation: 0,
  },

  label: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4B5563",
    marginTop: 4,
  },
});