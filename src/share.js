const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isShareId(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function isResultPath(pathname = window.location.pathname) {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean)
  return parts[0] === 'result'
}

export function parseShareIdFromLocation(location = window.location) {
  const parts = location.pathname.replace(/\/+$/, '').split('/').filter(Boolean)
  if (parts[0] !== 'result') return null

  if (parts.length === 2 && isShareId(parts[1])) return parts[1]

  if (parts.length === 1) {
    const id = new URLSearchParams(location.search).get('id')
    if (isShareId(id)) return id
  }

  return null
}

export function getShareUrl(readingId) {
  return `${window.location.origin}/result/${readingId}`
}

export async function shareReadingLink({ url, title, text }) {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url })
      return 'shared'
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled'
    }
  }

  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch (error) {
    console.error(error)
    window.prompt('아래 링크를 복사해 주세요.', url)
    return 'prompted'
  }
}
