import { createContext, useContext, useReducer, useCallback, useEffect } from 'react'
import dayjs from 'dayjs'

// ─── 초기 팀원 데이터 ─────────────────────────────────────────────────────────
const DEFAULT_MEMBERS = {
  A: ['미배정', '김대리', '이주임', '정사원'],
  B: ['미배정', '박사원', '윤대리', '서주임'],
  C: ['미배정', '최대리', '한과장', '오주임', '문대리'],
  D: ['미배정', '윤대리', '강주임', '배사원'],
}

const TEAM_LABELS = {
  A: '오전 9시',
  B: '오후 12시',
  C: '오후 3시',
  D: '오후 6시',
}

function todayStr() { return dayjs().format('YYYY-MM-DD') }

const SAMPLE_SCHEDULES = [
  { id: 1, team: 'A', member: '김대리', title: '김대리 / 성수 신규 설치', date: todayStr(), start: '09:00', end: '09:30', location: '서울 성동구 성수이로 100', phone: '010-1234-5678', status: '예정', memo: '장비 세팅 및 초기 교육', googleEventId: null, originalDate: null },
  { id: 2, team: 'A', member: '이주임', title: '이주임 / 강동 A/S', date: todayStr(), start: '09:00', end: '09:30', location: '서울 강동구 천호대로 222', phone: '010-5555-1212', status: '진행중', memo: '출력 오류 점검', googleEventId: null, originalDate: null },
  { id: 3, team: 'B', member: '박사원', title: '박사원 / 분당 정기 점검', date: todayStr(), start: '12:00', end: '12:30', location: '경기 성남시 분당구 판교역로 50', phone: '010-7777-9999', status: '예정', memo: '월간 순회', googleEventId: null, originalDate: null },
  { id: 4, team: 'C', member: '최대리', title: '최대리 / 강남 고객사 점검', date: todayStr(), start: '15:00', end: '15:30', location: '서울 강남구 테헤란로 10', phone: '010-1010-1111', status: '예정', memo: '정기 방문', googleEventId: null, originalDate: null },
  { id: 5, team: 'C', member: '한과장', title: '한과장 / 잠실 긴급 장애', date: todayStr(), start: '15:00', end: '15:30', location: '서울 송파구 석촌호수로 88', phone: '010-2323-9898', status: '특이', memo: '네트워크 연결 불가 - 긴급 대응', googleEventId: null, originalDate: null },
  { id: 6, team: 'C', member: '오주임', title: '오주임 / 문정 업그레이드', date: todayStr(), start: '15:00', end: '15:30', location: '서울 송파구 법원로 120', phone: '010-4545-7878', status: '완료', memo: '펌웨어 업그레이드 완료', googleEventId: null, originalDate: null },
  { id: 7, team: 'D', member: '미배정', title: '인천 야간 점검', date: todayStr(), start: '18:00', end: '18:30', location: '인천 연수구 센트럴로 123', phone: '010-3030-2121', status: '예정', memo: '종료 전 체크', googleEventId: null, originalDate: null },
]

const STORAGE_KEY = 'cs_schedule_state_v2'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function buildInitialState() {
  const saved = loadFromStorage()
  if (saved) return saved
  return {
    schedules: SAMPLE_SCHEDULES,
    members: DEFAULT_MEMBERS,
    teamLabels: TEAM_LABELS,
    googleCalendarId: '',
    googleConnected: false,
    syncLogs: [],
    nextId: SAMPLE_SCHEDULES.length + 1,
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_SCHEDULE': {
      const newItem = { ...action.payload, id: state.nextId, originalDate: action.payload.originalDate || null }
      return { ...state, schedules: [...state.schedules, newItem], nextId: state.nextId + 1 }
    }
    case 'UPDATE_SCHEDULE': {
      return {
        ...state,
        schedules: state.schedules.map(s => s.id === action.payload.id ? { ...s, ...action.payload } : s),
      }
    }
    case 'DELETE_SCHEDULE': {
      return { ...state, schedules: state.schedules.filter(s => s.id !== action.id) }
    }
    case 'SET_STATUS': {
      return {
        ...state,
        schedules: state.schedules.map(s =>
          s.id === action.id ? { ...s, status: action.status } : s
        ),
      }
    }
    case 'POSTPONE_SCHEDULE': {
      return {
        ...state,
        schedules: state.schedules.map(s => {
          if (s.id !== action.id) return s
          // originalDate: 처음 미루는 경우에만 저장 (이미 있으면 유지)
          const originalDate = s.originalDate || s.date
          return { ...s, date: action.date, status: '예정', originalDate }
        }),
      }
    }
    case 'ADD_MEMBER': {
      const team = action.team
      const current = state.members[team] || []
      if (current.includes(action.name)) return state
      return { ...state, members: { ...state.members, [team]: [...current, action.name] } }
    }
    case 'REMOVE_MEMBER': {
      const team = action.team
      const updated = (state.members[team] || []).filter(m => m !== action.name)
      const updatedSchedules = state.schedules.map(s =>
        s.team === team && s.member === action.name
          ? { ...s, member: '미배정', title: s.title.replace(new RegExp(`^${action.name}\\s*/\\s*`), '') }
          : s
      )
      return { ...state, members: { ...state.members, [team]: updated }, schedules: updatedSchedules }
    }
    case 'SET_GOOGLE_CALENDAR_ID':
      return { ...state, googleCalendarId: action.id }
    case 'SET_GOOGLE_CONNECTED':
      return { ...state, googleConnected: action.connected }

    case 'IMPORT_FROM_GOOGLE': {
      const incoming = action.events // 구글에서 가져온 이벤트 배열

      // 기존 앱 일정을 googleEventId 기준으로 맵 생성
      const existingByGoogleId = {}
      state.schedules.forEach(s => {
        if (s.googleEventId) existingByGoogleId[s.googleEventId] = s
      })

      // 구글에서 온 이벤트 처리
      const incomingGoogleIds = new Set()
      let nextId = Math.max(...state.schedules.map(s => s.id), state.nextId - 1) + 1

      const mergedFromGoogle = incoming.map(ev => {
        incomingGoogleIds.add(ev.googleEventId)
        const existing = existingByGoogleId[ev.googleEventId]

        if (existing) {
          // ★ 핵심: 앱에서 수정한 내용을 모두 보존
          // 날짜(미루기), 상태, 담당자, 연락처, originalDate 모두 앱 데이터 우선
          // 메모: 구글 캘린더에 메모가 있으면 구글 우선, 없으면 앱 메모 유지
          return {
            ...ev,                          // 구글 기본 데이터 (title, location 등)
            id: existing.id,                // 기존 ID 유지
            date: existing.date,            // ★ 미룤진 날짜 보존
            status: existing.status,        // ★ 상태 보존 (완료, 특이 등)
            member: existing.member,        // 담당자 보존
            memo: ev.memo || existing.memo, // 구글에 메모 있으면 구글 우선, 없으면 앱 메모 유지
            phone: existing.phone,          // 연락처 보존
            originalDate: existing.originalDate, // ★ 원래 날짜 보존
          }
        }

        // 새로운 구글 이벤트
        const newItem = { ...ev, id: nextId }
        nextId++
        return newItem
      })

      // 앱에서 직접 추가한 일정 (googleEventId 없는 것) → 그대로 유지
      const localOnly = state.schedules.filter(s => !s.googleEventId)

      // 구글에서 삭제된 이벤트는 앱에서도 제거 (선택적: 일단 유지)
      // 현재는 구글에서 삭제해도 앱에 남아있음 → 향후 필요시 추가
      // const deletedFromGoogle = state.schedules.filter(
      //   s => s.googleEventId && !incomingGoogleIds.has(s.googleEventId)
      // )

      const all = [...localOnly, ...mergedFromGoogle]

      return {
        ...state,
        schedules: all,
        nextId: Math.max(...all.map(s => s.id), state.nextId) + 1,
      }
    }

    case 'ADD_SYNC_LOG':
      return { ...state, syncLogs: [action.log, ...state.syncLogs].slice(0, 20) }
    case 'RESET':
      localStorage.removeItem(STORAGE_KEY)
      return buildInitialState()
    default:
      return state
  }
}

export const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, buildInitialState)

  // LocalStorage 자동 저장
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {}
  }, [state])

  const actions = {
    addSchedule: useCallback((payload) => dispatch({ type: 'ADD_SCHEDULE', payload }), []),
    updateSchedule: useCallback((payload) => dispatch({ type: 'UPDATE_SCHEDULE', payload }), []),
    deleteSchedule: useCallback((id) => dispatch({ type: 'DELETE_SCHEDULE', id }), []),
    setStatus: useCallback((id, status) => dispatch({ type: 'SET_STATUS', id, status }), []),
    postponeSchedule: useCallback((id, date) => dispatch({ type: 'POSTPONE_SCHEDULE', id, date }), []),
    addMember: useCallback((team, name) => dispatch({ type: 'ADD_MEMBER', team, name }), []),
    removeMember: useCallback((team, name) => dispatch({ type: 'REMOVE_MEMBER', team, name }), []),
    setGoogleCalendarId: useCallback((id) => dispatch({ type: 'SET_GOOGLE_CALENDAR_ID', id }), []),
    setGoogleConnected: useCallback((connected) => dispatch({ type: 'SET_GOOGLE_CONNECTED', connected }), []),
    importFromGoogle: useCallback((events) => dispatch({ type: 'IMPORT_FROM_GOOGLE', events }), []),
    addSyncLog: useCallback((log) => dispatch({ type: 'ADD_SYNC_LOG', log }), []),
    reset: useCallback(() => {
      localStorage.removeItem(STORAGE_KEY)
      dispatch({ type: 'RESET' })
    }, []),
  }

  return (
    <StoreContext.Provider value={{ state, actions }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  return useContext(StoreContext)
}
