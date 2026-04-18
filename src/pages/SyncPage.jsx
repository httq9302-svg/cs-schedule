import { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, Download, Upload, CheckCircle, AlertTriangle, LogIn, LogOut, CalendarDays, Clock } from 'lucide-react'
import dayjs from 'dayjs'
import { useStore } from '@/store/useStore.jsx'
import {
  initGoogleAPI,
  signIn,
  signOut,
  isSignedIn,
  ensureValidToken,
  listCalendars,
  fetchAllEvents,
  createEvent,
  updateEvent,
  googleEventToSchedule,
} from '@/lib/googleCalendar'

const AUTO_SYNC_INTERVAL = 5 * 60 * 1000 // 5분

export default function SyncPage() {
  const { state, actions } = useStore()
  const [loading, setLoading] = useState(false)
  const [apiReady, setApiReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [calendars, setCalendars] = useState([])
  const [selectedCalId, setSelectedCalId] = useState(state.googleCalendarId || '')
  const [initError, setInitError] = useState('')
  const [lastSyncTime, setLastSyncTime] = useState(null)
  const [nextSyncIn, setNextSyncIn] = useState(null)
  const autoSyncTimer = useRef(null)
  const countdownTimer = useRef(null)

  // ── 가져오기 핵심 로직 (전체 일정) ───────────────────────────────────────────
  const doImport = useCallback(async (calId, silent = false) => {
    if (!calId) return
    if (!silent) setLoading(true)
    try {
      await ensureValidToken()

      // ★ 전체 일정 가져오기 (날짜 범위 없음)
      const events = await fetchAllEvents(calId)

      let nextId = Math.max(...state.schedules.map(s => s.id), 0) + 1
      const mapped = events.map(ev => {
        const s = googleEventToSchedule(ev, nextId)
        nextId++
        return s
      })

      actions.importFromGoogle(mapped)
      actions.setGoogleCalendarId(calId)

      const now = dayjs()
      setLastSyncTime(now)
      setNextSyncIn(AUTO_SYNC_INTERVAL / 1000)

      const msg = silent
        ? `자동 동기화 완료 (${mapped.length}개)`
        : `가져오기 완료 (${mapped.length}개 일정)`

      actions.addSyncLog({ time: now.format('HH:mm'), type: 'import', msg, ok: true })
    } catch (e) {
      const errMsg = e?.result?.error?.message || e?.message || String(e)
      if (!silent) {
        actions.addSyncLog({
          time: dayjs().format('HH:mm'),
          type: 'import',
          msg: `가져오기 실패: ${errMsg}`,
          ok: false,
        })
      }
      if (errMsg.includes('로그인이 필요')) {
        setSignedIn(false)
      }
    }
    if (!silent) setLoading(false)
  }, [state.schedules, actions])

  // ── 5분 자동 동기화 ───────────────────────────────────────────────────────────
  const startAutoSync = useCallback((calId) => {
    if (autoSyncTimer.current) clearInterval(autoSyncTimer.current)
    if (countdownTimer.current) clearInterval(countdownTimer.current)
    setNextSyncIn(AUTO_SYNC_INTERVAL / 1000)
    autoSyncTimer.current = setInterval(() => doImport(calId, true), AUTO_SYNC_INTERVAL)
    countdownTimer.current = setInterval(() => {
      setNextSyncIn(prev => (prev <= 1 ? AUTO_SYNC_INTERVAL / 1000 : prev - 1))
    }, 1000)
  }, [doImport])

  const stopAutoSync = useCallback(() => {
    if (autoSyncTimer.current) clearInterval(autoSyncTimer.current)
    if (countdownTimer.current) clearInterval(countdownTimer.current)
    setNextSyncIn(null)
  }, [])

  // ── Google API 초기화 ─────────────────────────────────────────────────────────
  useEffect(() => {
    initGoogleAPI()
      .then(async () => {
        setApiReady(true)
        const alreadySignedIn = isSignedIn()
        setSignedIn(alreadySignedIn)
        if (alreadySignedIn) {
          try {
            await ensureValidToken()
            const cals = await listCalendars()
            setCalendars(cals)
            const savedCalId = state.googleCalendarId
            if (savedCalId) {
              await doImport(savedCalId, true)
              startAutoSync(savedCalId)
            }
          } catch (e) {
            console.warn('자동 로그인 실패:', e.message)
            setSignedIn(false)
          }
        }
      })
      .catch(err => setInitError(err.message || 'Google API 초기화 실패'))

    return () => stopAutoSync()
  }, []) // eslint-disable-line

  // ── 로그인 ────────────────────────────────────────────────────────────────────
  const handleSignIn = async () => {
    setLoading(true)
    try {
      // 먼저 팝업 없이 시도, 실패 시 동의 화면 표시
      try {
        await signIn(false) // prompt: 'none'
      } catch {
        await signIn(true)  // prompt: 'consent' (fallback)
      }
      setSignedIn(true)
      actions.setGoogleConnected(true)
      const cals = await listCalendars()
      setCalendars(cals)
      actions.addSyncLog({ time: dayjs().format('HH:mm'), type: 'auth', msg: '구글 로그인 성공', ok: true })
      const calId = state.googleCalendarId || (cals[0]?.id || '')
      if (calId) {
        setSelectedCalId(calId)
        await doImport(calId, false)
        startAutoSync(calId)
      }
    } catch (e) {
      const msg = e?.message || e?.error || String(e)
      actions.addSyncLog({ time: dayjs().format('HH:mm'), type: 'auth', msg: `로그인 실패: ${msg}`, ok: false })
    }
    setLoading(false)
  }

  const handleSignOut = () => {
    signOut()
    setSignedIn(false)
    actions.setGoogleConnected(false)
    setCalendars([])
    stopAutoSync()
  }

  // ── 수동 가져오기 ─────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!selectedCalId) { alert('캘린더를 선택하거나 ID를 입력하세요.'); return }
    await doImport(selectedCalId, false)
    startAutoSync(selectedCalId)
  }

  // ── 캘린더 변경 ───────────────────────────────────────────────────────────────
  const handleCalendarChange = (calId) => {
    setSelectedCalId(calId)
    actions.setGoogleCalendarId(calId)
    if (signedIn && calId) {
      doImport(calId, true)
      startAutoSync(calId)
    }
  }

  // ── 반영하기 (앱 → 구글) ──────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!selectedCalId) { alert('캘린더를 선택하거나 ID를 입력하세요.'); return }
    setLoading(true)
    let successCount = 0
    let failCount = 0

    // ★ 전체 일정 반영 (오늘 이후 일정만, 과거 완료 일정 제외)
    const today = dayjs().format('YYYY-MM-DD')
    const targetSchedules = state.schedules.filter(s => s.date >= today)

    if (targetSchedules.length === 0) {
      actions.addSyncLog({
        time: dayjs().format('HH:mm'),
        type: 'export',
        msg: '반영할 일정이 없습니다. 먼저 일정을 추가하거나 가져오기를 해주세요.',
        ok: false,
      })
      setLoading(false)
      return
    }

    for (const s of targetSchedules) {
      try {
        await ensureValidToken()
        if (s.googleEventId) {
          await updateEvent(selectedCalId, s.googleEventId, s)
        } else {
          const created = await createEvent(selectedCalId, s)
          actions.updateSchedule({ ...s, googleEventId: created.id })
        }
        successCount++
      } catch (e) {
        console.error('반영 실패:', s.title, e)
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

  const formatCountdown = (secs) => {
    if (!secs) return ''
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <header className="bg-slate-900 text-white px-5 pt-12 pb-5 safe-top shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-2xl flex items-center justify-center">
              <CalendarDays size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">동기화</h1>
              <p className="text-xs text-slate-400">구글 캘린더 연동</p>
            </div>
          </div>
          {signedIn && nextSyncIn && (
            <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl">
              <Clock size={12} className="text-emerald-400" />
              <span className="text-xs text-emerald-300 tabular-nums">
                {formatCountdown(nextSyncIn)} 후 자동 갱신
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-4">

        {/* API 키 미설정 안내 */}
        {noApiKey && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex gap-2">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 space-y-1">
                <p className="font-semibold">Google API 키 설정 필요</p>
                <div className="bg-amber-100 rounded-lg p-2 font-mono text-xs mt-1">
                  VITE_GOOGLE_CLIENT_ID=your_client_id<br />
                  VITE_GOOGLE_API_KEY=your_api_key
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 초기화 오류 */}
        {initError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <div className="flex gap-2">
              <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">초기화 오류</p>
                <p className="text-xs text-red-600 mt-0.5">{initError}</p>
              </div>
            </div>
          </div>
        )}

        {/* 연결 상태 카드 */}
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
                  <span className={`w-1.5 h-1.5 rounded-full ${signedIn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                  <span className="text-xs text-slate-500">
                    {signedIn
                      ? lastSyncTime
                        ? `연결됨 · ${lastSyncTime.format('HH:mm')} 동기화`
                        : '연결됨'
                      : '미연결'
                    }
                  </span>
                </div>
              </div>
            </div>
            {signedIn ? (
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl hover:bg-slate-200 transition-colors"
              >
                <LogOut size={13} />
                로그아웃
              </button>
            ) : null}
          </div>

          {/* 캘린더 선택 */}
          {signedIn && (
            <div className="mb-4">
              <label className="text-xs text-slate-500 font-medium mb-1.5 block">사용할 캘린더 선택</label>
              {calendars.length > 0 ? (
                <select
                  value={selectedCalId}
                  onChange={e => handleCalendarChange(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {calendars.map(cal => (
                    <option key={cal.id} value={cal.id}>{cal.summary}</option>
                  ))}
                </select>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={selectedCalId}
                    onChange={e => setSelectedCalId(e.target.value)}
                    placeholder="캘린더 ID (예: example@gmail.com)"
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* 로그인 버튼 */}
          {!signedIn && apiReady && (
            <button
              onClick={handleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
            >
              <LogIn size={16} />
              구글 로그인
            </button>
          )}
        </div>

        {/* 동기화 버튼 */}
        {signedIn && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleImport}
              disabled={loading || !selectedCalId}
              className="bg-white rounded-2xl p-5 shadow-sm flex flex-col items-center gap-2 hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-40"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center">
                <Download size={20} className="text-blue-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-900">가져오기</p>
                <p className="text-xs text-slate-500 mt-0.5">구글 캘린더 → 앱</p>
              </div>
            </button>

            <button
              onClick={handleExport}
              disabled={loading || !selectedCalId}
              className="bg-slate-900 rounded-2xl p-5 shadow-sm flex flex-col items-center gap-2 hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-40"
            >
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                <Upload size={20} className="text-white" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-white">반영하기</p>
                <p className="text-xs text-white/60 mt-0.5">앱 수정 → 구글 캘린더</p>
              </div>
            </button>
          </div>
        )}

        {/* 로딩 인디케이터 */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-3">
            <RefreshCw size={16} className="text-blue-500 animate-spin" />
            <span className="text-sm text-slate-500">처리 중...</span>
          </div>
        )}

        {/* 동기화 기록 */}
        {state.syncLogs.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 mb-3">동기화 기록</p>
            <div className="space-y-2">
              {state.syncLogs.map((log, i) => (
                <div key={i} className="flex items-start gap-2">
                  {log.ok
                    ? <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                    : <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  }
                  <span className="text-xs text-slate-600 flex-1">{log.msg}</span>
                  <span className="text-xs text-slate-400 shrink-0">{log.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
