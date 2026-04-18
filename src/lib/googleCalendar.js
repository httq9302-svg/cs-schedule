/**
 * Google Calendar API v3 연동 모듈
 * - 첫 로그인 후 같은 브라우저에서는 자동으로 토큰 갱신 (팝업 없음)
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const API_KEY   = import.meta.env.VITE_GOOGLE_API_KEY   || ''
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'
const SCOPES = 'https://www.googleapis.com/auth/calendar'

// localStorage 키
const LS_TOKEN_KEY   = 'cs_gtoken_v2'   // { access_token, expiry }
const LS_LOGGEDIN_KEY = 'cs_glogged_v2' // 'true' | 없음

let gapiInited = false
let gisInited  = false
let tokenClient = null

// ── 팀별 고정 시간 ───────────────────────────────────────────────────────────
const TEAM_TIME = {
  A: { start: '09:00', end: '09:30' },
  B: { start: '12:00', end: '12:30' },
  C: { start: '15:00', end: '15:30' },
  D: { start: '18:00', end: '18:30' },
}

function detectTeamByTime(timeStr) {
  const h = parseInt(timeStr.slice(0, 2), 10)
  if (h >= 6  && h < 11) return 'A'
  if (h >= 11 && h < 14) return 'B'
  if (h >= 14 && h < 17) return 'C'
  if (h >= 17 && h < 22) return 'D'
  return 'A'
}

// ── 스크립트 로더 ─────────────────────────────────────────────────────────────
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src; s.onload = resolve; s.onerror = reject
    document.head.appendChild(s)
  })
}

// ── 토큰 저장/로드 ────────────────────────────────────────────────────────────
function saveToken(resp) {
  try {
    const expiry = Date.now() + (resp.expires_in || 3600) * 1000
    localStorage.setItem(LS_TOKEN_KEY, JSON.stringify({ access_token: resp.access_token, expiry }))
    localStorage.setItem(LS_LOGGEDIN_KEY, 'true')
    // gapi에도 즉시 적용
    window.gapi.client.setToken({ access_token: resp.access_token })
  } catch {}
}

function loadSavedToken() {
  try {
    const raw = localStorage.getItem(LS_TOKEN_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    // 만료 5분 전까지는 유효
    if (Date.now() < data.expiry - 5 * 60 * 1000) return data
  } catch {}
  return null
}

function clearToken() {
  try {
    localStorage.removeItem(LS_TOKEN_KEY)
    localStorage.removeItem(LS_LOGGEDIN_KEY)
  } catch {}
}

// ── 초기화 ───────────────────────────────────────────────────────────────────
export async function initGoogleAPI() {
  if (!CLIENT_ID || !API_KEY) {
    throw new Error('Google API 키가 설정되지 않았습니다. .env 파일을 확인하세요.')
  }

  // gapi 로드
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

  // GIS 로드
  await loadScript('https://accounts.google.com/gsi/client')
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: '',
  })
  gisInited = true

  // 저장된 토큰이 있으면 gapi에 복원
  const saved = loadSavedToken()
  if (saved) {
    window.gapi.client.setToken({ access_token: saved.access_token })
  }
}

// ── 로그인 (팝업) ─────────────────────────────────────────────────────────────
// forceConsent=true → 항상 계정 선택 화면
// forceConsent=false → 이미 동의한 경우 팝업 없이 처리 시도
export function signIn(forceConsent = false) {
  return new Promise((resolve, reject) => {
    if (!tokenClient) { reject(new Error('초기화 필요')); return }
    tokenClient.callback = (resp) => {
      if (resp.error) { reject(resp); return }
      saveToken(resp)
      resolve(resp)
    }
    // prompt: 'none' → 이미 동의한 계정이면 팝업 없이 바로 토큰 발급
    // prompt: ''     → 필요 시 계정 선택만 (동의 화면 없음)
    // prompt: 'consent' → 항상 동의 화면
    const prompt = forceConsent ? 'consent' : 'none'
    tokenClient.requestAccessToken({ prompt })
  })
}

// ── 팝업 없이 조용히 토큰 갱신 시도 (3초 타임아웃) ──────────────────────────
// 실패하거나 타임아웃이면 false 반환
export function silentSignIn() {
  return new Promise((resolve) => {
    if (!tokenClient) { resolve(false); return }
    let settled = false
    const timer = setTimeout(() => {
      if (!settled) { settled = true; resolve(false) }
    }, 3000)
    tokenClient.callback = (resp) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (resp.error) { resolve(false); return }
      saveToken(resp)
      resolve(true)
    }
    tokenClient.requestAccessToken({ prompt: 'none' })
  })
}

// ── 토큰 유효성 보장 (API 호출 전 항상 호출) ─────────────────────────────────
export async function ensureValidToken() {
  // 1. gapi에 이미 유효한 토큰이 있으면 OK
  const existing = window.gapi?.client?.getToken()
  if (existing?.access_token) {
    const saved = loadSavedToken()
    if (saved) return // 저장된 것도 있으면 확실히 OK
  }

  // 2. localStorage에 저장된 토큰 복원
  const saved = loadSavedToken()
  if (saved) {
    window.gapi.client.setToken({ access_token: saved.access_token })
    return
  }

  // 3. 이전에 로그인한 적 있으면 → 팝업 없이 자동 갱신 시도
  if (localStorage.getItem(LS_LOGGEDIN_KEY) === 'true') {
    const ok = await silentSignIn()
    if (ok) return
  }

  // 4. 모두 실패 → 명시적 로그인 필요
  throw new Error('로그인이 필요합니다. 구글 로그인 버튼을 눌러주세요.')
}

// ── 로그아웃 ──────────────────────────────────────────────────────────────────
export function signOut() {
  const token = window.gapi?.client?.getToken()
  if (token?.access_token) {
    try { window.google.accounts.oauth2.revoke(token.access_token) } catch {}
    window.gapi.client.setToken('')
  }
  clearToken()
}

// ── 로그인 상태 확인 ──────────────────────────────────────────────────────────
export function isSignedIn() {
  if (window.gapi?.client?.getToken()?.access_token) return true
  if (loadSavedToken()) return true
  return localStorage.getItem(LS_LOGGEDIN_KEY) === 'true'
}

// ── 캘린더 목록 ──────────────────────────────────────────────────────────────
export async function listCalendars() {
  await ensureValidToken()
  const res = await window.gapi.client.calendar.calendarList.list()
  return res.result.items || []
}

// ── 날짜 범위 이벤트 조회 ────────────────────────────────────────────────────
export async function fetchEvents(calendarId, dateStr) {
  await ensureValidToken()
  const timeMin = `${dateStr}T00:00:00+09:00`
  const timeMax = `${dateStr}T23:59:59+09:00`
  const res = await window.gapi.client.calendar.events.list({
    calendarId, timeMin, timeMax,
    singleEvents: true, orderBy: 'startTime',
    maxResults: 200, timeZone: 'Asia/Seoul',
  })
  return res.result.items || []
}

// ── 전체 이벤트 조회 (페이지네이션) ─────────────────────────────────────────
export async function fetchAllEvents(calendarId) {
  await ensureValidToken()
  let allItems = []
  let pageToken = undefined
  do {
    const params = {
      calendarId, singleEvents: true,
      orderBy: 'startTime', maxResults: 250,
      timeZone: 'Asia/Seoul',
    }
    if (pageToken) params.pageToken = pageToken
    const res = await window.gapi.client.calendar.events.list(params)
    allItems = allItems.concat(res.result.items || [])
    pageToken = res.result.nextPageToken
  } while (pageToken)
  return allItems
}

// ── 이벤트 생성 ──────────────────────────────────────────────────────────────
export async function createEvent(calendarId, schedule) {
  await ensureValidToken()
  const res = await window.gapi.client.calendar.events.insert({
    calendarId, resource: scheduleToGoogleEvent(schedule),
  })
  return res.result
}

// ── 이벤트 수정 ──────────────────────────────────────────────────────────────
export async function updateEvent(calendarId, eventId, schedule) {
  await ensureValidToken()
  const res = await window.gapi.client.calendar.events.update({
    calendarId, eventId, resource: scheduleToGoogleEvent(schedule),
  })
  return res.result
}

// ── 이벤트 삭제 ──────────────────────────────────────────────────────────────
export async function deleteEvent(calendarId, eventId) {
  await ensureValidToken()
  await window.gapi.client.calendar.events.delete({ calendarId, eventId })
}

// ── 변환: 앱 일정 → 구글 이벤트 ────────────────────────────────────────────
export function scheduleToGoogleEvent(s) {
  const dateStr = s.date
  const time = TEAM_TIME[s.team] || TEAM_TIME['A']
  const titlePrefix = s.member && s.member !== '미배정' ? `${s.member} / ` : ''
  const cleanTitle = s.title ? s.title.replace(/^.+?\s*\/\s*/, '') : '새 일정'
  return {
    summary: `${titlePrefix}${cleanTitle}`,
    location: s.location || '',
    description: [
      s.memo  ? `메모: ${s.memo}`    : '',
      s.phone ? `연락처: ${s.phone}` : '',
      `팀: ${s.team}팀`,
      `담당자: ${s.member || '미배정'}`,
      `상태: ${s.status || '예정'}`,
    ].filter(Boolean).join('\n'),
    start: { dateTime: `${dateStr}T${time.start}:00`, timeZone: 'Asia/Seoul' },
    end:   { dateTime: `${dateStr}T${time.end}:00`,   timeZone: 'Asia/Seoul' },
  }
}

// ── 변환: 구글 이벤트 → 앱 일정 ────────────────────────────────────────────
export function googleEventToSchedule(event, nextId) {
  let date = ''
  let rawStart = '09:00'

  if (event.start?.dateTime) {
    const d = new Date(event.start.dateTime)
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
    date = kst.toISOString().slice(0, 10)
    rawStart = kst.toISOString().slice(11, 16)
  } else if (event.start?.date) {
    date = event.start.date
  }

  const desc = event.description || ''
  const teamMatch = desc.match(/팀:\s*([ABCD])팀/)
  const team = teamMatch ? teamMatch[1] : detectTeamByTime(rawStart)
  const fixedTime = TEAM_TIME[team]

  const title = event.summary || '새 일정'
  const slashIdx = title.indexOf(' / ')
  let member = '미배정'
  let cleanTitle = title
  if (slashIdx > 0) {
    member = title.slice(0, slashIdx).trim()
    cleanTitle = title.slice(slashIdx + 3).trim()
  }

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
    team, member, title: cleanTitle,
    date, start: fixedTime.start, end: fixedTime.end,
    location: event.location || '',
    phone, status, memo,
  }
}
