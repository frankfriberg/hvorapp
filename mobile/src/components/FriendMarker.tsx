import { StyleSheet, Text, View } from "react-native";
import { initials } from "@/lib/friends";

const SIZE = 30;

type Props = {
  name: string;
  percentageX: number;
  percentageY: number;
};

/** A friend's shared seat: their initials in a disc centred on the seat. */
export default function FriendMarker({
  name,
  percentageX,
  percentageY,
}: Props) {
  return (
    <View
      pointerEvents="none"
      accessibilityLabel={`${name} sitter her`}
      style={[
        styles.marker,
        { left: `${percentageX}%`, top: `${percentageY}%` },
      ]}
    >
      <Text style={styles.initials} numberOfLines={1}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  marker: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    marginLeft: -SIZE / 2,
    marginTop: -SIZE / 2,
    backgroundColor: "#18181b",
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
