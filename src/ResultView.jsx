function splitParagraphs(result) {
  return String(result ?? '')
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function findPreviewSplit(text) {
  const mid = Math.floor(text.length / 2)
  const start = Math.floor(mid * 0.55)
  const end = Math.min(text.length, Math.floor(mid * 1.2))
  const slice = text.slice(start, end)
  const match = slice.match(/다\.|요\.|[.!?…]/)
  if (match && match.index != null) {
    return start + match.index + match[0].length
  }
  const space = text.lastIndexOf(' ', mid)
  return space > start ? space : Math.max(1, mid)
}

function splitResultPreview(result) {
  const paragraphs = splitParagraphs(result)
  if (paragraphs.length === 0) {
    return { visible: [], hidden: [] }
  }

  if (paragraphs.length === 1) {
    const text = paragraphs[0]
    const splitAt = findPreviewSplit(text)
    const visible = text.slice(0, splitAt).trimEnd()
    const hidden = text.slice(splitAt).trimStart()
    return {
      visible: visible ? [visible] : [],
      hidden: hidden ? [hidden] : [],
    }
  }

  const visibleCount = Math.max(1, Math.floor(paragraphs.length / 2))
  return {
    visible: paragraphs.slice(0, visibleCount),
    hidden: paragraphs.slice(visibleCount),
  }
}

export function ResultMascot() {
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

export function ShareButton({ onClick, busy = false, disabled = false }) {
  return (
    <button
      type="button"
      className="share-btn"
      onClick={onClick}
      disabled={disabled || busy}
    >
      <svg
        className="share-btn-icon"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      {busy ? '공유하는 중…' : '친구에게 공유하기'}
    </button>
  )
}

export function ResultView({
  name,
  birthDate,
  birthTime,
  gender,
  calendarType,
  result,
  resultKey,
  resultRef,
  onShare,
  shareBusy = false,
  shareDisabled = false,
  locked = false,
  onUnlock,
  unlockBusy = false,
  unlockDisabled = false,
}) {
  const resultParagraphs = splitParagraphs(result)
  const preview = locked
    ? splitResultPreview(result)
    : { visible: resultParagraphs, hidden: [] }

  return (
    <div className="result-stage">
      <ResultMascot />
      <section
        ref={resultRef}
        key={resultKey}
        className={locked ? 'result is-locked' : 'result'}
        aria-live="polite"
      >
        <p className="result-label">사주 해석</p>
        <h2>{name ? `${name}님의 이야기` : '사주 이야기'}</h2>
        {(birthDate || gender || calendarType) && (
          <p className="result-meta">
            {[birthDate, birthTime || null, gender, calendarType]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        <div className="result-body">
          {preview.visible.map((paragraph, index) => (
            <p key={`${resultKey ?? 'result'}-visible-${index}`} className="result-text">
              {paragraph}
            </p>
          ))}
        </div>
        {locked && (
          <div className={preview.hidden.length ? 'result-locked' : 'result-locked is-empty'}>
            {preview.hidden.length > 0 && (
              <div className="result-locked-preview" aria-hidden="true">
                {preview.hidden.map((paragraph, index) => (
                  <p
                    key={`${resultKey ?? 'result'}-hidden-${index}`}
                    className="result-text"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            )}
            <div className="result-lock-overlay">
              <p className="result-lock-kicker">아직 절반이에요</p>
              <h3>나머지 사주는 로그인하면 열려요</h3>
              <p className="result-lock-copy">
                앞부분만 먼저 보여 드렸어요. Google로 로그인하면 재능, 약점,
                전체 해석을 이어서 볼 수 있어요.
              </p>
              <button
                type="button"
                className="submit-btn result-lock-btn"
                onClick={onUnlock}
                disabled={unlockDisabled || unlockBusy}
              >
                {unlockBusy ? 'Google로 이동 중…' : 'Google로 로그인하고 전체 보기'}
              </button>
            </div>
          </div>
        )}
        {onShare && !locked && (
          <ShareButton
            onClick={onShare}
            busy={shareBusy}
            disabled={shareDisabled}
          />
        )}
      </section>
    </div>
  )
}
