import { CheckCircle2, Keyboard, MapPinned, RotateCcw, Shuffle, Timer, Trophy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import type { FeatureCollection, GeometryObject } from 'geojson'
import './App.css'
import { findStateByAnswer, stateById, STATE_COUNT, US_STATES } from './stateData'

type QuizMode = 'guess' | 'fill'
type AnswerStatus = 'idle' | 'correct' | 'wrong' | 'repeat'

const MAP_WIDTH = 975
const MAP_HEIGHT = 610

type StateShape = {
  abbreviation: string
  d: string
  fontSize: number
  id: string
  label: string
  name: string
  x: number
  y: number
}

const stateIds = US_STATES.map((state) => state.id)

function chooseRandomStateId(excludeId?: string) {
  const candidates = stateIds.filter((id) => id !== excludeId)
  return candidates[Math.floor(Math.random() * candidates.length)]
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function buildStateShapes() {
  const collection = {
    type: 'FeatureCollection',
    features: US_STATES.map((state) => state.feature),
  } satisfies FeatureCollection<GeometryObject>

  const projection = geoAlbersUsa().fitExtent(
    [
      [14, 14],
      [MAP_WIDTH - 14, MAP_HEIGHT - 14],
    ],
    collection,
  )
  const path = geoPath(projection)

  return US_STATES.map<StateShape>((state) => {
    const d = path(state.feature) ?? ''
    const [min, max] = path.bounds(state.feature)
    const [x, y] = path.centroid(state.feature)
    const width = Math.max(1, max[0] - min[0])
    const height = Math.max(1, max[1] - min[1])
    const fullNameSize = Math.min(9.5, width / Math.max(1, state.name.length * 0.54), height * 0.42)
    const useFullName = fullNameSize >= 4.7 && width > 32 && height > 12
    const label = useFullName ? state.name : state.abbreviation
    const fontSize = useFullName ? fullNameSize : Math.min(8, Math.max(4.6, Math.min(width / 1.7, height * 0.68)))

    return {
      abbreviation: state.abbreviation,
      d,
      fontSize,
      id: state.id,
      label,
      name: state.name,
      x,
      y,
    }
  })
}

function App() {
  const stateShapes = useMemo(() => buildStateShapes(), [])
  const [mode, setMode] = useState<QuizMode>('guess')
  const [targetId, setTargetId] = useState(chooseRandomStateId)
  const [guessInput, setGuessInput] = useState('')
  const [guessStatus, setGuessStatus] = useState<AnswerStatus>('idle')
  const [guessMessage, setGuessMessage] = useState('Ready')
  const [guessAttempts, setGuessAttempts] = useState(0)
  const [guessCorrect, setGuessCorrect] = useState(0)
  const [fillInput, setFillInput] = useState('')
  const [fillStatus, setFillStatus] = useState<AnswerStatus>('idle')
  const [fillMessage, setFillMessage] = useState('Ready')
  const [filledStateIds, setFilledStateIds] = useState<string[]>([])
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const targetState = stateById.get(targetId) ?? US_STATES[0]
  const filledSet = useMemo(() => new Set(filledStateIds), [filledStateIds])
  const isFillComplete = mode === 'fill' && filledStateIds.length === STATE_COUNT

  useEffect(() => {
    if (isFillComplete) {
      return
    }

    const timerId = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1)
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [isFillComplete, mode])

  function resetTimer() {
    setElapsedSeconds(0)
  }

  function resetGuess(nextTargetId = chooseRandomStateId(targetId)) {
    setTargetId(nextTargetId)
    setGuessInput('')
    setGuessStatus('idle')
    setGuessMessage('Ready')
  }

  function resetFill() {
    setFillInput('')
    setFillStatus('idle')
    setFillMessage('Ready')
    setFilledStateIds([])
  }

  function resetGame(nextMode = mode) {
    resetTimer()

    if (nextMode === 'guess') {
      resetGuess(chooseRandomStateId(targetId))
    } else {
      resetFill()
    }
  }

  function changeMode(nextMode: QuizMode) {
    setMode(nextMode)
    resetGame(nextMode)
  }

  function handleGuessSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const matchedState = findStateByAnswer(guessInput)
    const trimmedAnswer = guessInput.trim()

    if (!trimmedAnswer || !matchedState) {
      setGuessStatus('wrong')
      setGuessMessage(trimmedAnswer ? `${trimmedAnswer} is not a state` : 'Try a state')
      return
    }

    setGuessAttempts((attempts) => attempts + 1)

    if (matchedState.id === targetId) {
      setGuessStatus('correct')
      setGuessMessage(matchedState.name)
      setGuessCorrect((score) => score + 1)
      return
    }

    setGuessStatus('wrong')
    setGuessMessage(trimmedAnswer)
  }

  function handleFillSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const matchedState = findStateByAnswer(fillInput)
    const trimmedAnswer = fillInput.trim()

    if (!trimmedAnswer || !matchedState) {
      setFillStatus('wrong')
      setFillMessage(trimmedAnswer ? `${trimmedAnswer} is not a state` : 'Try a state')
      return
    }

    if (filledSet.has(matchedState.id)) {
      setFillStatus('repeat')
      setFillMessage(`${matchedState.name} is already filled`)
      setFillInput('')
      return
    }

    const nextFilledIds = [...filledStateIds, matchedState.id]
    setFilledStateIds(nextFilledIds)
    setFillStatus('correct')
    setFillMessage(matchedState.name)
    setFillInput('')

    if (nextFilledIds.length === STATE_COUNT) {
      setFillMessage(`Finished in ${formatTime(elapsedSeconds)}`)
    }
  }

  function nextGuessState() {
    resetGuess()
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">US states</p>
          <h1>Map Quiz</h1>
        </div>

        <div className="mode-switch" aria-label="Quiz mode">
          <button className={mode === 'guess' ? 'active' : ''} type="button" onClick={() => changeMode('guess')}>
            <MapPinned aria-hidden="true" />
            Highlight
          </button>
          <button className={mode === 'fill' ? 'active' : ''} type="button" onClick={() => changeMode('fill')}>
            <Keyboard aria-hidden="true" />
            Type
          </button>
        </div>
      </header>

      <section className="score-strip" aria-label="Quiz stats">
        <div>
          <Timer aria-hidden="true" />
          <span>{formatTime(elapsedSeconds)}</span>
        </div>
        {mode === 'guess' ? (
          <>
            <div>
              <CheckCircle2 aria-hidden="true" />
              <span>{guessCorrect} correct</span>
            </div>
            <div>
              <Trophy aria-hidden="true" />
              <span>{guessAttempts} guesses</span>
            </div>
          </>
        ) : (
          <>
            <div>
              <CheckCircle2 aria-hidden="true" />
              <span>
                {filledStateIds.length}/{STATE_COUNT}
              </span>
            </div>
            <div>
              <Trophy aria-hidden="true" />
              <span>{STATE_COUNT - filledStateIds.length} left</span>
            </div>
          </>
        )}
      </section>

      <section className="game-layout">
        <div className="map-stage" aria-label="United States map">
          <svg className={`us-map ${mode}`} role="img" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}>
            <title>United States state map</title>
            {stateShapes.map((shape) => {
              const isTarget = mode === 'guess' && shape.id === targetId
              const isFilled = mode === 'fill' && filledSet.has(shape.id)
              const stateClassName = [
                'state-shape',
                isTarget ? 'target' : '',
                isFilled ? 'filled' : '',
                isTarget && guessStatus === 'correct' ? 'correct-target' : '',
                isTarget && guessStatus === 'wrong' ? 'wrong-target' : '',
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <path key={shape.id} aria-label={shape.name} className={stateClassName} d={shape.d}>
                  <title>{shape.name}</title>
                </path>
              )
            })}

            {stateShapes.map((shape) => {
              const showLabel = mode === 'fill' && filledSet.has(shape.id)

              if (!showLabel) {
                return null
              }

              return (
                <text
                  key={`${shape.id}-label`}
                  className="state-label"
                  dominantBaseline="middle"
                  fontSize={shape.fontSize}
                  textAnchor="middle"
                  x={shape.x}
                  y={shape.y}
                >
                  {shape.label}
                </text>
              )
            })}
          </svg>
        </div>

        <aside className="quiz-panel">
          {mode === 'guess' ? (
            <>
              <div className="prompt-block">
                <p className="panel-kicker">Highlighted state</p>
                <h2>{guessStatus === 'correct' ? targetState.name : 'Name it'}</h2>
              </div>

              <form className="answer-form" onSubmit={handleGuessSubmit}>
                <label className="sr-only" htmlFor="guess-input">
                  State name
                </label>
                <input
                  autoComplete="off"
                  autoFocus
                  className={guessStatus}
                  id="guess-input"
                  onChange={(event) => {
                    setGuessInput(event.target.value)
                    setGuessStatus('idle')
                  }}
                  placeholder="State name"
                  value={guessInput}
                />
                <button type="submit">Guess</button>
              </form>

              <p className={`feedback ${guessStatus}`}>{guessMessage}</p>

              <div className="panel-actions">
                <button type="button" onClick={nextGuessState}>
                  <Shuffle aria-hidden="true" />
                  Next
                </button>
                <button type="button" onClick={() => resetGame('guess')}>
                  <RotateCcw aria-hidden="true" />
                  Reset
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="prompt-block">
                <p className="panel-kicker">Blank map</p>
                <h2>{isFillComplete ? 'Complete' : 'Fill it'}</h2>
              </div>

              <form className="answer-form" onSubmit={handleFillSubmit}>
                <label className="sr-only" htmlFor="fill-input">
                  State name
                </label>
                <input
                  autoComplete="off"
                  autoFocus
                  className={fillStatus}
                  id="fill-input"
                  onChange={(event) => {
                    setFillInput(event.target.value)
                    setFillStatus('idle')
                  }}
                  placeholder="State name"
                  value={fillInput}
                />
                <button disabled={isFillComplete} type="submit">
                  Add
                </button>
              </form>

              <p className={`feedback ${fillStatus}`}>{fillMessage}</p>

              <div className="found-list" aria-label="Filled states">
                {US_STATES.map((state) => (
                  <span className={filledSet.has(state.id) ? 'found' : ''} key={state.id}>
                    {filledSet.has(state.id) ? state.name : state.abbreviation}
                  </span>
                ))}
              </div>

              <div className="panel-actions">
                <button type="button" onClick={() => resetGame('fill')}>
                  <RotateCcw aria-hidden="true" />
                  Reset
                </button>
              </div>
            </>
          )}
        </aside>
      </section>
    </main>
  )
}

export default App
