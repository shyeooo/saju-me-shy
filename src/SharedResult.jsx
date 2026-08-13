import { useEffect, useRef, useState } from 'react'
import { ResultMascot, ResultView } from './ResultView'
import { getShareUrl, shareReadingLink } from './share'
import { isSupabaseConfigured, supabase } from './supabase'
import './App.css'

export default function SharedResult({ shareId }) {
  const [reading, setReading] = useState(null)
  const [loading, setLoading] = useState(Boolean(shareId))
  const [error, setError] = useState('')
  const [shareBusy, setShareBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const toastTimerRef = useRef(null)

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
    if (!shareId) {
      setLoading(false)
      setError('공유 링크가 올바르지 않아요.')
      return
    }

    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      setError(
        'Supabase 환경 변수가 없습니다. 공유 결과를 불러올 수 없어요.',
      )
      return
    }

    let mounted = true
    setLoading(true)
    setError('')

    supabase
      .rpc('get_shared_reading', { p_share_id: shareId })
      .then(({ data, error: fetchError }) => {
        if (!mounted) return

        if (fetchError) {
          console.error(fetchError)
          setError('사주 결과를 불러오지 못했습니다.')
          setReading(null)
          return
        }

        const row = Array.isArray(data) ? data[0] : data
        if (!row?.result) {
          setError('이 사주 결과를 찾을 수 없어요.')
          setReading(null)
          return
        }

        setReading(row)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [shareId])

  useEffect(() => {
    const previous = document.title
    if (reading?.name) {
      document.title = `${reading.name}님의 사주 해석 | 사주미`
    } else if (!loading && error) {
      document.title = '사주 결과 | 사주미'
    }
    return () => {
      document.title = previous
    }
  }, [reading, loading, error])

  async function handleShare() {
    if (!reading?.id) return

    const name = reading.name || '친구'
    setShareBusy(true)

    try {
      const outcome = await shareReadingLink({
        url: getShareUrl(reading.id),
        title: `${name}님의 사주 해석 | 사주미`,
        text: `${name}님의 사주 이야기를 확인해 보세요.`,
      })

      if (outcome === 'copied' || outcome === 'prompted') {
        showToast('공유 링크를 복사했어요.')
      }
    } catch (shareError) {
      console.error(shareError)
      showToast('공유에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setShareBusy(false)
    }
  }

  return (
    <div className="app shared-page">
      <header className="brand">
        <h1 className="brand-mark">사주미</h1>
        <p className="brand-line">나의 사주를, 조금 더 가까이</p>
      </header>

      {loading && (
        <div className="result-stage">
          <ResultMascot />
          <section className="result skeleton-result" aria-busy="true">
            <p className="skeleton-status">사주 결과를 여는 중…</p>
            <div className="skeleton-line skeleton-title" />
            <div className="skeleton-block">
              <div className="skeleton-line w-95" />
              <div className="skeleton-line w-88" />
              <div className="skeleton-line w-92" />
              <div className="skeleton-line w-70" />
            </div>
          </section>
        </div>
      )}

      {!loading && error && (
        <section className="auth-panel" aria-label="공유 결과">
          <p className="auth-copy">{error}</p>
          <a className="secondary-btn shared-home-link" href="/">
            사주미 홈으로
          </a>
        </section>
      )}

      {!loading && reading && (
        <ResultView
          name={reading.name}
          birthDate={reading.birth_date}
          birthTime={reading.birth_time ? String(reading.birth_time).slice(0, 5) : ''}
          gender={reading.gender}
          calendarType={reading.calendar_type}
          result={reading.result}
          resultKey={reading.id}
          onShare={handleShare}
          shareBusy={shareBusy}
        />
      )}

      {!loading && reading && (
        <a className="secondary-btn shared-home-link" href="/">
          나도 내 사주 보기
        </a>
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
