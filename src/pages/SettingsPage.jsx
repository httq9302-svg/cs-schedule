import { useState } from 'react'
import { Plus, X, ChevronDown, ChevronUp, Info, Shield } from 'lucide-react'
import { useStore } from '@/store/useStore.jsx'

const TEAMS = [
  { id: 'A', label: 'A팀', sub: '오전 9시 블록' },
  { id: 'B', label: 'B팀', sub: '오후 12시 블록' },
  { id: 'C', label: 'C팀', sub: '오후 3시 블록' },
  { id: 'D', label: 'D팀', sub: '오후 6시 블록' },
]

function TeamSection({ team, members, onAdd, onRemove }) {
  const [open, setOpen] = useState(true)
  const [newName, setNewName] = useState('')

  const handleAdd = () => {
    const name = newName.trim()
    if (!name) return
    onAdd(team.id, name)
    setNewName('')
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 active:bg-slate-50"
      >
        <div className="text-left">
          <p className="text-sm font-bold text-slate-900">{team.label}</p>
          <p className="text-xs text-slate-400 mt-0.5">{team.sub} · {members.length}명</p>
        </div>
        {open ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-50">
          <div className="flex flex-wrap gap-2 mt-3 mb-3">
            {members.map(m => (
              <div key={m} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${
                m === '미배정' ? 'bg-slate-50 text-slate-400 border-slate-200' : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}>
                {m}
                {m !== '미배정' && (
                  <button
                    onClick={() => onRemove(team.id, m)}
                    className="w-4 h-4 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="이름 입력 후 추가"
              className="flex-1 h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            />
            <button
              onClick={handleAdd}
              className="w-9 h-9 bg-slate-900 text-white rounded-xl flex items-center justify-center active:bg-slate-700"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const { state, actions } = useStore()
  const [calendarId, setCalendarId] = useState(state.googleCalendarId)
  const [saved, setSaved] = useState(false)

  const handleSaveCalendarId = () => {
    actions.setGoogleCalendarId(calendarId.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    if (window.confirm('모든 데이터를 초기화할까요?\n이 작업은 되돌릴 수 없습니다.')) {
      actions.reset()
    }
  }

  return (
    <div className="flex flex-col h-full">
      <header className="bg-slate-900 text-white px-5 pt-12 pb-5 safe-top shrink-0">
        <h1 className="text-2xl font-bold">설정</h1>
        <p className="text-sm text-slate-400 mt-1">팀원 관리 및 구글 캘린더 연동</p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-6">

        {/* ── 팀원 관리 ── */}
        <section>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">팀원 관리</h2>
          <div className="space-y-3">
            {TEAMS.map(team => (
              <TeamSection
                key={team.id}
                team={team}
                members={state.members[team.id] || []}
                onAdd={actions.addMember}
                onRemove={actions.removeMember}
              />
            ))}
          </div>
        </section>

        {/* ── 구글 캘린더 설정 ── */}
        <section>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">구글 캘린더 연동</h2>
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">공유 캘린더 ID</label>
              <div className="flex gap-2">
                <input
                  value={calendarId}
                  onChange={e => setCalendarId(e.target.value)}
                  placeholder="team@company.com 또는 캘린더 ID"
                  className="flex-1 h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                />
                <button
                  onClick={handleSaveCalendarId}
                  className={`px-4 h-11 rounded-xl text-sm font-semibold transition-all ${
                    saved ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white active:bg-slate-700'
                  }`}
                >
                  {saved ? '저장됨 ✓' : '저장'}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                구글 캘린더 → 설정 → 캘린더 설정 → '캘린더 ID'에서 확인
              </p>
            </div>

            <div className="flex items-center gap-2 py-2 border-t border-slate-50">
              <span className={`w-2 h-2 rounded-full ${state.googleConnected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <span className="text-sm text-slate-600">
                {state.googleConnected ? '구글 계정 연결됨' : '미연결 (동기화 탭에서 로그인)'}
              </span>
            </div>

            <div className="bg-blue-50 rounded-xl p-3 flex gap-2">
              <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-700 space-y-1">
                <p className="font-semibold">Google Cloud Console 설정 필요</p>
                <p>1. Calendar API 활성화</p>
                <p>2. OAuth 2.0 클라이언트 ID 생성 (웹 앱)</p>
                <p>3. .env 파일에 VITE_GOOGLE_CLIENT_ID, VITE_GOOGLE_API_KEY 설정</p>
                <p>4. 승인된 JavaScript 원본에 앱 URL 추가</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 앱 정보 ── */}
        <section>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">앱 정보</h2>
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">버전</span>
              <span className="text-slate-900 font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">총 일정 수</span>
              <span className="text-slate-900 font-medium">{state.schedules.length}건</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">데이터 저장</span>
              <span className="text-emerald-600 font-medium flex items-center gap-1">
                <Shield size={12} /> 로컬 자동 저장
              </span>
            </div>
            <div className="border-t border-slate-50 pt-3">
              <button
                onClick={handleReset}
                className="text-rose-500 text-sm font-medium active:text-rose-700"
              >
                데이터 초기화
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
