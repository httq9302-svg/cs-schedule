import { useState, useEffect } from 'react'
import { RefreshCw, Download, Upload, CheckCircle, AlertTriangle, LogIn, LogOut, CalendarDays } from 'lucide-react'
import dayjs from 'dayjs'
import { useStore } from '@/store/useStore.jsx'
import {
  initGoogleAPI,
  signIn,
  signOut,
  isSignedIn,
  listCalendars,
  fetchEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  googleEventToSchedule,
} from '@/lib/googleCalendar'

export default function SyncPage() {
  const { state, actions } = useStore()
  const [loading, setLoading] = useState(false)
  const [apiReady, setApiReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [calendars, setCalendars] = useState([])
  const [selectedCalId, setSelectedCalId] = useState(state.googleCalendarId || '')
  const [initError, setInitError] = useState('')

  // Google API 초기화
  useEffect(() => {
    initGoogleAPI()
      .then(() => {
        setApiReady(true)
        setSignedIn(isSignedIn())
      })
      .catch(err => {
        setInitError(err.message || 'Google API 초기화 실패')
      })
  }, [])

  const handleSignIn = async () => {
    setLoading(true)
    try {
      await signIn()
      setSignedIn(true)
      actions.setGoogleConnected(true)
      // 캘린더 목록 가져오기
      const cals = await listCalendars()
      setCalendars(cals)
      actions.addSyncLog({ time: dayjs().format('HH:mm'), type: 'auth', msg: '구글 로그인 성공', ok: true })
    } catch (e) {
      actions.addSyncLog({ time: dayjs().format('HH:mm'), type: 'auth', msg: `로그인 실패: ${e.message || e}`, ok: false })
    }
    setLoading(false)
  }

  const handleSignOut = () => {
    signOut()
    setSignedIn(false)
    actions.setGoogleConnected(false)
    setCalendars([])
  }

  // 구글 → 앱 가져오기
  const handleImport = async () => {
    if (!selectedCalId) { alert('캘린더를 선택하거나 ID를 입력하세요.'); return }
    setLoading(true)
    try {
      const today = dayjs().format('YYYY-MM-DD')
      const events = await fetchEvents(selectedCalId, today)
      let nextId = Math.max(...state.schedules.map(s => s.id), 0) + 1
      const mapped = events.map(ev => {
        const s = googleEventToSchedule(ev, nextId)
        nextId++
        return s
      })
      actions.importFromGoogle(mapped)
      actions.setGoogleCalendarId(selectedCalId)
      actions.addSyncLog({
        time: dayjs().format('HH:mm'),
        type: 'import',
        msg: `가져오기 완료 (${mapped.length}개 일정)`,
        ok: true,
      })
    } catch (e) {
      const errMsg = e?.result?.error?.message || e?.message || JSON.stringify(e)
      actions.addSyncLog({ time: dayjs().format('HH:mm'), type: 'import', msg: `가져오기 실패: ${errMsg}`, ok: false })
    }
    setLoading(false)
  }

  // 앱 → 구글 반영하기
  const handleExport = async () => {
    if (!selectedCalId) { alert('캘린더를 선택하거나 ID를 입력하세요.'); return }
    setLoading(true)
    let successCount = 0
    let failCount = 0

    for (const s of state.schedules) {
      try {
        if (s.googleEventId) {
          await updateEvent(selectedCalId, s.googleEventId, s)
        } else {
          const created = await createEvent(selectedCalId, s)
          actions.updateSchedule({ ...s, googleEventId: created.id })
        }
        successCount++
      } catch (e) {
        failCount++
      }
    }

    actions.addSyncLog({
      time: dayjs().format('HH:mm'),
      type: 'export',
      msg: `반영 완료 (성공 ${successCount}개${failCount > 0 ? `, 실패 ${failCount}개` : ''})`,
      ok: failCount === 0,
    })
    setLoading(false)
  }

  const noApiKey = !import.meta.env.VITE_GOOGLE_CLIENT_ID

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <header className="bg-slate-900 text-white px-5 pt-12 pb-5 safe-top shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/15 rounded-2xl flex items-center justify-center">
            <CalendarDays size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">동기화</h1>
            <p className="text-xs text-slate-400">구글 캘린더 연동</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-4">

        {/* ── API 키 미설정 안내 ── */}
        {noApiKey && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex gap-2">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 space-y-1">
                <p className="font-semibold">Google API 키 설정 필요</p>
                <p>프로젝트 루트에 <code className="bg-amber-100 px-1 rounded">.env</code> 파일을 생성하고:</p>
                <div className="bg-amber-100 rounded-lg p-2 font-mono text-xs mt-1">
                  VITE_GOOGLE_CLIENT_ID=your_client_id<br />
                  VITE_GOOGLE_API_KEY=your_api_key
                </div>
                <p className="text-xs">설정 후 앱을 재시작하면 실제 연동이 됩니다.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── 연결 상태 카드 ── */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                signedIn ? 'bg-emerald-100' : 'bg-slate-100'
              }`}>
                <CalendarDays size={20} className={signedIn ? 'text-emerald-600' : 'text-slate-400'} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">구글 캘린더</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${signedIn ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <span className="text-xs text-slate-500">{signedIn ? '연결됨' : '미연결'}</span>
                </div>
              </div>
            </div>
            {apiReady && (
              signedIn ? (
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-3 py-2 rounded-xl active:bg-slate-200"
                >
                  <LogOut size={13} /> 로그아웃
                </button>
              ) : (
                <button
                  onClick={handleSignIn}
                  disabled={loading || noApiKey}
                  className="flex items-center gap-1.5 text-xs text-white bg-slate-900 px-3 py-2 rounded-xl active:bg-slate-700 disabled:opacity-50"
                >
                  <LogIn size={13} /> 구글 로그인
                </button>
              )
            )}
          </div>

          {/* 캘린더 선택 */}
          {signedIn && calendars.length > 0 ? (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">사용할 캘린더 선택</label>
              <select
                value={selectedCalId}
                onChange={e => { setSelectedCalId(e.target.value); actions.setGoogleCalendarId(e.target.value) }}
                className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none"
              >
                <option value="">캘린더 선택...</option>
                {calendars.map(cal => (
                  <option key={cal.id} value={cal.id}>{cal.summary}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">캘린더 ID (직접 입력)</label>
              <input
                value={selectedCalId}
                onChange={e => { setSelectedCalId(e.target.value); actions.setGoogleCalendarId(e.target.value) }}
                placeholder="team@company.com"
                className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* ── 동기화 액션 ── */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleImport}
            disabled={loading || (!signedIn && !noApiKey)}
            className="bg-white rounded-2xl p-4 shadow-sm text-left active:bg-slate-50 disabled:opacity-40 transition-all"
          >
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
              <Download size={18} className="text-blue-600" />
            </div>
            <p className="text-sm font-bold text-slate-900">가져오기</p>
            <p className="text-xs text-slate-400 mt-1">구글 캘린더 → 앱</p>
          </button>

          <button
            onClick={handleExport}
            disabled={loading || (!signedIn && !noApiKey)}
            className="bg-slate-900 rounded-2xl p-4 text-left active:bg-slate-800 disabled:opacity-40 transition-all"
          >
            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center mb-3">
              <Upload size={18} className="text-white" />
            </div>
            <p className="text-sm font-bold text-white">반영하기</p>
            <p className="text-xs text-white/60 mt-1">앱 수정 → 구글 캘린더</p>
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-4 text-slate-500 text-sm">
            <RefreshCw size={16} className="animate-spin" />
            처리 중...
          </div>
        )}

        {/* ── 동기화 기록 ── */}
        {state.syncLogs.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">동기화 기록</h2>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {state.syncLogs.map((log, i) => (
                <div key={i} className={`flex items-start gap-3 px-4 py-3 ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                  {log.ok
                    ? <CheckCircle size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                    : <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 leading-snug">{log.msg}</p>
                  </div>
                  <span className="text-xs text-slate-400 tabular-nums shrink-0">{log.time}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 초기화 오류 ── */}
        {initError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-sm text-rose-700">
            <p className="font-semibold mb-1">초기화 오류</p>
            <p>{initError}</p>
          </div>
        )}
      </div>
    </div>
  )
}
