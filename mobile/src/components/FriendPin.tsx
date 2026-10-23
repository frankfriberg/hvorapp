import { useWindowDimensions, View } from "react-native";
import { colorForInitials, initials } from "@/lib/friends";
import { t } from "@/lib/i18n";
import Pin from "./Pin";

// A friend pin's size against mine, so mine stands out.
const FRIEND_PIN_SCALE = 0.7;

type Props = {
  name: string;
  percentageX: number;
  percentageY: number;
};

/**
 * A friend pin: my pin in the friend's colour with their initials, without
 * the dot, its tip on their shared seat.
 */
export default function FriendPin({ name, percentageX, percentageY }: Props) {
  const { width } = useWindowDimensions();
  return (
    <View accessible accessibilityLabel={t.sitsHere(name)}>
      <Pin
        percentageX={percentageX}
        percentageY={percentageY}
        viewportWidth={width}
        owner={{ name, color: colorForInitials(initials(name)) }}
        dot={false}
        scale={FRIEND_PIN_SCALE}
      />
    </View>
  );
}
