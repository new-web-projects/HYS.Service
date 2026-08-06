import {
  WrenchIcon, HomeIcon, CarIcon, LeafIcon, LaptopIcon, PaletteIcon,
  ElectricIcon, PlumbingIcon, KeyIcon, CleaningIcon, BoxIcon, FoodIcon,
  ScissorsIcon, PawIcon, FitnessIcon, CartIcon, CategoryIcon,
} from '@/components/icons';

/**
 * Part 5 — Admin Panel emoji removal.
 *
 * Categories used to store a raw emoji character (e.g. "🔧") as their
 * `icon` field, picked from a hardcoded emoji palette in the admin's
 * category form. That's the one piece of "category" data that's genuinely
 * business content (an admin choosing how a category looks), but the emoji
 * palette itself was admin-panel UI chrome — exactly what Part 5 asks to
 * professionalize.
 *
 * `categorySchema` in lib/validators/schemas.js already defaulted `icon` to
 * the plain word "wrench", not an emoji — this file completes that
 * originally-intended design: `icon` now stores a short key (≤10 chars,
 * satisfying the existing schema's max length) that maps to a real SVG
 * icon component.
 *
 * CATEGORY_ICON_OPTIONS drives the admin picker UI.
 * getCategoryIcon() resolves a category's stored icon value (new key OR
 * legacy emoji, for categories created before this change) to a component.
 */

export const CATEGORY_ICON_OPTIONS = [
  { key: 'wrench',   label: 'Repairs',    Icon: WrenchIcon   },
  { key: 'home',     label: 'Home',       Icon: HomeIcon     },
  { key: 'car',      label: 'Automotive', Icon: CarIcon      },
  { key: 'leaf',     label: 'Outdoor',    Icon: LeafIcon     },
  { key: 'laptop',   label: 'Tech',       Icon: LaptopIcon   },
  { key: 'palette',  label: 'Design',     Icon: PaletteIcon  },
  { key: 'electric', label: 'Electrical', Icon: ElectricIcon },
  { key: 'plumbing', label: 'Plumbing',   Icon: PlumbingIcon },
  { key: 'key',      label: 'Locksmith',  Icon: KeyIcon      },
  { key: 'cleaning', label: 'Cleaning',   Icon: CleaningIcon },
  { key: 'box',      label: 'Moving',     Icon: BoxIcon      },
  { key: 'food',     label: 'Catering',   Icon: FoodIcon     },
  { key: 'scissors', label: 'Salon',      Icon: ScissorsIcon },
  { key: 'paw',      label: 'Pet Care',   Icon: PawIcon      },
  { key: 'fitness',  label: 'Fitness',    Icon: FitnessIcon  },
  { key: 'cart',     label: 'Errands',    Icon: CartIcon     },
];

// Legacy emoji → new key, so categories created before this change keep
// showing the equivalent icon instead of rendering broken/blank.
const LEGACY_EMOJI_MAP = {
  '🔧': 'wrench',
  '🏠': 'home',
  '🚗': 'car',
  '🌿': 'leaf',
  '💻': 'laptop',
  '🎨': 'palette',
  '🔌': 'electric',
  '🚿': 'plumbing',
  '🔑': 'key',
  '🧹': 'cleaning',
  '📦': 'box',
  '🍕': 'food',
  '💇': 'scissors',
  '🐾': 'paw',
  '🏋️': 'fitness',
  '🏋': 'fitness',
  '🛒': 'cart',
};

const ICON_BY_KEY = Object.fromEntries(
  CATEGORY_ICON_OPTIONS.map(({ key, Icon }) => [key, Icon]),
);

/**
 * Resolve a category's stored `icon` value to its canonical key string
 * ("wrench", "home", etc.), whether it's already a key or a legacy emoji.
 * Used so the admin edit form pre-selects the right picker button for
 * categories created before this change, and so saving writes back the
 * new key format going forward.
 */
export function normalizeIconKey(iconValue) {
  if (!iconValue) return 'wrench';
  const key = LEGACY_EMOJI_MAP[iconValue] ?? iconValue;
  return ICON_BY_KEY[key] ? key : 'wrench';
}

/**
 * Resolve a category's stored icon value to an SVG icon component.
 * Accepts a new-style key ("wrench"), a legacy emoji ("🔧"), or anything
 * unrecognized — always returns a renderable component, never blank.
 */
export function getCategoryIcon(iconValue) {
  if (!iconValue) return CategoryIcon;
  const key = LEGACY_EMOJI_MAP[iconValue] ?? iconValue;
  return ICON_BY_KEY[key] ?? CategoryIcon;
}
