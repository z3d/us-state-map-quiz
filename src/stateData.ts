import type { Feature, FeatureCollection, GeometryObject } from 'geojson'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import australiaMap from '@svg-maps/australia'
import statesAtlas from 'us-atlas/states-10m.json'

type StateProperties = {
  name?: string
}

type StateTopology = Topology<{
  states: GeometryCollection<StateProperties>
}>

export type RegionId = 'australia' | 'nato' | 'us'

export type QuizArea = {
  abbreviation: string
  aliases?: string[]
  feature?: Feature<GeometryObject, StateProperties>
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
  projection: 'albersUsa' | 'cards' | 'svg'
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
const stateCollection = feature<StateProperties>(topology, topology.objects.states) as FeatureCollection<GeometryObject, StateProperties>

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

const answerMapsByRegion = new Map(
  REGIONS_LIST.map((region) => [
      region.id,
      new Map(
      region.areas.flatMap((area) => [
        [normalizeAnswer(area.name), area],
        ...(area.aliases ?? []).map((alias) => [normalizeAnswer(alias), area] as const),
        ...(region.acceptsAbbreviations ? [[normalizeAnswer(area.abbreviation), area] as const] : []),
      ]),
    ),
  ]),
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
