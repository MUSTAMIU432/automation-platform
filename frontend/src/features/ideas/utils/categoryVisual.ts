import type { ComponentType } from 'react'

import {
  BankIcon,
  BulbIcon,
  CapIcon,
  ChatIcon,
  CodeIcon,
  HeartIcon,
  LeafIcon,
  TruckIcon,
  UsersIcon,
} from '../../../components/AppIcons'
import type { IdeaCategory } from '../api/ideasApi'

export interface CategoryVisual {
  Icon: ComponentType<{ className?: string }>
  /** The icon tile's colours. */
  tile: string
}

/* A word in the category's name or slug, and the picture that suits it. Decorative:
   the category's name is always printed beside it. */
const ICONS: Array<[RegExp, ComponentType<{ className?: string }>]> = [
  [/financ|tax|payment|revenue|budget|account/, BankIcon],
  [/educat|school|student|learn|universit/, CapIcon],
  [/environment|energy|climate|agricultur|green|water/, LeafIcon],
  [/health|medic|clinic|care/, HeartIcon],
  [/transport|logistic|supply|delivery|fleet/, TruckIcon],
  [/technolog|software|digital|\bit\b|data/, CodeIcon],
  [/customer|service|support|enquir/, ChatIcon],
  [/human|people|hr\b|staff|recruit/, UsersIcon],
]

const TILES = [
  'bg-gradient-to-br from-mint/40 to-mint/10 text-jade',
  'bg-gradient-to-br from-amber-200/80 to-amber-50 text-amber-600',
  'bg-gradient-to-br from-violet-200/80 to-violet-50 text-violet-600',
  'bg-gradient-to-br from-sky-200/80 to-sky-50 text-sky-600',
  'bg-gradient-to-br from-rose-200/70 to-rose-50 text-rose-600',
  'bg-gradient-to-br from-teal-200/70 to-teal-50 text-teal-700',
]

/** The same category always gets the same colour, whichever page it is drawn on. */
function tileFor(key: string): string {
  let hash = 0
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return TILES[hash % TILES.length]
}

export function categoryVisual(category: IdeaCategory | null): CategoryVisual {
  if (!category) return { Icon: BulbIcon, tile: TILES[0] }
  const words = `${category.name} ${category.slug}`.toLowerCase()
  const Icon = ICONS.find(([pattern]) => pattern.test(words))?.[1] ?? BulbIcon
  return { Icon, tile: tileFor(category.id) }
}
