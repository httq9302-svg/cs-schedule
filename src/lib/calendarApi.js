/**
 * 서비스 계정 기반 구글 캘린더 API 클라이언트
 * 로그인 없이 자동으로 캘린더를 읽고 씁니다.
 */

const BASE = '/api/calendar'

// ── 전체 일정 가져오기 ──────────────────────────────────────────────────────
export async function fetchAllEvents() {
  const res = await fetch(`${BASE}?action=list`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  const data = await res.json()
  return data.events || []
}

// ── 일정 생성 ──────────────────────────────────────────────────────────────
export async function createEvent(eventBody) {
  const res = await fetch(`${BASE}?action=create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eventBody),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return (await res.json()).event
}

// ── 일정 수정 ──────────────────────────────────────────────────────────────
export async function updateEvent(eventId, eventBody) {
  const res = await fetch(`${BASE}?action=update`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId, ...eventBody }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return (await res.json()).event
}

// ── 일정 삭제 ──────────────────────────────────────────────────────────────
export async function deleteEvent(eventId) {
  const res = await fetch(`${BASE}?action=delete&eventId=${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return true
}

// ── 구글 이벤트 → 앱 스케줄 변환 ──────────────────────────────────────────
export function googleEventToSchedule(event) {
  const startRaw = event.start?.dateTime || event.start?.date || ''
  const endRaw = event.end?.dateTime || event.end?.date || ''

  // 날짜 추출 (YYYY-MM-DD)
  let date = ''
  if (startRaw.includes('T')) {
    // dateTime 형식 → 로컬 날짜로 변환
    const d = new Date(startRaw)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    date = `${y}-${m}-${day}`
  } else {
    date = startRaw.slice(0, 10)
  }

  // 시작 시간 추출 (HH:MM)
  let startTime = ''
  let endTime = ''
  if (startRaw.includes('T')) {
    const d = new Date(startRaw)
    startTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    const e = new Date(endRaw)
    endTime = `${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`
  }

  // 팀 결정 (시간 기준)
  const hour = startTime ? parseInt(startTime.split(':')[0]) : -1
  let team = ''
  if (hour === 9) team = 'A'
  else if (hour === 12) team = 'B'
  else if (hour === 15) team = 'C'
  else if (hour === 18) team = 'D'

  // 제목 파싱: "담당자 / 업무내용" 또는 "담당자/ 업무내용"
  const rawTitle = event.summary || ''
  let assignee = ''
  let title = rawTitle
  const slashIdx = rawTitle.indexOf('/')
  if (slashIdx > 0) {
    assignee = rawTitle.slice(0, slashIdx).trim()
    title = rawTitle.slice(slashIdx + 1).trim()
  }

  return {
    id: event.id,
    googleEventId: event.id,
    date,
    workDate: date,
    originalDate: date,
    team,
    startTime,
    endTime,
    title,
    assignee,
    address: event.location || '',
    phone: '',
    memo: event.description || '',
    status: 'pending',
  }
}
