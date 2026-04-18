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
  { id: 1, team: 'A', member: '김대리', title: '김대리 / 성수 신규 설치', date: todayStr(), start: '09:00', end: '09:40', location: '서울 성동구 성수이로 100', phone: '010-1234-5678', status: '예정', memo: '장비 세팅 및 초기 교육', googleEventId: null },
  { id: 2, team: 'A', member: '이주임', title: '이주임 / 강동 A/S', date: todayStr(), start: '10:00', end: '10:40', location: '서울 강동구 천호대로 222', phone: '010-5555-1212', status: '진행중', memo: '출력 오류 점검', googleEventId: null },
  { id: 3, team: 'B', member: '박사원', title: '박사원 / 분당 정기 점검', date: todayStr(), start: '12:00', end: '12:40', location: '경기 성남시 분당구 판교역로 50', phone: '010-7777-9999', status: '예정', memo: '월간 순회', googleEventId: null },
  { id: 4, team: 'C', member: '최대리', title: '최대리 / 강남 고객사 점검', date: todayStr(), start: '15:00', end: '15:40', location: '서울 강남구 테헤란로 10', phone: '010-1010-1111', status: '예정', memo: '정기 방문', googleEventId: null },
  { id: 5, team: 'C', member: '한과장', title: '한과장 / 잠실 긴급 장애', date: todayStr(), start: '15:30', end: '16:10', location: '서울 송파구 석촌호수로 88', phone: '010-2323-9898', status: '특이', memo: '네트워크 연결 불가 - 긴급 대응', googleEventId: null },
  { id: 6, team: 'C', member: '오주임', title: '오주임 / 문정 업그레이드', date: todayStr(), start: '16:20', end: '17:10', location: '서울 송파구 법원로 120', phone: '010-4545-7878', status: '완료', memo: '펌웨어 업그레이드 완료', googleEventId: null },
  { id: 7, team: 'D', member: '미배정', title: '인천 야간 점검', date: todayStr(), start: '18:00', end: '18:50', location: '인천 연수구 센트럴로 123', phone: '010-3030-2121', status: '예정', memo: '종료 전 체크', googleEventId: null },
]

const STORAGE_KEY = 'cs_schedule_state_v1'

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
      const newItem = { ...action.payload, id: state.nextId }
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
        schedules: state.schedules.map(s =>
          s.id === action.id ? { ...s, date: action.date, status: '예정' } : s
        ),
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
      const incoming = action.events
      // 기존 일정에서 구글 eventId가 있는 것들의 수정 플래그 확인
      const existingMap = {}
      state.schedules.forEach(s => {
        if (s.googleEventId) existingMap[s.googleEventId] = s
      })
      // 스마트 머지: 구글 이벤트와 매칭되는 기존 일정은 수정된 내용 유지
      const merged = incoming.map(ev => {
        const existing = existingMap[ev.googleEventId]
        if (existing) {
          // 이미 앱에 있는 일정 → 앱에서 수정한 내용 우선 보존
          // 구글에서 다시 가져와도 상태/담당자/메모등 앱 수정사항 유지
          return { ...ev, id: existing.id, status: existing.status, member: existing.member, memo: existing.memo, phone: existing.phone }
        }
        return ev
      })
      // 구글 eventId 없는 일정(앞에서 직접 추가한 것)들도 유지
      const localOnly = state.schedules.filter(s => !s.googleEventId)
      const all = [...localOnly, ...merged]
      return {
        ...state,
        schedules: all,
        nextId: Math.max(...all.map(s => s.id), state.nextId) + 1,
      }
    }
    case 'ADD_SYNC_LOG':
      return { ...state, syncLogs: [action.log, ...state.syncLogs].slice(0, 20) }
    case 'RESET':
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
