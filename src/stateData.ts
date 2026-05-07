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

export function findStateByAnswer(answer: string) {
  return stateByAnswer.get(normalizeAnswer(answer.trim()))
}
