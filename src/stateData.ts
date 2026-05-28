import type { Feature, FeatureCollection, GeometryObject } from 'geojson'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import australiaMap from '@svg-maps/australia'
import worldMap from '@svg-maps/world'
import worldAtlas from 'world-atlas/countries-50m.json'
import statesAtlas from 'us-atlas/states-10m.json'

type QuizAreaProperties = {
  name?: string
}

type StateTopology = Topology<{
  states: GeometryCollection<QuizAreaProperties>
}>

type WorldTopology = Topology<{
  countries: GeometryCollection<QuizAreaProperties>
}>

export type RegionId = 'africa' | 'asia' | 'australia' | 'europe' | 'nato' | 'north-america' | 'south-america' | 'us'

export type QuizArea = {
  abbreviation: string
  aliases?: string[]
  feature?: Feature<GeometryObject, QuizAreaProperties>
  id: string
  labelFontSize?: number
  labelX?: number
  labelY?: number
  name: string
  path?: string
}

export type QuizRegion = {
  answerNoun: string
  areas: QuizArea[]
  acceptsAbbreviations: boolean
  eyebrow: string
  flag: string
  id: RegionId
  label: string
  mapLabel: string
  pluralNoun: string
  projection: 'albersUsa' | 'cards' | 'conicConformal' | 'conicEqualArea' | 'svg'
  projectionCenter?: [number, number]
  projectionParallels?: [number, number]
  projectionRotate?: [number, number]
  shortLabel: string
  unitLabel: string
  viewBox: string
}

const STATE_ABBREVIATIONS: Record<string, string> = {
  Alabama: 'AL',
  Alaska: 'AK',
  Arizona: 'AZ',
  Arkansas: 'AR',
  California: 'CA',
  Colorado: 'CO',
  Connecticut: 'CT',
  Delaware: 'DE',
  Florida: 'FL',
  Georgia: 'GA',
  Hawaii: 'HI',
  Idaho: 'ID',
  Illinois: 'IL',
  Indiana: 'IN',
  Iowa: 'IA',
  Kansas: 'KS',
  Kentucky: 'KY',
  Louisiana: 'LA',
  Maine: 'ME',
  Maryland: 'MD',
  Massachusetts: 'MA',
  Michigan: 'MI',
  Minnesota: 'MN',
  Mississippi: 'MS',
  Missouri: 'MO',
  Montana: 'MT',
  Nebraska: 'NE',
  Nevada: 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  Ohio: 'OH',
  Oklahoma: 'OK',
  Oregon: 'OR',
  Pennsylvania: 'PA',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  Tennessee: 'TN',
  Texas: 'TX',
  Utah: 'UT',
  Vermont: 'VT',
  Virginia: 'VA',
  Washington: 'WA',
  'West Virginia': 'WV',
  Wisconsin: 'WI',
  Wyoming: 'WY',
}

const EXCLUDED_IDS = new Set(['11', '60', '66', '69', '72', '78'])
const topology = statesAtlas as unknown as StateTopology
const stateCollection = feature<QuizAreaProperties>(topology, topology.objects.states) as FeatureCollection<
  GeometryObject,
  QuizAreaProperties
>

export function normalizeAnswer(answer: string) {
  return answer
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toLocaleLowerCase('en-US')
}

function getAllowedMisspellings(answer: string) {
  if (answer.length < 5) {
    return 0
  }

  if (answer.length <= 7) {
    return 1
  }

  if (answer.length <= 9) {
    return 2
  }

  return Math.min(4, Math.ceil(answer.length * 0.28))
}

function getEditDistance(source: string, target: string) {
  const distances = Array.from({ length: source.length + 1 }, (_, sourceIndex) =>
    Array.from({ length: target.length + 1 }, (_, targetIndex) => {
      if (sourceIndex === 0) {
        return targetIndex
      }

      if (targetIndex === 0) {
        return sourceIndex
      }

      return 0
    }),
  )

  for (let sourceIndex = 1; sourceIndex <= source.length; sourceIndex += 1) {
    for (let targetIndex = 1; targetIndex <= target.length; targetIndex += 1) {
      const substitutionCost = source[sourceIndex - 1] === target[targetIndex - 1] ? 0 : 1
      distances[sourceIndex][targetIndex] = Math.min(
        distances[sourceIndex - 1][targetIndex] + 1,
        distances[sourceIndex][targetIndex - 1] + 1,
        distances[sourceIndex - 1][targetIndex - 1] + substitutionCost,
      )

      if (
        sourceIndex > 1 &&
        targetIndex > 1 &&
        source[sourceIndex - 1] === target[targetIndex - 2] &&
        source[sourceIndex - 2] === target[targetIndex - 1]
      ) {
        distances[sourceIndex][targetIndex] = Math.min(
          distances[sourceIndex][targetIndex],
          distances[sourceIndex - 2][targetIndex - 2] + 1,
        )
      }
    }
  }

  return distances[source.length][target.length]
}

const US_STATES: QuizArea[] = stateCollection.features
  .reduce<QuizArea[]>((states, stateFeature) => {
    const id = stateFeature.id === undefined ? '' : String(stateFeature.id)
    const name = stateFeature.properties?.name ?? ''
    const abbreviation = STATE_ABBREVIATIONS[name]

    if (!id || !name || !abbreviation || EXCLUDED_IDS.has(id)) {
      return states
    }

    states.push({
      abbreviation,
      feature: stateFeature,
      id,
      name,
    })

    return states
  }, [])
  .sort((a, b) => a.name.localeCompare(b.name))

type SvgMapLocation = {
  id: string
  name: string
  path: string
}

export type SvgPathBounds = {
  maxX: number
  maxY: number
  minX: number
  minY: number
}

const SVG_PATH_TOKEN_PATTERN = /[a-df-zA-DF-Z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g
const MIN_VISIBLE_WORLD_AREA_SIZE = 14
const MAX_WORLD_AREA_SCALE = 420

function isSvgPathCommand(token: string) {
  return /^[a-df-zA-DF-Z]$/.test(token)
}

function formatSvgNumber(value: number) {
  return String(Math.round(value * 1000) / 1000)
}

function getSvgPathBounds(path: string) {
  const tokens = path.match(SVG_PATH_TOKEN_PATTERN) ?? []
  let command = ''
  let currentX = 0
  let currentY = 0
  let index = 0
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let startX = 0
  let startY = 0

  function includePoint(x: number, y: number) {
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
  }

  while (index < tokens.length) {
    const token = tokens[index]

    if (isSvgPathCommand(token)) {
      command = token
      index += 1

      if (command === 'z' || command === 'Z') {
        currentX = startX
        currentY = startY
      }

      continue
    }

    if (command !== 'l' && command !== 'L' && command !== 'm' && command !== 'M') {
      index += 1
      continue
    }

    let isMove = command === 'm' || command === 'M'

    while (index + 1 < tokens.length && !isSvgPathCommand(tokens[index])) {
      const nextX = Number(tokens[index])
      const nextY = Number(tokens[index + 1])
      index += 2

      if (Number.isNaN(nextX) || Number.isNaN(nextY)) {
        continue
      }

      if (command === 'l' || command === 'm') {
        currentX += nextX
        currentY += nextY
      } else {
        currentX = nextX
        currentY = nextY
      }

      if (isMove) {
        startX = currentX
        startY = currentY
        isMove = false
      }

      includePoint(currentX, currentY)
    }
  }

  if (![maxX, maxY, minX, minY].every(Number.isFinite)) {
    return undefined
  }

  return { maxX, maxY, minX, minY } satisfies SvgPathBounds
}

function combineSvgPathBounds(paths: string[]) {
  const bounds = paths.map(getSvgPathBounds).filter((pathBounds): pathBounds is SvgPathBounds => Boolean(pathBounds))

  if (bounds.length === 0) {
    return undefined
  }

  return bounds.reduce<SvgPathBounds>(
    (combined, pathBounds) => ({
      maxX: Math.max(combined.maxX, pathBounds.maxX),
      maxY: Math.max(combined.maxY, pathBounds.maxY),
      minX: Math.min(combined.minX, pathBounds.minX),
      minY: Math.min(combined.minY, pathBounds.minY),
    }),
    {
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
    },
  )
}

function getSvgViewBox(areas: QuizArea[], fallbackViewBox: string) {
  const bounds = combineSvgPathBounds(areas.map((area) => area.path ?? ''))

  if (!bounds) {
    return fallbackViewBox
  }

  const width = Math.max(1, bounds.maxX - bounds.minX)
  const height = Math.max(1, bounds.maxY - bounds.minY)
  const paddingX = Math.min(60, Math.max(8, width * 0.04))
  const paddingY = Math.min(60, Math.max(8, height * 0.04))
  const viewBoxX = bounds.minX - paddingX
  const viewBoxY = bounds.minY - paddingY
  const viewBoxWidth = width + paddingX * 2
  const viewBoxHeight = height + paddingY * 2

  return [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight].map(formatSvgNumber).join(' ')
}

export function scaleSvgPath(path: string, bounds: SvgPathBounds, scale: number) {
  const tokens = path.match(SVG_PATH_TOKEN_PATTERN) ?? []
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  const output: string[] = []
  let command = ''
  let currentX = 0
  let currentY = 0
  let index = 0
  let startX = 0
  let startY = 0

  function scalePoint(x: number, y: number) {
    return {
      x: centerX + (x - centerX) * scale,
      y: centerY + (y - centerY) * scale,
    }
  }

  while (index < tokens.length) {
    const token = tokens[index]

    if (isSvgPathCommand(token)) {
      command = token
      index += 1

      if (command === 'z' || command === 'Z') {
        output.push('Z')
        currentX = startX
        currentY = startY
      }

      continue
    }

    if (command !== 'l' && command !== 'L' && command !== 'm' && command !== 'M') {
      return path
    }

    let isMove = command === 'm' || command === 'M'

    while (index + 1 < tokens.length && !isSvgPathCommand(tokens[index])) {
      const nextX = Number(tokens[index])
      const nextY = Number(tokens[index + 1])
      index += 2

      if (Number.isNaN(nextX) || Number.isNaN(nextY)) {
        continue
      }

      if (command === 'l' || command === 'm') {
        currentX += nextX
        currentY += nextY
      } else {
        currentX = nextX
        currentY = nextY
      }

      const scaledPoint = scalePoint(currentX, currentY)

      if (isMove) {
        startX = currentX
        startY = currentY
        output.push(`M${formatSvgNumber(scaledPoint.x)},${formatSvgNumber(scaledPoint.y)}`)
        isMove = false
      } else {
        output.push(`L${formatSvgNumber(scaledPoint.x)},${formatSvgNumber(scaledPoint.y)}`)
      }
    }
  }

  return output.join(' ')
}

function getWorldPathScale(bounds: SvgPathBounds | undefined) {
  if (!bounds) {
    return 1
  }

  const maxDimension = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY)

  if (maxDimension <= 0) {
    return 1
  }

  return Math.min(MAX_WORLD_AREA_SCALE, MIN_VISIBLE_WORLD_AREA_SIZE / maxDimension)
}

const AUSTRALIA_LOCATIONS = australiaMap.locations as SvgMapLocation[]
const australiaLocationById = new Map(AUSTRALIA_LOCATIONS.map((location) => [location.id, location]))

function getAustraliaPath(locationIds: string[]) {
  return locationIds
    .map((id) => australiaLocationById.get(id)?.path)
    .filter((path): path is string => Boolean(path))
    .join(' ')
}

const AUSTRALIAN_STATES: QuizArea[] = [
  {
    abbreviation: 'ACT',
    id: 'act',
    labelFontSize: 3.5,
    labelX: 246,
    labelY: 188,
    name: 'Australian Capital Territory',
    path: getAustraliaPath(['act']),
  },
  {
    abbreviation: 'NSW',
    id: 'nsw',
    labelFontSize: 7,
    labelX: 230,
    labelY: 162,
    name: 'New South Wales',
    path: getAustraliaPath(['nsw']),
  },
  {
    abbreviation: 'NT',
    id: 'nt',
    labelFontSize: 8,
    labelX: 143,
    labelY: 72,
    name: 'Northern Territory',
    path: getAustraliaPath(['nt-mainland', 'nt-groote-eylandt', 'nt-melville-island']),
  },
  {
    abbreviation: 'QLD',
    id: 'qld',
    labelFontSize: 8,
    labelX: 225,
    labelY: 78,
    name: 'Queensland',
    path: getAustraliaPath(['qld-mainland', 'qld-fraser-island', 'qld-mornington-island']),
  },
  {
    abbreviation: 'SA',
    id: 'sa',
    labelFontSize: 8,
    labelX: 154,
    labelY: 152,
    name: 'South Australia',
    path: getAustraliaPath(['sa-mainland', 'sa-kangaroo-island']),
  },
  {
    abbreviation: 'TAS',
    id: 'tas',
    labelFontSize: 6,
    labelX: 232,
    labelY: 244,
    name: 'Tasmania',
    path: getAustraliaPath(['tas-mainland', 'tas-cape-barren', 'tas-flinders-island', 'tas-king-currie-island']),
  },
  {
    abbreviation: 'VIC',
    id: 'vic',
    labelFontSize: 6,
    labelX: 220,
    labelY: 204,
    name: 'Victoria',
    path: getAustraliaPath(['vic']),
  },
  {
    abbreviation: 'WA',
    id: 'wa',
    labelFontSize: 8,
    labelX: 76,
    labelY: 116,
    name: 'Western Australia',
    path: getAustraliaPath(['wa']),
  },
]

const WORLD_LOCATIONS = worldMap.locations as SvgMapLocation[]
const worldLocationById = new Map(WORLD_LOCATIONS.map((location) => [location.id, location]))
const worldTopology = worldAtlas as unknown as WorldTopology
const worldCollection = feature<QuizAreaProperties>(
  worldTopology,
  worldTopology.objects.countries,
) as FeatureCollection<GeometryObject, QuizAreaProperties>
const worldFeatureByName = new Map(
  worldCollection.features
    .map((worldFeature) => [normalizeAnswer(worldFeature.properties?.name ?? ''), worldFeature] as const)
    .filter(([name]) => Boolean(name)),
)

const COUNTRY_NAME_OVERRIDES: Partial<Record<string, string>> = {
  bn: 'Brunei',
  bq: 'Caribbean Netherlands',
  ci: 'Ivory Coast',
  cv: 'Cape Verde',
  cz: 'Czechia',
  la: 'Laos',
  mk: 'North Macedonia',
  ps: 'Palestine',
  sx: 'Sint Maarten',
  sz: 'Eswatini',
}

const COUNTRY_ALIASES: Partial<Record<string, string[]>> = {
  ae: ['UAE'],
  bn: ['Brunei Darussalam'],
  bq: ['Bonaire, Saint Eustatius and Saba', 'Bonaire, Sint Eustatius and Saba'],
  cd: ['DRC', 'Congo Kinshasa', 'Congo-Kinshasa'],
  cf: ['CAR'],
  ci: ["Cote d'Ivoire", 'Cote d Ivoire'],
  cg: ['Congo Brazzaville', 'Congo-Brazzaville'],
  cv: ['Cabo Verde'],
  do: ['DR'],
  cz: ['Czech Republic'],
  gb: ['UK', 'Britain', 'Great Britain'],
  la: ["Lao People's Democratic Republic"],
  mk: ['Macedonia'],
  mm: ['Burma'],
  ps: ['Palestinian Territories'],
  ru: ['Russian Federation'],
  sz: ['Swaziland'],
  tl: ['East Timor'],
  tr: ['Turkiye'],
  tw: ['Republic of China'],
  us: ['USA', 'United States of America', 'America'],
  va: ['Holy See', 'Vatican'],
}

const WORLD_ATLAS_NAME_ALIASES: Partial<Record<string, string[]>> = {
  ag: ['Antigua and Barb.'],
  ax: ['Aland'],
  ba: ['Bosnia and Herz.'],
  bl: ['St-Barthelemy', 'St-Barthélemy'],
  cd: ['Dem. Rep. Congo'],
  cf: ['Central African Rep.'],
  cg: ['Congo'],
  do: ['Dominican Rep.'],
  eh: ['W. Sahara'],
  fo: ['Faeroe Is.'],
  gq: ['Eq. Guinea'],
  kn: ['St. Kitts and Nevis'],
  ky: ['Cayman Is.'],
  mo: ['Macao'],
  mf: ['St-Martin'],
  mk: ['Macedonia'],
  pm: ['St. Pierre and Miquelon'],
  ss: ['S. Sudan'],
  st: ['São Tomé and Principe'],
  sx: ['Sint Maarten'],
  sz: ['eSwatini'],
  tc: ['Turks and Caicos Is.'],
  vc: ['St. Vin. and Gren.'],
  vg: ['British Virgin Is.'],
  vi: ['U.S. Virgin Is.'],
  xk: ['Kosovo'],
}

const WORLD_POINT_FEATURES: Partial<Record<string, [number, number]>> = {
  bq: [-68.25, 12.18],
  gi: [-5.35, 36.14],
  gp: [-61.55, 16.25],
  mq: [-61.02, 14.64],
  sj: [15.6, 78.2],
}

const ASIA_COUNTRY_IDS = [
  'ae',
  'af',
  'am',
  'az',
  'bd',
  'bh',
  'bn',
  'bt',
  'cn',
  'cy',
  'ge',
  'hk',
  'id',
  'il',
  'in',
  'iq',
  'ir',
  'jo',
  'jp',
  'kg',
  'kh',
  'kp',
  'kr',
  'kw',
  'kz',
  'la',
  'lb',
  'lk',
  'mm',
  'mn',
  'mo',
  'mv',
  'my',
  'np',
  'om',
  'ph',
  'pk',
  'ps',
  'qa',
  'ru',
  'sa',
  'sg',
  'sy',
  'th',
  'tj',
  'tl',
  'tm',
  'tr',
  'tw',
  'uz',
  'vn',
  'ye',
]

const AFRICA_COUNTRY_IDS = [
  'ao',
  'bf',
  'bi',
  'bj',
  'bw',
  'cd',
  'cf',
  'cg',
  'ci',
  'cm',
  'dj',
  'dz',
  'eg',
  'eh',
  'er',
  'et',
  'ga',
  'gh',
  'gm',
  'gn',
  'gq',
  'gw',
  'ke',
  'lr',
  'ls',
  'ly',
  'ma',
  'mg',
  'ml',
  'mr',
  'mw',
  'mz',
  'na',
  'ne',
  'ng',
  'rw',
  'sd',
  'sl',
  'sn',
  'so',
  'ss',
  'sz',
  'td',
  'tg',
  'tn',
  'tz',
  'ug',
  'za',
  'zm',
  'zw',
]

const NORTH_AMERICA_COUNTRY_IDS = [
  'bs',
  'bz',
  'ca',
  'cr',
  'cu',
  'do',
  'gl',
  'gt',
  'hn',
  'ht',
  'jm',
  'mx',
  'ni',
  'pa',
  'pr',
  'sv',
  'tt',
  'us',
]

const SOUTH_AMERICA_COUNTRY_IDS = [
  'ar',
  'bo',
  'br',
  'cl',
  'co',
  'ec',
  'fk',
  'gf',
  'gs',
  'gy',
  'pe',
  'py',
  'sr',
  'uy',
  've',
]

const EUROPE_COUNTRY_IDS = [
  'ad',
  'al',
  'at',
  'ax',
  'ba',
  'be',
  'bg',
  'by',
  'ch',
  'cz',
  'de',
  'dk',
  'ee',
  'es',
  'fi',
  'fo',
  'fr',
  'gb',
  'gg',
  'gi',
  'gr',
  'hr',
  'hu',
  'ie',
  'im',
  'is',
  'it',
  'je',
  'li',
  'lt',
  'lu',
  'lv',
  'mc',
  'md',
  'me',
  'mk',
  'mt',
  'nl',
  'no',
  'pl',
  'pt',
  'ro',
  'rs',
  'se',
  'si',
  'sj',
  'sk',
  'sm',
  'ua',
  'va',
  'xk',
]

function getCountryLabelFontSize(bounds: SvgPathBounds | undefined, abbreviation: string) {
  if (!bounds) {
    return 5
  }

  const width = Math.max(1, bounds.maxX - bounds.minX)
  const height = Math.max(1, bounds.maxY - bounds.minY)

  return Math.min(8.5, Math.max(2.8, Math.min(width / Math.max(1, abbreviation.length * 0.8), height * 0.56)))
}

function createPointFeature(name: string, coordinates: [number, number]): Feature<GeometryObject, QuizAreaProperties> {
  return {
    geometry: {
      coordinates,
      type: 'Point',
    },
    properties: { name },
    type: 'Feature',
  }
}

function getWorldFeature(id: string, names: string[]) {
  const atlasNames = [...names, ...(WORLD_ATLAS_NAME_ALIASES[id] ?? [])]

  for (const atlasName of atlasNames) {
    const atlasFeature = worldFeatureByName.get(normalizeAnswer(atlasName))

    if (atlasFeature) {
      return atlasFeature
    }
  }

  const pointCoordinates = WORLD_POINT_FEATURES[id]

  return pointCoordinates ? createPointFeature(names[0] ?? id.toUpperCase(), pointCoordinates) : undefined
}

function createWorldAreas(locationIds: string[], options: { useProjectedFeatures?: boolean } = {}) {
  return locationIds
    .map<QuizArea | undefined>((id) => {
      const location = worldLocationById.get(id)

      if (!location) {
        return undefined
      }

      const abbreviation = id.toUpperCase()
      const bounds = getSvgPathBounds(location.path)
      const pathScale = getWorldPathScale(bounds)
      const name = COUNTRY_NAME_OVERRIDES[id] ?? location.name
      const originalNameAliases = name === location.name ? [] : [location.name]
      const aliases = [...originalNameAliases, ...(COUNTRY_ALIASES[id] ?? [])]
      const areaFeature = options.useProjectedFeatures ? getWorldFeature(id, [name, location.name, ...aliases]) : undefined

      return {
        abbreviation,
        aliases,
        feature: areaFeature,
        id,
        labelFontSize: getCountryLabelFontSize(bounds, abbreviation),
        labelX: bounds ? (bounds.minX + bounds.maxX) / 2 : undefined,
        labelY: bounds ? (bounds.minY + bounds.maxY) / 2 : undefined,
        name,
        path: options.useProjectedFeatures
          ? undefined
          : bounds && pathScale > 1
            ? scaleSvgPath(location.path, bounds, pathScale)
            : location.path,
      }
    })
    .filter((area): area is QuizArea => Boolean(area))
}

const ASIA_COUNTRIES = createWorldAreas(ASIA_COUNTRY_IDS, { useProjectedFeatures: true })
const AFRICA_COUNTRIES = createWorldAreas(AFRICA_COUNTRY_IDS, { useProjectedFeatures: true })
const NORTH_AMERICA_COUNTRIES = createWorldAreas(NORTH_AMERICA_COUNTRY_IDS, { useProjectedFeatures: true })
const SOUTH_AMERICA_COUNTRIES = createWorldAreas(SOUTH_AMERICA_COUNTRY_IDS)
const EUROPE_COUNTRIES = createWorldAreas(EUROPE_COUNTRY_IDS, { useProjectedFeatures: true })

const NATO_PHONETIC_ALPHABET: QuizArea[] = [
  { abbreviation: 'A', aliases: ['Alpha'], id: 'a', name: 'Alfa' },
  { abbreviation: 'B', id: 'b', name: 'Bravo' },
  { abbreviation: 'C', id: 'c', name: 'Charlie' },
  { abbreviation: 'D', id: 'd', name: 'Delta' },
  { abbreviation: 'E', id: 'e', name: 'Echo' },
  { abbreviation: 'F', id: 'f', name: 'Foxtrot' },
  { abbreviation: 'G', id: 'g', name: 'Golf' },
  { abbreviation: 'H', id: 'h', name: 'Hotel' },
  { abbreviation: 'I', id: 'i', name: 'India' },
  { abbreviation: 'J', aliases: ['Juliet'], id: 'j', name: 'Juliett' },
  { abbreviation: 'K', id: 'k', name: 'Kilo' },
  { abbreviation: 'L', id: 'l', name: 'Lima' },
  { abbreviation: 'M', id: 'm', name: 'Mike' },
  { abbreviation: 'N', id: 'n', name: 'November' },
  { abbreviation: 'O', id: 'o', name: 'Oscar' },
  { abbreviation: 'P', id: 'p', name: 'Papa' },
  { abbreviation: 'Q', id: 'q', name: 'Quebec' },
  { abbreviation: 'R', id: 'r', name: 'Romeo' },
  { abbreviation: 'S', id: 's', name: 'Sierra' },
  { abbreviation: 'T', id: 't', name: 'Tango' },
  { abbreviation: 'U', id: 'u', name: 'Uniform' },
  { abbreviation: 'V', id: 'v', name: 'Victor' },
  { abbreviation: 'W', id: 'w', name: 'Whiskey' },
  { abbreviation: 'X', aliases: ['Xray', 'X Ray'], id: 'x', name: 'X-ray' },
  { abbreviation: 'Y', id: 'y', name: 'Yankee' },
  { abbreviation: 'Z', id: 'z', name: 'Zulu' },
]

const REGIONS_LIST: QuizRegion[] = [
  {
    acceptsAbbreviations: true,
    answerNoun: 'state',
    areas: US_STATES,
    eyebrow: 'US states',
    flag: '🇺🇸',
    id: 'us',
    label: 'United States',
    mapLabel: 'United States state map',
    pluralNoun: 'states',
    projection: 'albersUsa',
    shortLabel: 'USA',
    unitLabel: 'state',
    viewBox: '0 0 975 610',
  },
  {
    acceptsAbbreviations: true,
    answerNoun: 'state or territory',
    areas: AUSTRALIAN_STATES,
    eyebrow: 'Australian states and territories',
    flag: '🇦🇺',
    id: 'australia',
    label: 'Australia',
    mapLabel: 'Australia state and territory map',
    pluralNoun: 'states and territories',
    projection: 'svg',
    shortLabel: 'AUS',
    unitLabel: 'state or territory',
    viewBox: australiaMap.viewBox,
  },
  {
    acceptsAbbreviations: true,
    answerNoun: 'country or territory',
    areas: ASIA_COUNTRIES,
    eyebrow: 'Asia countries and territories',
    flag: '',
    id: 'asia',
    label: 'Asia',
    mapLabel: 'Asia countries and territories map',
    pluralNoun: 'countries and territories',
    projection: 'conicEqualArea',
    projectionCenter: [0, 36],
    projectionParallels: [20, 55],
    projectionRotate: [-95, 0],
    shortLabel: 'ASIA',
    unitLabel: 'country or territory',
    viewBox: '0 0 975 610',
  },
  {
    acceptsAbbreviations: true,
    answerNoun: 'country or territory',
    areas: AFRICA_COUNTRIES,
    eyebrow: 'Africa countries and territories',
    flag: '',
    id: 'africa',
    label: 'Africa',
    mapLabel: 'Africa countries and territories map',
    pluralNoun: 'countries and territories',
    projection: 'conicEqualArea',
    projectionCenter: [0, 1],
    projectionParallels: [0, 20],
    projectionRotate: [-20, 0],
    shortLabel: 'AFR',
    unitLabel: 'country or territory',
    viewBox: '0 0 975 610',
  },
  {
    acceptsAbbreviations: true,
    answerNoun: 'country or territory',
    areas: NORTH_AMERICA_COUNTRIES,
    eyebrow: 'North America countries and territories',
    flag: '',
    id: 'north-america',
    label: 'North America',
    mapLabel: 'North America countries and territories map',
    pluralNoun: 'countries and territories',
    projection: 'conicEqualArea',
    projectionCenter: [0, 46],
    projectionParallels: [24, 58],
    projectionRotate: [100, 0],
    shortLabel: 'N.AM',
    unitLabel: 'country or territory',
    viewBox: '0 0 975 610',
  },
  {
    acceptsAbbreviations: true,
    answerNoun: 'country or territory',
    areas: SOUTH_AMERICA_COUNTRIES,
    eyebrow: 'South America countries and territories',
    flag: '',
    id: 'south-america',
    label: 'South America',
    mapLabel: 'South America countries and territories map',
    pluralNoun: 'countries and territories',
    projection: 'svg',
    shortLabel: 'S.AM',
    unitLabel: 'country or territory',
    viewBox: getSvgViewBox(SOUTH_AMERICA_COUNTRIES, worldMap.viewBox),
  },
  {
    acceptsAbbreviations: true,
    answerNoun: 'country or territory',
    areas: EUROPE_COUNTRIES,
    eyebrow: 'Europe countries and territories',
    flag: '',
    id: 'europe',
    label: 'Europe',
    mapLabel: 'Europe countries and territories map',
    pluralNoun: 'countries and territories',
    projection: 'conicConformal',
    projectionCenter: [0, 53],
    projectionParallels: [35, 65],
    projectionRotate: [-15, 0],
    shortLabel: 'EUR',
    unitLabel: 'country or territory',
    viewBox: '0 0 975 610',
  },
  {
    acceptsAbbreviations: false,
    answerNoun: 'code word',
    areas: NATO_PHONETIC_ALPHABET,
    eyebrow: 'NATO phonetic alphabet',
    flag: '',
    id: 'nato',
    label: 'NATO phonetic alphabet',
    mapLabel: 'NATO phonetic alphabet trainer',
    pluralNoun: 'code words',
    projection: 'cards',
    shortLabel: 'NATO',
    unitLabel: 'letter',
    viewBox: '',
  },
]

export const QUIZ_REGIONS = Object.fromEntries(REGIONS_LIST.map((region) => [region.id, region])) as Record<
  RegionId,
  QuizRegion
>

export const REGION_OPTIONS = REGIONS_LIST.map(({ flag, id, label, shortLabel }) => ({ flag, id, label, shortLabel }))

const MIN_SHORT_NAME_LENGTH = 3

function getUniqueShortNameAliases(areas: QuizArea[]) {
  const prefixOwners = new Map<string, Set<string>>()

  areas.forEach((area) => {
    const answerSources = [area.name, ...(area.aliases ?? [])]

    answerSources.forEach((answer) => {
      const normalizedAnswer = normalizeAnswer(answer)

      for (let length = MIN_SHORT_NAME_LENGTH; length < normalizedAnswer.length; length += 1) {
        const prefix = normalizedAnswer.slice(0, length)
        const owners = prefixOwners.get(prefix) ?? new Set<string>()
        owners.add(area.id)
        prefixOwners.set(prefix, owners)
      }
    })
  })

  return new Map(
    areas.map((area) => {
      const aliases = new Set<string>()
      const answerSources = [area.name, ...(area.aliases ?? [])]

      answerSources.forEach((answer) => {
        const normalizedAnswer = normalizeAnswer(answer)

        for (let length = MIN_SHORT_NAME_LENGTH; length < normalizedAnswer.length; length += 1) {
          const prefix = normalizedAnswer.slice(0, length)
          const owners = prefixOwners.get(prefix)

          if (owners?.size === 1 && owners.has(area.id)) {
            aliases.add(prefix)
          }
        }
      })

      return [area.id, [...aliases]] as const
    }),
  )
}

const answerMapsByRegion = new Map(
  REGIONS_LIST.map((region) => {
    const shortNameAliases =
      region.unitLabel === 'country or territory' ? getUniqueShortNameAliases(region.areas) : new Map<string, string[]>()

    return [
      region.id,
      new Map(
        region.areas.flatMap((area) => [
          [normalizeAnswer(area.name), area],
          ...(area.aliases ?? []).map((alias) => [normalizeAnswer(alias), area] as const),
          ...(shortNameAliases.get(area.id) ?? []).map((alias) => [alias, area] as const),
          ...(region.acceptsAbbreviations ? [[normalizeAnswer(area.abbreviation), area] as const] : []),
        ]),
      ),
    ] as const
  }),
)

const areaNamesByRegion = new Map(
  REGIONS_LIST.map((region) => [
    region.id,
    region.areas.map((area) => ({
      area,
      normalizedName: normalizeAnswer(area.name),
    })),
  ]),
)

export function findAreaByAnswer(region: QuizRegion, answer: string) {
  const normalizedAnswer = normalizeAnswer(answer.trim())
  const exactMatch = answerMapsByRegion.get(region.id)?.get(normalizedAnswer)

  if (exactMatch) {
    return exactMatch
  }

  const allowedMisspellings = getAllowedMisspellings(normalizedAnswer)

  if (allowedMisspellings === 0) {
    return undefined
  }

  const matches = (areaNamesByRegion.get(region.id) ?? [])
    .map(({ area, normalizedName }) => ({
      area,
      distance: getEditDistance(normalizedAnswer, normalizedName),
    }))
    .filter((match) => match.distance <= allowedMisspellings)
    .sort((a, b) => a.distance - b.distance)

  if (matches.length === 0 || (matches[1] && matches[1].distance === matches[0].distance)) {
    return undefined
  }

  return matches[0].area
}
