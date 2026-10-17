import { useWindowDimensions } from "react-native";
import { initials } from "@/lib/friends";
import Pin from "./Pin";

// Dark, so a friend never reads as my own red pin.
const FRIEND_PIN_COLOR = "#18181b";

type Props = {
  name: string;
  percentageX: number;
  percentageY: number;
};

/** A friend's shared seat: a pin with their initials, its tip on the seat. */
export default function FriendMarker({
  name,
  percentageX,
  percentageY,
}: Props) {
  const { width } = useWindowDimensions();
  return (
    <Pin
      percentageX={percentageX}
      percentageY={percentageY}
      viewportWidth={width}
      label={initials(name)}
      color={FRIEND_PIN_COLOR}
      accessibilityLabel={`${name} sitter her`}
    />
  );
}
