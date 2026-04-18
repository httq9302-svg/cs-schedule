/**
 * Google Calendar API v3 연동 모듈
 *
 * 사용 전 Google Cloud Console에서:
 * 1. Calendar API 활성화
 * 2. OAuth 2.0 클라이언트 ID 생성 (웹 애플리케이션)
 * 3. 승인된 JavaScript 원본에 앱 URL 추가
 * 4. .env 파일에 VITE_GOOGLE_CLIENT_ID, VITE_GOOGLE_API_KEY 설정
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || ''
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'
const SCOPES = 'https://www.googleapis.com/auth/calendar'

let gapiInited = false
let gisInited = false
let tokenClient = null

// ── 팀별 고정 시간 (회사 룰) ─────────────────────────────────────────────────
const TEAM_TIME = {
  A: { start: '09:00', end: '09:30' },
  B: { start: '12:00', end: '12:30' },
  C: { start: '15:00', end: '15:30' },
  D: { start: '18:00', end: '18:30' },
}

// 시간(HH:mm)으로 팀 판별
function detectTeamByTime(timeStr) {
  const h = parseInt(timeStr.slice(0, 2), 10)
  if (h >= 6 && h < 11)  return 'A'  // 오전 9시 블록
  if (h >= 11 && h < 14) return 'B'  // 오후 12시 블록
  if (h >= 14 && h < 17) return 'C'  // 오후 3시 블록
  if (h >= 17 && h < 22) return 'D'  // 오후 6시 블록
  return 'A' // 기본값
}

// ─── 초기화 ───────────────────────────────────────────────────────────────────
export async function initGoogleAPI() {
  if (!CLIENT_ID || !API_KEY) {
    throw new Error('Google API 키가 설정되지 않았습니다. .env 파일을 확인하세요.')
  }

  await loadScript('https://apis.google.com/js/api.js')
  await new Promise((resolve, reject) => {
    window.gapi.load('client', async () => {
      try {
        await window.gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] })
        gapiInited = true
        resolve()
      } catch (e) { reject(e) }
    })
  })

  await loadScript('https://accounts.google.com/gsi/client')
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: '',
  })
  gisInited = true
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
}

// ─── 로그인 ───────────────────────────────────────────────────────────────────
export function signIn() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) { reject(new Error('초기화 필요')); return }
    tokenClient.callback = (resp) => {
      if (resp.error) reject(resp)
      else resolve(resp)
    }
    tokenClient.requestAccessToken({ prompt: 'consent' })
  })
}

export function signOut() {
  const token = window.gapi?.client?.getToken()
  if (token) {
    window.google.accounts.oauth2.revoke(token.access_token)
    window.gapi.client.setToken('')
  }
}

export function isSignedIn() {
  return !!window.gapi?.client?.getToken()
}

// ─── 캘린더 목록 ───────────────────────────────────────────────────────────────
export async function listCalendars() {
  const res = await window.gapi.client.calendar.calendarList.list()
  return res.result.items || []
}

// ─── 이벤트 조회 (오늘 하루) ──────────────────────────────────────────────────
export async function fetchEvents(calendarId, dateStr) {
  const timeMin = `${dateStr}T00:00:00+09:00`
  const timeMax = `${dateStr}T23:59:59+09:00`
  const res = await window.gapi.client.calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 100,
  })
  return res.result.items || []
}

// ─── 이벤트 생성 ───────────────────────────────────────────────────────────────
export async function createEvent(calendarId, schedule) {
  const event = scheduleToGoogleEvent(schedule)
  const res = await window.gapi.client.calendar.events.insert({ calendarId, resource: event })
  return res.result
}

// ─── 이벤트 수정 ───────────────────────────────────────────────────────────────
export async function updateEvent(calendarId, eventId, schedule) {
  const event = scheduleToGoogleEvent(schedule)
  const res = await window.gapi.client.calendar.events.update({
    calendarId,
    eventId,
    resource: event,
  })
  return res.result
}

// ─── 이벤트 삭제 ───────────────────────────────────────────────────────────────
export async function deleteEvent(calendarId, eventId) {
  await window.gapi.client.calendar.events.delete({ calendarId, eventId })
}

// ─── 변환 유틸 ────────────────────────────────────────────────────────────────
// 앱 일정 → 구글 이벤트 (팀별 고정 시간으로 저장)
export function scheduleToGoogleEvent(s) {
  const dateStr = s.date
  const time = TEAM_TIME[s.team] || TEAM_TIME['A']
  return {
    summary: s.title,
    location: s.location || '',
    description: [
      s.memo ? `메모: ${s.memo}` : '',
      s.phone ? `연락처: ${s.phone}` : '',
      `팀: ${s.team}팀`,
      `담당자: ${s.member}`,
      `상태: ${s.status}`,
    ].filter(Boolean).join('\n'),
    // 구글 캘린더에도 팀 고정 시간으로 저장
    start: { dateTime: `${dateStr}T${time.start}:00`, timeZone: 'Asia/Seoul' },
    end:   { dateTime: `${dateStr}T${time.end}:00`,   timeZone: 'Asia/Seoul' },
  }
}

// 구글 이벤트 → 앱 일정 (시간으로 팀 자동 판별 + 고정 시간 적용)
export function googleEventToSchedule(event, nextId) {
  const startDt = event.start?.dateTime || event.start?.date
  const date = startDt ? startDt.slice(0, 10) : ''

  // 구글 이벤트 시작 시간으로 팀 판별
  const rawStart = event.start?.dateTime
    ? new Date(event.start.dateTime).toTimeString().slice(0, 5)
    : '09:00'

  // description에서 팀 정보 우선 파싱, 없으면 시간으로 판별
  const desc = event.description || ''
  const teamMatch = desc.match(/팀:\s*([ABCD])팀/)
  const team = teamMatch ? teamMatch[1] : detectTeamByTime(rawStart)

  // 팀 고정 시간 적용 (구글에서 임의 시간으로 들어와도 정규화)
  const fixedTime = TEAM_TIME[team]

  // 제목에서 담당자 파싱
  const title = event.summary || '새 일정'
  const memberMatch = title.match(/^(.+?)\s*\//)
  const member = memberMatch ? memberMatch[1].trim() : '미배정'

  const statusMatch = desc.match(/상태:\s*(\S+)/)
  const status = statusMatch ? statusMatch[1] : '예정'
  const memoMatch = desc.match(/메모:\s*(.+?)(?:\n|$)/)
  const memo = memoMatch ? memoMatch[1] : ''
  const phoneMatch = desc.match(/연락처:\s*(.+?)(?:\n|$)/)
  const phone = phoneMatch ? phoneMatch[1] : ''

  return {
    id: nextId,
    googleEventId: event.id,
    team,
    member,
    title,
    date,
    start: fixedTime.start,  // 팀 고정 시간 적용
    end: fixedTime.end,       // 팀 고정 시간 적용
    location: event.location || '',
    phone,
    status,
    memo,
  }
}
