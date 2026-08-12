// useState: React에서 변하는 값(상태)을 기억하고 화면을 다시 그리게 해주는 기능
import { useEffect, useRef, useState } from 'react'
import { getSajuReading } from './gemini'
import { isSupabaseConfigured, supabase } from './supabase'
import './App.css'

function App() {
  // 입력 값들
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [birthTime, setBirthTime] = useState('')
  const [gender, setGender] = useState('')
  const [calendarType, setCalendarType] = useState('')

  // Gemini 결과 관련 상태
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const skeletonRef = useRef(null)
  const resultRef = useRef(null)

  // 저장된 사주 목록 (사이드바)
  const [readings, setReadings] = useState([])
  const [selectedId, setSelectedId] = useState(null)

  async function loadReadings() {
    if (!supabase) return

    const { data, error: fetchError } = await supabase
      .from('saju_readings')
      .select('id, name, birth_date, birth_time, gender, calendar_type, result, created_at')
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error(fetchError)
      return
    }

    setReadings(data ?? [])
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError(
        'Supabase 환경 변수가 없습니다. Vercel Environment Variables에 VITE_SUPABASE_URL과 VITE_SUPABASE_PUBLISHABLE_KEY를 넣고 다시 배포해 주세요.',
      )
      return
    }
    loadReadings()
  }, [])

  // 로딩이 시작되면 스켈레톤 영역이 보이도록 스크롤합니다.
  useEffect(() => {
    if (loading) {
      skeletonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [loading])

  function handleSelectReading(reading) {
    setSelectedId(reading.id)
    setName(reading.name ?? '')
    setBirthDate(reading.birth_date ?? '')
    setBirthTime(reading.birth_time ? String(reading.birth_time).slice(0, 5) : '')
    setGender(reading.gender ?? '')
    setCalendarType(reading.calendar_type ?? '')
    setResult(reading.result ?? '')
    setError('')

    // 다음 페인트 후 결과 영역으로 부드럽게 이동
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function handleNewSaju() {
    setSelectedId(null)
    setName('')
    setBirthDate('')
    setBirthTime('')
    setGender('')
    setCalendarType('')
    setResult('')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resultParagraphs = result
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean)

  async function handleGetSaju() {
    if (!name || !birthDate || !gender || !calendarType) {
      setError('이름, 생년월일, 성별, 양력/음력은 꼭 입력해 주세요.')
      return
    }

    setLoading(true)
    setError('')
    setResult('')
    setSelectedId(null)

    try {
      const text = await getSajuReading({
        name,
        birthDate,
        birthTime,
        gender,
        calendarType,
      })
      setResult(text)

      if (!supabase) {
        setError(
          '사주 해석은 됐지만 Supabase가 설정되지 않아 저장하지 못했습니다.',
        )
        return
      }

      const { data, error: saveError } = await supabase
        .from('saju_readings')
        .insert({
          name,
          birth_date: birthDate,
          birth_time: birthTime || null,
          gender,
          calendar_type: calendarType,
          result: text,
        })
        .select('id, name, birth_date, birth_time, gender, calendar_type, result, created_at')
        .single()

      if (saveError) {
        console.error(saveError)
        setError('사주 해석은 됐지만 저장에 실패했습니다.')
      } else if (data) {
        setReadings((prev) => [data, ...prev])
        setSelectedId(data.id)
      }
    } catch (err) {
      console.error(err)
      const message =
        err?.error?.message ||
        err?.message ||
        '사주를 불러오는 중 문제가 생겼습니다.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="layout">
      <aside className="sidebar" aria-label="저장된 사주 목록">
        <p className="sidebar-title">저장된 사주</p>
        <button
          type="button"
          className="new-saju-btn"
          onClick={handleNewSaju}
        >
          새 사주 만들기
        </button>
        {readings.length === 0 ? (
          <p className="sidebar-empty">아직 저장된 사주가 없습니다.</p>
        ) : (
          <ul className="sidebar-list">
            {readings.map((reading) => (
              <li key={reading.id}>
                <button
                  type="button"
                  className={
                    selectedId === reading.id
                      ? 'sidebar-item is-active'
                      : 'sidebar-item'
                  }
                  onClick={() => handleSelectReading(reading)}
                >
                  {reading.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <main className="app">
        <header className="brand">
          <h1 className="brand-mark">사주미</h1>
          <p className="brand-line">나의 사주를, 조금 더 가까이</p>
        </header>

        <section className="form-panel" aria-label="사주 정보 입력">
          <label className="field">
            이름
            <input
              type="text"
              placeholder="예: 홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="field">
            생년월일
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </label>

          <label className="field">
            태어난 시간
            <input
              type="time"
              value={birthTime}
              onChange={(e) => setBirthTime(e.target.value)}
            />
          </label>

          <div className="row-2">
            <label className="field">
              성별
              <select value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">선택</option>
                <option value="남">남</option>
                <option value="여">여</option>
              </select>
            </label>

            <label className="field">
              양력 / 음력
              <select
                value={calendarType}
                onChange={(e) => setCalendarType(e.target.value)}
              >
                <option value="">선택</option>
                <option value="양력">양력</option>
                <option value="음력">음력</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            className="submit-btn"
            onClick={handleGetSaju}
            disabled={loading}
          >
            {loading ? '사주를 읽는 중…' : '사주 보기'}
          </button>
        </section>

        <div className="preview">
          <p className="preview-title">{name || '○○'}님의 사주</p>
          <p>생년월일: {birthDate || '—'}</p>
          <p>태어난 시간: {birthTime || '—'}</p>
          <p>성별: {gender || '—'}</p>
          <p>양력/음력: {calendarType || '—'}</p>
        </div>

        {error && <p className="error">{error}</p>}

        {/* 해석 요청 중에는 결과 자리를 스켈레톤으로 미리 보여줍니다 */}
        {loading && (
          <section
            ref={skeletonRef}
            className="result skeleton-result"
            aria-busy="true"
            aria-live="polite"
          >
            <p className="skeleton-status">사주 명식을 세우는 중…</p>
            <div className="skeleton-line skeleton-title" />
            <div className="skeleton-block">
              <div className="skeleton-line w-95" />
              <div className="skeleton-line w-88" />
              <div className="skeleton-line w-92" />
              <div className="skeleton-line w-70" />
            </div>
            <div className="skeleton-block">
              <div className="skeleton-line w-90" />
              <div className="skeleton-line w-96" />
              <div className="skeleton-line w-80" />
              <div className="skeleton-line w-60" />
            </div>
            <div className="skeleton-block">
              <div className="skeleton-line w-85" />
              <div className="skeleton-line w-75" />
            </div>
          </section>
        )}

        {!loading && result && (
          <section
            ref={resultRef}
            key={selectedId ?? 'new-result'}
            className="result"
            aria-live="polite"
          >
            <p className="result-label">사주 해석</p>
            <h2>{name}님의 이야기</h2>
            {(birthDate || gender || calendarType) && (
              <p className="result-meta">
                {[
                  birthDate,
                  birthTime || null,
                  gender,
                  calendarType,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
            <div className="result-body">
              {resultParagraphs.map((paragraph, index) => (
                <p key={`${selectedId ?? 'new'}-${index}`} className="result-text">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
