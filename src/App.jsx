// useState: React에서 변하는 값(상태)을 기억하고 화면을 다시 그리게 해주는 기능
import { useEffect, useRef, useState } from 'react'
import { getSajuReading } from './gemini'
import { isSupabaseConfigured, supabase } from './supabase'
import './App.css'

const USER_SELECT =
  'id, name, birth_date, birth_time, gender, calendar_type'
const READING_SELECT = 'id, result, created_at'

function formatBirthTime(value) {
  return value ? String(value).slice(0, 5) : ''
}

function formatReadingLabel(createdAt) {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return '사주 해석'
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function formatBirthDate(value) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function ResultMascot() {
  return (
    <img
      className="result-mascot"
      src="/images/mascot.png"
      alt="사주미 치즈고양이"
      width="345"
      height="399"
      decoding="async"
    />
  )
}

function isProfileComplete(row) {
  return Boolean(row?.name && row?.birth_date && row?.gender && row?.calendar_type)
}

function ProfileFields({
  name,
  birthDate,
  birthTime,
  gender,
  calendarType,
  onNameChange,
  onBirthDateChange,
  onBirthTimeChange,
  onGenderChange,
  onCalendarTypeChange,
}) {
  return (
    <>
      <label className="field">
        <span className="field-label">
          이름 <span className="field-required">필수</span>
        </span>
        <input
          type="text"
          placeholder="예: 홍길동"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          autoComplete="name"
        />
      </label>

      <label className="field">
        <span className="field-label">
          생년월일 <span className="field-required">필수</span>
        </span>
        <input
          type="date"
          value={birthDate}
          onChange={(e) => onBirthDateChange(e.target.value)}
        />
      </label>

      <label className="field">
        <span className="field-label">태어난 시간</span>
        <input
          type="time"
          value={birthTime}
          onChange={(e) => onBirthTimeChange(e.target.value)}
        />
        <span className="field-hint">모르면 비워 두어도 돼요.</span>
      </label>

      <div className="row-2">
        <label className="field">
          <span className="field-label">
            성별 <span className="field-required">필수</span>
          </span>
          <select
            value={gender}
            onChange={(e) => onGenderChange(e.target.value)}
          >
            <option value="">선택</option>
            <option value="남">남</option>
            <option value="여">여</option>
          </select>
        </label>

        <label className="field">
          <span className="field-label">
            양력 / 음력 <span className="field-required">필수</span>
          </span>
          <select
            value={calendarType}
            onChange={(e) => onCalendarTypeChange(e.target.value)}
          >
            <option value="">선택</option>
            <option value="양력">양력</option>
            <option value="음력">음력</option>
          </select>
        </label>
      </div>
    </>
  )
}

function App() {
  // 인증
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authBusy, setAuthBusy] = useState(false)

  // 입력 값들
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [birthTime, setBirthTime] = useState('')
  const [gender, setGender] = useState('')
  const [calendarType, setCalendarType] = useState('')

  // Gemini 결과 관련 상태
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const skeletonRef = useRef(null)
  const resultRef = useRef(null)
  const toastTimerRef = useRef(null)
  const [toast, setToast] = useState(null)

  // 저장된 사주 목록 (사이드바) — Read
  const [readings, setReadings] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileReady, setProfileReady] = useState(false)
  const [view, setView] = useState('saju')

  function applyProfile(row) {
    setName(row?.name ?? '')
    setBirthDate(row?.birth_date ?? '')
    setBirthTime(formatBirthTime(row?.birth_time))
    setGender(row?.gender ?? '')
    setCalendarType(row?.calendar_type ?? '')
  }

  function prefillNameFromGoogle() {
    const googleName =
      user?.user_metadata?.full_name || user?.user_metadata?.name || ''
    if (googleName) setName(googleName)
  }

  function readingPayload(resultText, { includeUserId = false } = {}) {
    const payload = { result: resultText }

    if (includeUserId && user?.id) {
      payload.user_id = user.id
    }

    return payload
  }

  async function loadProfile(userId) {
    if (!supabase || !userId) {
      setProfileReady(true)
      return
    }

    const { data, error: fetchError } = await supabase
      .from('users')
      .select(USER_SELECT)
      .eq('id', userId)
      .maybeSingle()

    if (fetchError) {
      console.error(fetchError)
      setError('저장된 내 정보를 불러오지 못했습니다.')
      setProfileReady(true)
      return
    }

    setProfile(data)
    applyProfile(data)
    if (!data?.name) prefillNameFromGoogle()
    setProfileReady(true)
  }

  async function saveProfile() {
    if (!supabase || !user?.id) {
      throw new Error('로그인 정보가 없습니다.')
    }

    const payload = {
      id: user.id,
      name,
      birth_date: birthDate,
      birth_time: birthTime || null,
      gender,
      calendar_type: calendarType,
    }

    const { data, error: upsertError } = await supabase
      .from('users')
      .upsert(payload, { onConflict: 'id' })
      .select(USER_SELECT)
      .single()

    if (upsertError) {
      console.error(upsertError)
      throw upsertError
    }

    setProfile(data)
    applyProfile(data)
    return data
  }

  async function loadReadings() {
    if (!supabase || !user) return

    const { data, error: fetchError } = await supabase
      .from('saju_readings')
      .select(READING_SELECT)
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error(fetchError)
      setError('저장된 사주를 불러오지 못했습니다.')
      return
    }

    setReadings(data ?? [])
  }

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthLoading(false)
      setError(
        'Supabase 환경 변수가 없습니다. Vercel Environment Variables에 VITE_SUPABASE_URL과 VITE_SUPABASE_PUBLISHABLE_KEY를 넣고 다시 배포해 주세요.',
      )
      return
    }

    const params = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(
      window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash,
    )
    const oauthError =
      params.get('error_description') ||
      hashParams.get('error_description') ||
      params.get('error') ||
      hashParams.get('error')

    if (oauthError) {
      setError(decodeURIComponent(oauthError.replace(/\+/g, ' ')))
      window.history.replaceState({}, document.title, window.location.pathname)
    }

    let mounted = true

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return
      if (sessionError) {
        console.error(sessionError)
        setError('로그인 상태를 확인하지 못했습니다.')
      }
      setUser(data.session?.user ?? null)
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)

      if (event === 'SIGNED_IN') {
        const fromOAuthCallback =
          window.location.search.includes('code=') ||
          window.location.hash.includes('access_token')
        const dirty =
          fromOAuthCallback ||
          window.location.search.includes('error') ||
          window.location.hash.includes('error')

        if (dirty) {
          window.history.replaceState({}, document.title, window.location.pathname)
        }
        if (fromOAuthCallback) {
          setNotice('Google 로그인에 성공했어요.')
        }
      }

      if (event === 'SIGNED_OUT') {
        setReadings([])
        setSelectedId(null)
        setProfile(null)
        setProfileReady(false)
        setView('saju')
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setReadings([])
      setSelectedId(null)
      setProfile(null)
      setProfileReady(false)
      setView('saju')
      applyProfile(null)
      return
    }
    setProfileReady(false)
    loadProfile(user.id)
    loadReadings()
  }, [user?.id])

  const needsOnboarding = Boolean(user && profileReady && !isProfileComplete(profile))

  useEffect(() => {
    if (loading) {
      skeletonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [loading])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  function hideToast() {
    setToast((current) => (current ? { ...current, leaving: true } : null))
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 380)
  }

  function showToast(message) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ message, id: Date.now(), leaving: false })
    toastTimerRef.current = setTimeout(hideToast, 2400)
  }

  useEffect(() => {
    if (!needsOnboarding) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [needsOnboarding])

  async function handleGoogleLogin() {
    if (!supabase) {
      setError('Supabase가 설정되지 않아 로그인할 수 없습니다.')
      return
    }

    setAuthBusy(true)
    setError('')
    setNotice('')

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          prompt: 'select_account',
        },
      },
    })

    if (oauthError) {
      console.error(oauthError)
      setError('Google 로그인을 시작하지 못했습니다. 설정을 확인해 주세요.')
      setAuthBusy(false)
    }
  }

  async function handleLogout() {
    if (!supabase) return

    setAuthBusy(true)
    setError('')
    setNotice('')

    const { error: signOutError } = await supabase.auth.signOut()
    setAuthBusy(false)

    if (signOutError) {
      console.error(signOutError)
      setError('로그아웃에 실패했습니다.')
      return
    }

    handleNewSaju()
    setNotice('로그아웃했어요.')
  }

  function handleSelectReading(reading) {
    setView('saju')
    setSelectedId(reading.id)
    applyProfile(profile)
    setResult(reading.result ?? '')
    setError('')
    setNotice('')

    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function handleNewSaju({ fromButton = false } = {}) {
    const alreadyOpen = view === 'saju' && !selectedId
    if (fromButton && alreadyOpen) {
      showToast('이미 새 사주 화면이 열려 있어요.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setView('saju')
    setSelectedId(null)
    applyProfile(profile)
    setResult('')
    setError('')
    setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openProfile() {
    applyProfile(profile)
    if (!profile?.name) prefillNameFromGoogle()
    setView('profile')
    setError('')
    setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function closeProfile() {
    applyProfile(profile)
    setView('saju')
    setError('')
  }

  function getProfileValidationError() {
    if (!name || !birthDate || !gender || !calendarType) {
      return '이름, 생년월일, 성별, 양력/음력은 꼭 입력해 주세요.'
    }
    return ''
  }

  async function handleSaveProfile(event) {
    event?.preventDefault()

    const message = getProfileValidationError()
    if (message) {
      setError(message)
      setNotice('')
      return
    }
    if (!supabase) {
      setError('Supabase가 설정되지 않아 저장할 수 없습니다.')
      return
    }

    const completingOnboarding = !isProfileComplete(profile)
    setSaving(true)
    setError('')
    setNotice('')

    try {
      await saveProfile()
      setView('saju')
      setNotice(
        completingOnboarding
          ? '내 정보를 저장했어요. 이제 사주를 볼 수 있어요.'
          : '프로필을 저장했어요.',
      )
    } catch (profileError) {
      console.error(profileError)
      setError('내 정보 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  function validateProfileForSaju() {
    const message = getProfileValidationError()
    if (message) {
      setError(message)
      openProfile()
      return false
    }
    return true
  }

  // Create / Update(재해석): 사주 보기
  async function handleGetSaju() {
    if (!user) {
      setError('Google로 로그인한 뒤 이용해 주세요.')
      return
    }
    if (!validateProfileForSaju()) return

    const editingId = selectedId
    setLoading(true)
    setError('')
    setNotice('')
    setResult('')

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

      if (editingId) {
        const { data, error: updateError } = await supabase
          .from('saju_readings')
          .update(readingPayload(text))
          .eq('id', editingId)
          .select(READING_SELECT)
          .single()

        if (updateError) {
          console.error(updateError)
          setError('사주 해석은 됐지만 수정에 실패했습니다.')
        } else if (data) {
          setReadings((prev) =>
            prev.map((item) => (item.id === data.id ? data : item)),
          )
          setSelectedId(data.id)
          setNotice('사주 해석을 다시 저장했어요.')
        }
      } else {
        const { data, error: saveError } = await supabase
          .from('saju_readings')
          .insert(readingPayload(text, { includeUserId: true }))
          .select(READING_SELECT)
          .single()

        if (saveError) {
          console.error(saveError)
          setError('사주 해석은 됐지만 저장에 실패했습니다.')
        } else if (data) {
          setReadings((prev) => [data, ...prev])
          setSelectedId(data.id)
          setNotice('새 사주를 저장했어요.')
        }
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

  // Update: 현재 결과만 저장 (재해석 없이)
  async function handleUpdateReading() {
    if (!user) {
      setError('Google로 로그인한 뒤 이용해 주세요.')
      return
    }
    if (!selectedId) {
      setError('수정할 사주를 사이드바에서 먼저 선택해 주세요.')
      return
    }
    if (!result) {
      setError('저장할 사주 결과가 없습니다. 먼저 사주 보기를 해 주세요.')
      return
    }
    if (!supabase) {
      setError('Supabase가 설정되지 않아 수정할 수 없습니다.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    const { data, error: updateError } = await supabase
      .from('saju_readings')
      .update(readingPayload(result))
      .eq('id', selectedId)
      .select(READING_SELECT)
      .single()

    setSaving(false)

    if (updateError) {
      console.error(updateError)
      setError('수정에 실패했습니다.')
      return
    }

    if (data) {
      setReadings((prev) =>
        prev.map((item) => (item.id === data.id ? data : item)),
      )
      setNotice('사주 해석을 저장했어요.')
    }
  }

  // Delete
  async function handleDeleteReading() {
    if (!user) {
      setError('Google로 로그인한 뒤 이용해 주세요.')
      return
    }
    if (!selectedId) {
      setError('삭제할 사주를 사이드바에서 먼저 선택해 주세요.')
      return
    }
    if (!supabase) {
      setError('Supabase가 설정되지 않아 삭제할 수 없습니다.')
      return
    }

    const ok = window.confirm(
      '이 사주 해석을 삭제할까요? 프로필 정보는 그대로 남아 있어요.',
    )
    if (!ok) return

    setSaving(true)
    setError('')
    setNotice('')

    const { error: deleteError } = await supabase
      .from('saju_readings')
      .delete()
      .eq('id', selectedId)

    setSaving(false)

    if (deleteError) {
      console.error(deleteError)
      setError('삭제에 실패했습니다.')
      return
    }

    setReadings((prev) => prev.filter((item) => item.id !== selectedId))
    handleNewSaju()
    setNotice('사주를 삭제했어요.')
  }

  const resultParagraphs = result
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean)

  const isEditing = Boolean(selectedId)
  const isNewSajuPage = view === 'saju' && !selectedId
  const displayName =
    profile?.name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    '사용자'
  const profileFields = {
    name,
    birthDate,
    birthTime,
    gender,
    calendarType,
    onNameChange: setName,
    onBirthDateChange: setBirthDate,
    onBirthTimeChange: setBirthTime,
    onGenderChange: setGender,
    onCalendarTypeChange: setCalendarType,
  }

  if (authLoading || (user && !profileReady)) {
    return (
      <div className="auth-screen" aria-busy="true">
        <p className="auth-status">
          {authLoading
            ? '로그인 상태를 확인하는 중…'
            : '내 정보를 확인하는 중…'}
        </p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="auth-screen">
        <header className="brand">
          <h1 className="brand-mark">사주미</h1>
          <p className="brand-line">나의 사주를, 조금 더 가까이</p>
        </header>

        <section className="auth-panel" aria-label="로그인">
          <p className="auth-copy">Google 계정으로 로그인하면 내 사주만 안전하게 보관해요.</p>
          <button
            type="button"
            className="google-btn"
            onClick={handleGoogleLogin}
            disabled={authBusy || !isSupabaseConfigured}
          >
            {authBusy ? 'Google로 이동 중…' : 'Google로 계속하기'}
          </button>
          {error && <p className="error">{error}</p>}
          {notice && !error && <p className="notice">{notice}</p>}
        </section>
      </div>
    )
  }

  return (
    <div className="layout">
      <aside className="sidebar" aria-label="저장된 사주 목록" inert={needsOnboarding || undefined}>
        <div className="sidebar-auth">
          <p className="sidebar-user" title={user.email ?? displayName}>
            {displayName}
          </p>
          <button
            type="button"
            className={view === 'profile' ? 'profile-nav-btn is-active' : 'profile-nav-btn'}
            onClick={openProfile}
            disabled={needsOnboarding}
          >
            프로필
          </button>
          <button
            type="button"
            className="logout-btn"
            onClick={handleLogout}
            disabled={authBusy}
          >
            {authBusy ? '처리 중…' : '로그아웃'}
          </button>
        </div>

        <p className="sidebar-title">저장된 사주</p>
        <button
          type="button"
          className={isNewSajuPage ? 'new-saju-btn is-active' : 'new-saju-btn'}
          onClick={() => handleNewSaju({ fromButton: true })}
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
                    selectedId === reading.id && view === 'saju'
                      ? 'sidebar-item is-active'
                      : 'sidebar-item'
                  }
                  onClick={() => handleSelectReading(reading)}
                >
                  <span className="sidebar-item-date">
                    {formatReadingLabel(reading.created_at)}
                  </span>
                  <span className="sidebar-item-label">사주 해석</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <main className="app" inert={needsOnboarding || undefined}>
        <header className="brand">
          <h1 className="brand-mark">사주미</h1>
          <p className="brand-line">나의 사주를, 조금 더 가까이</p>
        </header>

        {view === 'profile' ? (
          <section className="form-panel" aria-label="프로필 수정">
            <div className="section-heading">
              <p className="section-kicker">프로필</p>
              <h2 className="section-title">내 사주 정보</h2>
              <p className="action-hint">
                여기서 바꾼 내용은 앞으로 보는 모든 사주에 반영돼요.
              </p>
            </div>

            <form className="profile-form" onSubmit={handleSaveProfile}>
              <ProfileFields {...profileFields} />
              {error && <p className="error">{error}</p>}
              {notice && !error && <p className="notice">{notice}</p>}
              <button
                type="submit"
                className="submit-btn"
                disabled={saving || loading}
              >
                {saving ? '저장 중…' : '프로필 저장'}
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={closeProfile}
                disabled={saving}
              >
                사주 화면으로
              </button>
            </form>
          </section>
        ) : (
          <>
            <section className="profile-card" aria-label="내 사주 정보">
              <div className="profile-card-top">
                <div>
                  <p className="section-kicker">내 정보</p>
                  <h2 className="profile-card-name">{name || '○○'}님</h2>
                </div>
                <button
                  type="button"
                  className="profile-edit-btn"
                  onClick={openProfile}
                >
                  프로필 수정
                </button>
              </div>
              <dl className="profile-meta">
                <div>
                  <dt>생년월일</dt>
                  <dd>{formatBirthDate(birthDate)}</dd>
                </div>
                <div>
                  <dt>태어난 시간</dt>
                  <dd>{birthTime || '모름'}</dd>
                </div>
                <div>
                  <dt>성별</dt>
                  <dd>{gender || '—'}</dd>
                </div>
                <div>
                  <dt>양력 / 음력</dt>
                  <dd>{calendarType || '—'}</dd>
                </div>
              </dl>
            </section>

            <section className="saju-actions" aria-label="사주 보기">
              <button
                type="button"
                className="submit-btn"
                onClick={handleGetSaju}
                disabled={loading || saving}
              >
                {loading
                  ? '사주를 읽는 중…'
                  : isEditing
                    ? '다시 해석하고 수정'
                    : '사주 보기'}
              </button>

              <div className="action-row">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={handleUpdateReading}
                  disabled={!isEditing || loading || saving}
                >
                  {saving ? '저장 중…' : '수정 저장'}
                </button>
                <button
                  type="button"
                  className="danger-btn"
                  onClick={handleDeleteReading}
                  disabled={!isEditing || loading || saving}
                >
                  삭제
                </button>
              </div>
              {!isEditing && (
                <p className="action-hint">
                  사이드바에서 날짜를 선택하면 이전 해석을 수정·삭제할 수 있어요.
                  생년월일을 바꾸려면 프로필에서 수정해 주세요.
                </p>
              )}
            </section>

            {error && <p className="error">{error}</p>}
            {notice && !error && <p className="notice">{notice}</p>}

            {loading && (
              <div className="result-stage">
                <ResultMascot />
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
              </div>
            )}

            {!loading && result && (
              <div className="result-stage">
                <ResultMascot />
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
                      {[birthDate, birthTime || null, gender, calendarType]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                  <div className="result-body">
                    {resultParagraphs.map((paragraph, index) => (
                      <p
                        key={`${selectedId ?? 'new'}-${index}`}
                        className="result-text"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </>
        )}
      </main>

      {needsOnboarding && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
            aria-describedby="onboarding-copy"
          >
            <p className="section-kicker">처음 오신 걸 환영해요</p>
            <h2 id="onboarding-title">내 정보를 알려 주세요</h2>
            <p id="onboarding-copy" className="modal-copy">
              사주를 보기 위해 한 번만 입력하면 되고, 나중에 프로필에서 언제든 수정할 수 있어요.
            </p>
            <form className="profile-form" onSubmit={handleSaveProfile}>
              <ProfileFields {...profileFields} />
              {error && <p className="error">{error}</p>}
              <button
                type="submit"
                className="submit-btn"
                disabled={saving}
              >
                {saving ? '저장 중…' : '저장하고 시작하기'}
              </button>
              <button
                type="button"
                className="modal-logout"
                onClick={handleLogout}
                disabled={authBusy || saving}
              >
                다른 계정으로 로그인
              </button>
            </form>
          </div>
        </div>
      )}
      {toast && (
        <div
          key={toast.id}
          className={toast.leaving ? 'toast is-leaving' : 'toast'}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default App
