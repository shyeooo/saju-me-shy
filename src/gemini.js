// .env의 VITE_GEMINI_API_KEY를 읽습니다.
// Vite에서는 import.meta.env.VITE_이름 으로 환경 변수에 접근합니다.
const apiKey = import.meta.env.VITE_GEMINI_API_KEY

// Interactions API 주소
const INTERACTIONS_URL =
  'https://generativelanguage.googleapis.com/v1beta/interactions'

/**
 * 사주 전문가 프롬프트를 만듭니다.
 * name, gender, calendar, birth, time 값을 문장 안에 넣습니다.
 */
export function buildSajuPrompt({ name, gender, calendar, birth, time }) {
  return `당신은 세계 최고의 사주 해석 전문가다. 논리와 구조 중심으로 해석하며,
수천 명의 인생을 분석해 온 경험이 있다. 매우 냉정하고 직설적이지만,
인간 내면에 대한 깊은 통찰로 장점과 단점을 모두 말한다.

먼저 아래 출생 정보로 사주 명식(년주·월주·일주·시주, 오행 분포, 십신)을 세워라.
그 다음 질문에 답하라: 이 사람의 전반적인 성격, 기질, 재능을 분석해 주세요.
사주 용어에 익숙하지 않다고 가정하고 쉽고 명확하게, 핵심 근거를 밝혀서.
1) 차분하지만 흥미롭게  2) 특이한 점 언급  3) 약점도 솔직하게
4) 돋보이는 특징 최소 1가지  5) 마지막은 사용자가 궁금해할 질문으로

이름: ${name} / 성별: ${gender} / ${calendar} ${birth} ${time}생
return only Korean.`
}

/**
 * Interactions API 응답에서 텍스트만 꺼냅니다.
 * REST 응답 예시:
 * steps[].type === "model_output" 이고 content[].text 에 본문이 있습니다.
 */
function extractOutputText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim()
  }
  if (typeof data?.outputText === 'string' && data.outputText.trim()) {
    return data.outputText.trim()
  }

  const steps = Array.isArray(data?.steps) ? data.steps : []
  const texts = []

  for (const step of steps) {
    // thought 단계는 건너뛰고, 모델이 쓴 글만 모읍니다.
    if (step?.type && step.type !== 'model_output') continue

    const contents = Array.isArray(step?.content) ? step.content : []
    for (const part of contents) {
      if (typeof part?.text === 'string' && part.text.trim()) {
        texts.push(part.text.trim())
      }
    }
  }

  return texts.join('\n\n').trim()
}

/**
 * Gemini Interactions API로 사주 해석을 요청합니다.
 * 브라우저에서 SDK의 Interactions 호출은 CORS 문제가 있어서,
 * Api-Revision 헤더 없이 fetch로 직접 호출합니다.
 */
export async function getSajuReading({
  name,
  birthDate,
  birthTime,
  gender,
  calendarType,
}) {
  if (!apiKey) {
    throw new Error(
      '.env에 VITE_GEMINI_API_KEY가 없습니다. 키를 넣고 개발 서버를 다시 시작해 주세요.',
    )
  }

  const prompt = buildSajuPrompt({
    name,
    gender,
    calendar: calendarType,
    birth: birthDate,
    time: birthTime || '시간미상',
  })

  // 문서 예시와 같은 Interactions API 요청입니다.
  // model: gemini-3.6-flash
  const response = await fetch(INTERACTIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      model: 'gemini-3.6-flash',
      input: prompt,
    }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      data?.error?.message ||
      `Gemini 요청 실패 (HTTP ${response.status})`
    throw new Error(message)
  }

  const text = extractOutputText(data)

  if (!text) {
    console.error('Gemini 원본 응답:', data)
    throw new Error('Gemini가 빈 응답을 보냈습니다. 잠시 후 다시 시도해 주세요.')
  }

  return text
}
