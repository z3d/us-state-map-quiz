import { CheckCircle2, Eye, Keyboard, MapPinned, RotateCcw, Timer, Trophy } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import type { FeatureCollection, GeometryObject } from 'geojson'
import './App.css'
import {
  findAreaByAnswer,
  QUIZ_REGIONS,
  REGION_OPTIONS,
  type QuizArea,
  type QuizRegion,
  type RegionId,
} from './stateData'

type QuizMode = 'guess' | 'fill'
type AnswerStatus = 'idle' | 'correct' | 'wrong' | 'repeat'
type GuessResult = 'correct' | 'wrong'
type GuessResultsById = Partial<Record<string, GuessResult>>

const MAP_WIDTH = 975
const MAP_HEIGHT = 610
const MAP_REGION_OPTIONS = REGION_OPTIONS.filter((option) => option.id !== 'nato')
const MEMORY_REGION_OPTIONS = REGION_OPTIONS.filter((option) => option.id === 'nato')

type AreaShape = {
  abbreviation: string
  d: string
  fontSize: number
  id: string
  label: string
  name: string
  x: number
  y: number
}

function chooseRandomAreaId(areas: QuizArea[], excludeId?: string, unavailableIds: string[] = []) {
  const areaIds = areas.map((area) => area.id)
  const unavailableSet = new Set(unavailableIds)
  const candidates = areaIds.filter((id) => id !== excludeId && !unavailableSet.has(id))
  const fallbackCandidates = areaIds.filter((id) => !unavailableSet.has(id))
  const pool = candidates.length > 0 ? candidates : fallbackCandidates

  if (pool.length === 0) {
    return excludeId ?? areaIds[0] ?? ''
  }

  return pool[Math.floor(Math.random() * pool.length)]
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function getResultPhrase(score: number, total: number) {
  const percent = total === 0 ? 0 : score / total

  if (percent === 1) {
    return 'Perfect run. Every answer landed.'
  }

  if (percent >= 0.9) {
    return 'Excellent finish. That memory is seriously sharp.'
  }

  if (percent >= 0.8) {
    return 'Strong score. A quick review pass will tighten the last few.'
  }

  if (percent >= 0.6) {
    return 'Nice work. The misses are a clean little practice list now.'
  }

  if (percent >= 0.4) {
    return 'Good reps. You found a real foothold, and it gets easier from here.'
  }

  return 'Fresh start energy. Every miss just pointed to what to learn next.'
}

function buildAreaShapes(region: QuizRegion) {
  if (region.projection === 'cards') {
    return []
  }

  if (region.projection === 'svg') {
    return region.areas.map<AreaShape>((area) => ({
      abbreviation: area.abbreviation,
      d: area.path ?? '',
      fontSize: area.labelFontSize ?? 7,
      id: area.id,
      label: area.abbreviation,
      name: area.name,
      x: area.labelX ?? 0,
      y: area.labelY ?? 0,
    }))
  }

  const collection = {
    type: 'FeatureCollection',
    features: region.areas.map((area) => area.feature).filter(Boolean),
  } as FeatureCollection<GeometryObject>

  const projection = geoAlbersUsa().fitExtent(
    [
      [14, 14],
      [MAP_WIDTH - 14, MAP_HEIGHT - 14],
    ],
    collection,
  )
  const path = geoPath(projection)

  return region.areas.map<AreaShape>((area) => {
    const areaFeature = area.feature

    if (!areaFeature) {
      return {
        abbreviation: area.abbreviation,
        d: '',
        fontSize: area.labelFontSize ?? 7,
        id: area.id,
        label: area.abbreviation,
        name: area.name,
        x: area.labelX ?? 0,
        y: area.labelY ?? 0,
      }
    }

    const d = path(areaFeature) ?? ''
    const [min, max] = path.bounds(areaFeature)
    const [x, y] = path.centroid(areaFeature)
    const width = Math.max(1, max[0] - min[0])
    const height = Math.max(1, max[1] - min[1])
    const fullNameSize = Math.min(9.5, width / Math.max(1, area.name.length * 0.54), height * 0.42)
    const useFullName = fullNameSize >= 4.7 && width > 32 && height > 12
    const label = useFullName ? area.name : area.abbreviation
    const fontSize = useFullName ? fullNameSize : Math.min(8, Math.max(4.6, Math.min(width / 1.7, height * 0.68)))

    return {
      abbreviation: area.abbreviation,
      d,
      fontSize,
      id: area.id,
      label,
      name: area.name,
      x,
      y,
    }
  })
}

function App() {
  const fillInputRef = useRef<HTMLInputElement>(null)
  const guessInputRef = useRef<HTMLInputElement>(null)
  const lastPointerSubmitAtRef = useRef(0)
  const [regionId, setRegionId] = useState<RegionId>('us')
  const region = QUIZ_REGIONS[regionId]
  const areaById = useMemo(() => new Map(region.areas.map((area) => [area.id, area])), [region])
  const areaCount = region.areas.length
  const areaShapes = useMemo(() => buildAreaShapes(region), [region])
  const [mode, setMode] = useState<QuizMode>('guess')
  const [targetId, setTargetId] = useState(() => chooseRandomAreaId(QUIZ_REGIONS.us.areas))
  const [guessInput, setGuessInput] = useState('')
  const [guessStatus, setGuessStatus] = useState<AnswerStatus>('idle')
  const [guessMessage, setGuessMessage] = useState('Ready')
  const [guessResultsById, setGuessResultsById] = useState<GuessResultsById>({})
  const [fillInput, setFillInput] = useState('')
  const [fillStatus, setFillStatus] = useState<AnswerStatus>('idle')
  const [fillMessage, setFillMessage] = useState('Ready')
  const [filledStateIds, setFilledStateIds] = useState<string[]>([])
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [hoveredStateId, setHoveredStateId] = useState<string | null>(null)
  const [isReviewingMap, setIsReviewingMap] = useState(false)
  const [isResultModalOpen, setIsResultModalOpen] = useState(false)

  const targetArea = areaById.get(targetId) ?? region.areas[0]
  const guessResultValues = Object.values(guessResultsById)
  const guessTurns = guessResultValues.length
  const guessCorrect = guessResultValues.filter((result) => result === 'correct').length
  const filledSet = useMemo(() => new Set(filledStateIds), [filledStateIds])
  const isGuessComplete = guessTurns === areaCount
  const isFillComplete = filledStateIds.length === areaCount
  const isCurrentModeComplete = mode === 'guess' ? isGuessComplete : isFillComplete
  const resultScore = mode === 'guess' ? guessCorrect : filledStateIds.length
  const resultPhrase = getResultPhrase(resultScore, areaCount)
  const isCardRegion = region.projection === 'cards'
  const isContinentRegion = region.unitLabel === 'country or territory'
  const answerLabel = isCardRegion
    ? 'Code word'
    : isContinentRegion
      ? 'Country or territory name'
      : region.id === 'australia'
        ? 'State or territory name'
        : 'State name'
  const hoveredAreaName = hoveredStateId ? areaById.get(hoveredStateId)?.name : undefined
  const resultKicker = mode === 'guess' ? 'Final score' : isCardRegion ? 'List complete' : 'Map complete'
  const reviewButtonLabel = isCardRegion ? 'Review List' : 'Show Map'

  useEffect(() => {
    if (isCurrentModeComplete) {
      return
    }

    const timerId = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1)
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [isCurrentModeComplete, mode])

  useEffect(() => {
    if (isCurrentModeComplete) {
      return
    }

    const input = mode === 'guess' ? guessInputRef.current : fillInputRef.current

    if (!input) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      const scrollX = window.scrollX
      const scrollY = window.scrollY

      input.focus({ preventScroll: true })

      if (window.matchMedia('(pointer: coarse)').matches) {
        input.setSelectionRange(input.value.length, input.value.length)
      } else {
        input.select()
      }

      window.scrollTo(scrollX, scrollY)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [filledStateIds.length, isCurrentModeComplete, mode, targetId])

  function requestButtonSubmit(button: HTMLButtonElement | null) {
    const form = button?.form

    if (!form) {
      return
    }

    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit()
      return
    }

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  }

  function submitWithoutBlurringInput(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    lastPointerSubmitAtRef.current = window.performance.now()
    requestButtonSubmit(event.currentTarget)
  }

  function submitFromKeyboardClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (window.performance.now() - lastPointerSubmitAtRef.current < 500) {
      return
    }

    requestButtonSubmit(event.currentTarget)
  }

  function submitOnEnter(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
      return
    }

    event.preventDefault()
    requestButtonSubmit(event.currentTarget.nextElementSibling as HTMLButtonElement | null)
  }

  function resetTimer() {
    setElapsedSeconds(0)
  }

  function resetGuessGame(nextRegion = region, nextTargetId = chooseRandomAreaId(nextRegion.areas, targetId)) {
    setHoveredStateId(null)
    setIsResultModalOpen(false)
    setIsReviewingMap(false)
    setGuessResultsById({})
    setTargetId(nextTargetId)
    setGuessInput('')
    setGuessStatus('idle')
    setGuessMessage('Ready')
  }

  function resetFill() {
    setHoveredStateId(null)
    setIsResultModalOpen(false)
    setIsReviewingMap(false)
    setFillInput('')
    setFillStatus('idle')
    setFillMessage('Ready')
    setFilledStateIds([])
  }

  function resetGame(nextMode = mode, nextRegion = region) {
    resetTimer()

    if (nextMode === 'guess') {
      resetGuessGame(nextRegion, chooseRandomAreaId(nextRegion.areas, targetId))
    } else {
      resetFill()
    }
  }

  function changeMode(nextMode: QuizMode) {
    setMode(nextMode)
    resetGame(nextMode, region)
  }

  function changeRegion(nextRegionId: RegionId) {
    const nextRegion = QUIZ_REGIONS[nextRegionId]
    setRegionId(nextRegionId)
    resetGame(mode, nextRegion)
  }

  function showCompletedMap() {
    setIsResultModalOpen(false)
    setIsReviewingMap(true)
    setHoveredStateId(null)
  }

  function finishGuessTurn(result: GuessResult, message: string) {
    const nextResults = { ...guessResultsById, [targetId]: result }
    const nextTurnCount = Object.keys(nextResults).length

    setGuessResultsById(nextResults)
    setGuessInput('')
    setGuessStatus(result)
    setGuessMessage(nextTurnCount === areaCount ? `Finished: ${message}` : message)

    if (nextTurnCount < areaCount) {
      setTargetId(chooseRandomAreaId(region.areas, targetId, Object.keys(nextResults)))
    } else {
      setIsResultModalOpen(true)
    }
  }

  function handleGuessSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const matchedArea = findAreaByAnswer(region, guessInput)
    const trimmedAnswer = guessInput.trim()

    if (!trimmedAnswer) {
      setGuessStatus('wrong')
      setGuessMessage(`Try a ${region.answerNoun}`)
      return
    }

    if (matchedArea?.id === targetId) {
      finishGuessTurn('correct', `Correct: ${matchedArea.name}`)
      return
    }

    finishGuessTurn('wrong', `${targetArea.name}, not ${trimmedAnswer}`)
  }

  function handleFillSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const matchedArea = findAreaByAnswer(region, fillInput)
    const trimmedAnswer = fillInput.trim()

    if (!trimmedAnswer || !matchedArea) {
      setFillStatus('wrong')
      setFillMessage(trimmedAnswer ? `${trimmedAnswer} is not a ${region.answerNoun}` : `Try a ${region.answerNoun}`)
      return
    }

    if (filledSet.has(matchedArea.id)) {
      setFillStatus('repeat')
      setFillMessage(`${matchedArea.name} is already filled`)
      setFillInput('')
      return
    }

    const nextFilledIds = [...filledStateIds, matchedArea.id]
    setFilledStateIds(nextFilledIds)
    setFillStatus('correct')
    setFillMessage(matchedArea.name)
    setFillInput('')

    if (nextFilledIds.length === areaCount) {
      setFillMessage(`Finished in ${formatTime(elapsedSeconds)}`)
      setIsResultModalOpen(true)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="title-block">
          <div className="title-copy">
            <p className="eyebrow">{region.eyebrow}</p>
            <h1>Memory Quiz</h1>
          </div>

          <div className="training-switch" aria-label="Training set">
            <div className="training-group">
              <span className="training-group-label">Maps</span>
              <div className="region-switch">
                {MAP_REGION_OPTIONS.map((option) => (
                  <button
                    aria-label={option.label}
                    className={regionId === option.id ? 'active' : ''}
                    key={option.id}
                    title={option.label}
                    type="button"
                    onClick={() => changeRegion(option.id)}
                  >
                    {option.flag ? (
                      <span className="region-flag" aria-hidden="true">
                        {option.flag}
                      </span>
                    ) : null}
                    <span>{option.shortLabel}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="training-group memory-group">
              <span className="training-group-label">Memory</span>
              <div className="region-switch">
                {MEMORY_REGION_OPTIONS.map((option) => (
                  <button
                    aria-label={option.label}
                    className={regionId === option.id ? 'active' : ''}
                    key={option.id}
                    title={option.label}
                    type="button"
                    onClick={() => changeRegion(option.id)}
                  >
                    <span>{option.shortLabel}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="topbar-controls">
          <div className="mode-switch" aria-label="Quiz mode">
            <button className={mode === 'guess' ? 'active' : ''} type="button" onClick={() => changeMode('guess')}>
              <MapPinned aria-hidden="true" />
              Name
            </button>
            <button className={mode === 'fill' ? 'active' : ''} type="button" onClick={() => changeMode('fill')}>
              <Keyboard aria-hidden="true" />
              List
            </button>
          </div>
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
              <span>
                Score {guessCorrect}/{guessTurns}
              </span>
            </div>
            <div>
              <Trophy aria-hidden="true" />
              <span>{areaCount - guessTurns} left</span>
            </div>
          </>
        ) : (
          <>
            <div>
              <CheckCircle2 aria-hidden="true" />
              <span>
                {filledStateIds.length}/{areaCount}
              </span>
            </div>
            <div>
              <Trophy aria-hidden="true" />
              <span>{areaCount - filledStateIds.length} left</span>
            </div>
          </>
        )}
      </section>

      <section className="game-layout">
        <div className={`map-stage ${isCardRegion ? 'memory-stage' : ''}`} aria-label={region.mapLabel}>
          {isCardRegion ? (
            <div className={`memory-board ${mode} ${isReviewingMap ? 'reviewing' : ''}`} role="list">
              {region.areas.map((area) => {
                const guessResult = mode === 'guess' ? guessResultsById[area.id] : undefined
                const isTarget = mode === 'guess' && area.id === targetId && !guessResult && !isGuessComplete
                const isFilled = mode === 'fill' && filledSet.has(area.id)
                const isHovered = isReviewingMap && hoveredStateId === area.id
                const showWord = Boolean(guessResult || isFilled || isReviewingMap)
                const cardClassName = [
                  'memory-card',
                  isTarget ? 'target' : '',
                  guessResult === 'correct' ? 'guessed-correct' : '',
                  guessResult === 'wrong' ? 'guessed-wrong' : '',
                  isFilled ? 'filled' : '',
                  isHovered ? 'hovered' : '',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <div
                    aria-label={`${area.abbreviation} ${showWord ? area.name : ''}`.trim()}
                    className={cardClassName}
                    key={area.id}
                    onBlur={() => setHoveredStateId(null)}
                    onClick={() => setHoveredStateId(area.id)}
                    onFocus={() => setHoveredStateId(area.id)}
                    onMouseEnter={() => setHoveredStateId(area.id)}
                    onMouseLeave={() => setHoveredStateId(null)}
                    role="listitem"
                    tabIndex={isReviewingMap ? 0 : undefined}
                  >
                    <span className="memory-letter">{area.abbreviation}</span>
                    <span className="memory-word">{showWord ? area.name : ''}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <svg
              className={`quiz-map ${region.id}-map ${isContinentRegion ? 'continent-map' : ''} ${mode} ${
                isReviewingMap ? 'reviewing' : ''
              }`}
              role="img"
              viewBox={region.viewBox}
            >
              <title>{region.mapLabel}</title>
              {areaShapes.map((shape) => {
                const guessResult = mode === 'guess' ? guessResultsById[shape.id] : undefined
                const isTarget = mode === 'guess' && shape.id === targetId && !guessResult && !isGuessComplete
                const isFilled = mode === 'fill' && filledSet.has(shape.id)
                const isHovered = isReviewingMap && hoveredStateId === shape.id
                const stateClassName = [
                  'state-shape',
                  isTarget ? 'target' : '',
                  guessResult === 'correct' ? 'guessed-correct' : '',
                  guessResult === 'wrong' ? 'guessed-wrong' : '',
                  isFilled ? 'filled' : '',
                  isHovered ? 'hovered' : '',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <path
                    key={shape.id}
                    aria-label={shape.name}
                    className={stateClassName}
                    d={shape.d}
                    onBlur={() => setHoveredStateId(null)}
                    onClick={() => setHoveredStateId(shape.id)}
                    onFocus={() => setHoveredStateId(shape.id)}
                    onMouseEnter={() => setHoveredStateId(shape.id)}
                    onMouseLeave={() => setHoveredStateId(null)}
                    tabIndex={isReviewingMap ? 0 : undefined}
                  >
                    {isReviewingMap ? <title>{shape.name}</title> : null}
                  </path>
                )
              })}

              {areaShapes.map((shape) => {
                const isReviewLabel = isReviewingMap && hoveredStateId === shape.id
                const showLabel = (mode === 'fill' && filledSet.has(shape.id)) || isReviewLabel

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
                    {isReviewLabel ? shape.name : shape.label}
                  </text>
                )
              })}
            </svg>
          )}
          {isReviewingMap && hoveredAreaName ? <div className="map-hover-label">{hoveredAreaName}</div> : null}
        </div>

        <aside className="quiz-panel">
          {mode === 'guess' ? (
            <>
              <div className="prompt-block">
                <p className="panel-kicker">{isCardRegion ? 'Prompt letter' : `Highlighted ${region.unitLabel}`}</p>
                <h2>{isGuessComplete ? 'Complete' : isCardRegion ? targetArea.abbreviation : 'Name it'}</h2>
              </div>

              <form className="answer-form" onSubmit={handleGuessSubmit}>
                <label className="sr-only" htmlFor="guess-input">
                  {answerLabel}
                </label>
                <input
                  autoComplete="off"
                  autoFocus
                  className={guessStatus}
                  disabled={isGuessComplete}
                  id="guess-input"
                  onKeyDown={submitOnEnter}
                  onChange={(event) => {
                    setGuessInput(event.target.value)
                    setGuessStatus('idle')
                  }}
                  placeholder="Name"
                  ref={guessInputRef}
                  value={guessInput}
                />
                <button
                  disabled={isGuessComplete}
                  type="button"
                  onClick={submitFromKeyboardClick}
                  onPointerDown={submitWithoutBlurringInput}
                >
                  Guess
                </button>
              </form>

              <p className={`feedback ${guessStatus}`}>{guessMessage}</p>

              <div className="panel-actions">
                <button type="button" onClick={() => resetGame('guess')}>
                  <RotateCcw aria-hidden="true" />
                  Reset
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="prompt-block">
                <p className="panel-kicker">{isCardRegion ? 'Blank list' : 'Blank map'}</p>
                <h2>{isFillComplete ? 'Complete' : isCardRegion ? 'List it' : 'Fill it'}</h2>
              </div>

              <form className="answer-form" onSubmit={handleFillSubmit}>
                <label className="sr-only" htmlFor="fill-input">
                  {answerLabel}
                </label>
                <input
                  autoComplete="off"
                  autoFocus
                  className={fillStatus}
                  disabled={isFillComplete}
                  id="fill-input"
                  onKeyDown={submitOnEnter}
                  onChange={(event) => {
                    setFillInput(event.target.value)
                    setFillStatus('idle')
                  }}
                  placeholder="Name"
                  ref={fillInputRef}
                  value={fillInput}
                />
                <button
                  disabled={isFillComplete}
                  type="button"
                  onClick={submitFromKeyboardClick}
                  onPointerDown={submitWithoutBlurringInput}
                >
                  Add
                </button>
              </form>

              <p className={`feedback ${fillStatus}`}>{fillMessage}</p>

              <div className="found-list" aria-label={`Filled ${region.pluralNoun}`}>
                {filledStateIds.length === 0 ? (
                  <p className="found-empty">Found {region.pluralNoun} will appear here.</p>
                ) : (
                  filledStateIds.map((stateId) => {
                    const state = areaById.get(stateId)

                    if (!state) {
                      return null
                    }

                    return (
                      <span className="found" key={state.id}>
                        {state.name}
                      </span>
                    )
                  })
                )}
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

      {isResultModalOpen ? (
        <div className="result-backdrop" role="presentation">
          <section
            aria-describedby="result-message"
            aria-labelledby="result-title"
            aria-modal="true"
            className="result-modal"
            role="dialog"
          >
            <p className="panel-kicker">{resultKicker}</p>
            <h2 id="result-title">
              {resultScore}/{areaCount}
            </h2>
            <p className="result-time">Time: {formatTime(elapsedSeconds)}</p>
            <p className="result-message" id="result-message">
              {resultPhrase}
            </p>
            <div className="result-actions">
              <button type="button" onClick={showCompletedMap}>
                <Eye aria-hidden="true" />
                {reviewButtonLabel}
              </button>
              <button type="button" onClick={() => resetGame(mode)}>
                <RotateCcw aria-hidden="true" />
                Start Again
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}

export default App
