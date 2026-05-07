import type { Feature, FeatureCollection, GeometryObject } from 'geojson'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import statesAtlas from 'us-atlas/states-10m.json'

type StateProperties = {
  name?: string
}

type StateTopology = Topology<{
  states: GeometryCollection<StateProperties>
}>

export type UsState = {
  abbreviation: string
  feature: Feature<GeometryObject, StateProperties>
  id: string
  name: string
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

export const US_STATES: UsState[] = stateCollection.features
  .reduce<UsState[]>((states, stateFeature) => {
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

export const STATE_COUNT = US_STATES.length
export const stateById = new Map(US_STATES.map((state) => [state.id, state]))

const stateByAnswer = new Map(
  US_STATES.flatMap((state) => [
    [normalizeAnswer(state.name), state],
    [normalizeAnswer(state.abbreviation), state],
  ]),
)

const stateNamesByAnswer = US_STATES.map((state) => ({
  normalizedName: normalizeAnswer(state.name),
  state,
}))

export function findStateByAnswer(answer: string) {
  const normalizedAnswer = normalizeAnswer(answer.trim())
  const exactMatch = stateByAnswer.get(normalizedAnswer)

  if (exactMatch) {
    return exactMatch
  }

  const allowedMisspellings = getAllowedMisspellings(normalizedAnswer)

  if (allowedMisspellings === 0) {
    return undefined
  }

  const matches = stateNamesByAnswer
    .map(({ normalizedName, state }) => ({
      distance: getEditDistance(normalizedAnswer, normalizedName),
      state,
    }))
    .filter((match) => match.distance <= allowedMisspellings)
    .sort((a, b) => a.distance - b.distance)

  if (matches.length === 0 || (matches[1] && matches[1].distance === matches[0].distance)) {
    return undefined
  }

  return matches[0].state
}
