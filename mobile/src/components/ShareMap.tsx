import { useState } from "react";
import { StyleSheet, View } from "react-native";
import type { GridPosition } from "../../../src/types/grid";
import ShareButton from "./ShareButton";
import TouchMap from "./TouchMap";

type Props = {
  arena: "salen";
  position?: GridPosition;
};

export default function ShareMap({ arena, position }: Props) {
  const [url, setUrl] = useState<string | undefined>();

  return (
    <View style={styles.container}>
      <TouchMap arena={arena} position={position} onUrlChange={setUrl} />
      <ShareButton url={url} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 40 },
});
