import { useWindowDimensions } from "react-native";
import { colorForInitials, initials } from "@/lib/friends";
import Pin from "./Pin";

type Props = {
  name: string;
  percentageX: number;
  percentageY: number;
};

/**
 * A friend's shared seat: a pin with their initials, coloured by them, its tip
 * on the seat.
 */
export default function FriendMarker({
  name,
  percentageX,
  percentageY,
}: Props) {
  const { width } = useWindowDimensions();
  const label = initials(name);
  return (
    <Pin
      percentageX={percentageX}
      percentageY={percentageY}
      viewportWidth={width}
      label={label}
      color={colorForInitials(label)}
      accessibilityLabel={`${name} sitter her`}
    />
  );
}
