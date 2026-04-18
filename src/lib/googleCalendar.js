/**
 * Google Calendar API v3 연동 모듈
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || ''
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'
const SCOPES = 'https://www.googleapis.com/auth/calendar'
const TOKEN_STORAGE_KEY = 'cs_google_token_v1'

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
  if (h >= 6 && h < 11)  return 'A'
  if (h >= 11 && h < 14) return 'B'
  if (h >= 14 && h < 17) return 'C'
  if (h >= 17 && h < 22) return 'D'
  return 'A'
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

// ─── 로그인 (팝업) ────────────────────────────────────────────────────────────
export function signIn(forceConsent = false) {
  return new Promise((resolve, reject) => {
    if (!tokenClient) { reject(new Error('초기화 필요')); return }
    tokenClient.callback = (resp) => {
      if (resp.error) { reject(resp); return }
      // 토큰 만료 시간 저장
      const expiry = Date.now() + (resp.expires_in || 3600) * 1000
      try { localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ expiry })) } catch {}
      resolve(resp)
    }
    tokenClient.requestAccessToken({ prompt: forceConsent ? 'consent' : '' })
  })
}

// ─── 토큰 자동 갱신 (팝업 없이) ──────────────────────────────────────────────
// API 호출 전 항상 이 함수를 먼저 호출해야 함
export async function ensureValidToken() {
  // 이미 gapi에 토큰이 있으면 OK
  const existing = window.gapi?.client?.getToken()
  if (existing?.access_token) return

  // localStorage에서 만료 시간 확인
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (raw) {
      const { expiry } = JSON.parse(raw)
      if (Date.now() < expiry - 60000) {
        // 아직 유효 → 팝업 없이 조용히 토큰 갱신 시도
        await signIn(false)
        return
      }
    }
  } catch {}

  // 만료됐거나 기록 없으면 명시적 로그인 필요
  throw new Error('로그인이 필요합니다. 구글 로그인 버튼을 눌러주세요.')
}

export function signOut() {
  const token = window.gapi?.client?.getToken()
  if (token) {
    window.google.accounts.oauth2.revoke(token.access_token)
    window.gapi.client.setToken('')
  }
  try { localStorage.removeItem(TOKEN_STORAGE_KEY) } catch {}
}

export function isSignedIn() {
  if (window.gapi?.client?.getToken()?.access_token) return true
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (raw) {
      const { expiry } = JSON.parse(raw)
      return Date.now() < expiry - 60000
    }
  } catch {}
  return false
}

// ─── 캘린더 목록 ───────────────────────────────────────────────────────────────
export async function listCalendars() {
  await ensureValidToken()
  const res = await window.gapi.client.calendar.calendarList.list()
  return res.result.items || []
}

// ─── 이벤트 조회 (날짜 범위, 한국 시간 기준) ──────────────────────────────────
export async function fetchEvents(calendarId, dateStr) {
  await ensureValidToken()
  // 한국 시간 기준 하루 전체 (UTC로 변환하면 전날 15:00 ~ 당일 14:59)
  // 넉넉하게 ±1일 범위로 가져와서 날짜 필터링
  const timeMin = `${dateStr}T00:00:00+09:00`
  const timeMax = `${dateStr}T23:59:59+09:00`
  const res = await window.gapi.client.calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 200,
    timeZone: 'Asia/Seoul',
  })
  return res.result.items || []
}

// ─── 날짜 범위 이벤트 조회 ────────────────────────────────────────────────────
export async function fetchEventsRange(calendarId, startDate, endDate) {
  await ensureValidToken()
  const timeMin = `${startDate}T00:00:00+09:00`
  const timeMax = `${endDate}T23:59:59+09:00`
  const res = await window.gapi.client.calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 500,
    timeZone: 'Asia/Seoul',
  })
  return res.result.items || []
}

// ─── 전체 이벤트 조회 (페이지네이션 포함) ────────────────────────────────────
export async function fetchAllEvents(calendarId) {
  await ensureValidToken()
  let allItems = []
  let pageToken = undefined
  do {
    const params = {
      calendarId,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
      timeZone: 'Asia/Seoul',
    }
    if (pageToken) params.pageToken = pageToken
    const res = await window.gapi.client.calendar.events.list(params)
    allItems = allItems.concat(res.result.items || [])
    pageToken = res.result.nextPageToken
  } while (pageToken)
  return allItems
}

// ─── 이벤트 생성 ───────────────────────────────────────────────────────────────
export async function createEvent(calendarId, schedule) {
  await ensureValidToken()
  const event = scheduleToGoogleEvent(schedule)
  const res = await window.gapi.client.calendar.events.insert({ calendarId, resource: event })
  return res.result
}

// ─── 이벤트 수정 ───────────────────────────────────────────────────────────────
export async function updateEvent(calendarId, eventId, schedule) {
  await ensureValidToken()
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
  await ensureValidToken()
  await window.gapi.client.calendar.events.delete({ calendarId, eventId })
}

// ─── 변환 유틸 ────────────────────────────────────────────────────────────────
// 앱 일정 → 구글 이벤트
export function scheduleToGoogleEvent(s) {
  const dateStr = s.date
  const time = TEAM_TIME[s.team] || TEAM_TIME['A']
  // 제목: "담당자 / 업무내용" 형식
  const titlePrefix = s.member && s.member !== '미배정' ? `${s.member} / ` : ''
  const cleanTitle = s.title ? s.title.replace(/^.+?\s*\/\s*/, '') : '새 일정'
  return {
    summary: `${titlePrefix}${cleanTitle}`,
    location: s.location || '',
    description: [
      s.memo     ? `메모: ${s.memo}`       : '',
      s.phone    ? `연락처: ${s.phone}`    : '',
      `팀: ${s.team}팀`,
      `담당자: ${s.member || '미배정'}`,
      `상태: ${s.status || '예정'}`,
    ].filter(Boolean).join('\n'),
    start: { dateTime: `${dateStr}T${time.start}:00`, timeZone: 'Asia/Seoul' },
    end:   { dateTime: `${dateStr}T${time.end}:00`,   timeZone: 'Asia/Seoul' },
  }
}

// 구글 이벤트 → 앱 일정
export function googleEventToSchedule(event, nextId) {
  const startDt = event.start?.dateTime || event.start?.date
  // 날짜: 한국 시간 기준으로 파싱
  let date = ''
  if (event.start?.dateTime) {
    // dateTime은 ISO 8601 형식, 한국 시간대로 변환
    const d = new Date(event.start.dateTime)
    // 한국 시간(UTC+9)으로 날짜 추출
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
    date = kst.toISOString().slice(0, 10)
  } else if (event.start?.date) {
    date = event.start.date
  }

  // 시작 시간 (한국 시간 기준)
  let rawStart = '09:00'
  if (event.start?.dateTime) {
    const d = new Date(event.start.dateTime)
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
    rawStart = kst.toISOString().slice(11, 16)
  }

  // description에서 팀 정보 우선 파싱, 없으면 시간으로 판별
  const desc = event.description || ''
  const teamMatch = desc.match(/팀:\s*([ABCD])팀/)
  const team = teamMatch ? teamMatch[1] : detectTeamByTime(rawStart)
  const fixedTime = TEAM_TIME[team]

  // 제목에서 담당자 파싱 ("담당자 / 업무내용" 형식)
  const title = event.summary || '새 일정'
  const slashIdx = title.indexOf(' / ')
  let member = '미배정'
  let cleanTitle = title
  if (slashIdx > 0) {
    member = title.slice(0, slashIdx).trim()
    cleanTitle = title.slice(slashIdx + 3).trim()
  }

  // description에서 담당자 재확인
  const memberMatch = desc.match(/담당자:\s*(.+?)(?:\n|$)/)
  if (memberMatch && memberMatch[1] !== '미배정') member = memberMatch[1].trim()

  const statusMatch = desc.match(/상태:\s*(\S+)/)
  const status = statusMatch ? statusMatch[1] : '예정'
  const memoMatch = desc.match(/메모:\s*(.+?)(?:\n|$)/)
  const memo = memoMatch ? memoMatch[1].trim() : ''
  const phoneMatch = desc.match(/연락처:\s*(.+?)(?:\n|$)/)
  const phone = phoneMatch ? phoneMatch[1].trim() : ''

  return {
    id: nextId,
    googleEventId: event.id,
    team,
    member,
    title: cleanTitle,
    date,
    start: fixedTime.start,
    end: fixedTime.end,
    location: event.location || '',
    phone,
    status,
    memo,
  }
}
