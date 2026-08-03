/**
 * Icon name → icon component, for the room-content vocabulary in `@revio/core`.
 *
 * This exists because two apps need the same picture for the same amenity and an app may never
 * import another app's internals: RevioCRS draws it beside a checkbox so a hotel can find "Balcony"
 * in a grid of thirty-five without reading every label, and RevioDirect draws the same one beside
 * the same word so a guest recognises it. Two maps would drift, and the day they drift the ticked
 * box and the guest's page stop agreeing.
 *
 * **An explicit map, not `lucide[name]`.** A dynamic lookup defeats tree-shaking — the whole icon
 * set (well over a thousand components) ends up in the bundle of a page that shows nine of them.
 * The trade is that adding an amenity to `@revio/core` means adding its icon here too, and typing
 * the map as `Record<RoomIconName, …>` is what makes that a build error rather than a room that
 * quietly shows a generic tick where the hotel ticked "Balcony".
 */
import {
  Accessibility, AirVent, ArrowDownToLine, ArrowUpDown, Baby, Bath, Bed, BedDouble, BedSingle,
  Building2, Check, Cigarette, Coffee, CookingPot, DoorClosed, DoorOpen, Droplets, EarOff,
  Footprints, Laptop, LifeBuoy, Link2, Microwave, Mountain, PawPrint, Refrigerator, Shirt,
  ShowerHead, Sofa, Thermometer, Trees, Tv, Umbrella, Users, Vault, WashingMachine, Waves, Wifi,
  Wind, Wine,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RoomIconName } from "@revio/core";

const ICONS: Record<RoomIconName, LucideIcon> = {
  Accessibility, AirVent, ArrowDownToLine, ArrowUpDown, Baby, Bath, Bed, BedDouble, BedSingle,
  Building2, Cigarette, Coffee, CookingPot, DoorClosed, DoorOpen, Droplets, EarOff, Footprints,
  Laptop, LifeBuoy, Link2, Microwave, Mountain, PawPrint, Refrigerator, Shirt, ShowerHead, Sofa,
  Thermometer, Trees, Tv, Umbrella, Users, Vault, WashingMachine, Waves, Wifi, Wind, Wine,
};

/**
 * Draws the icon for an amenity or bed setup.
 *
 * Falls back to a tick rather than to nothing: an unrecognised name means someone added an amenity
 * and forgot the icon, and a row that silently loses its bullet reads as a rendering bug to whoever
 * sees it. A tick still says "this room has this".
 */
export function AmenityIcon({
  name,
  size = 15,
  className,
  style,
}: {
  /** The `icon` field from `ROOM_AMENITIES` / `BED_SETUPS`. */
  name: string | undefined;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icon = (name && ICONS[name as RoomIconName]) || Check;
  return <Icon size={size} strokeWidth={1.9} className={className} style={style} aria-hidden />;
}
