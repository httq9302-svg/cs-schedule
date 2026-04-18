import { useState } from 'react'
import { Plus, X, ChevronDown, ChevronUp, Info, Shield, ExternalLink, Copy, Check } from 'lucide-react'
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

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs text-blue-600 font-medium active:text-blue-800"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? '복사됨' : '복사'}
    </button>
  )
}

export default function SettingsPage() {
  const { state, actions } = useStore()
  const [calendarId, setCalendarId] = useState(state.googleCalendarId)
  const [saved, setSaved] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

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

            {/* 현재 연결된 캘린더 */}
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-xs font-semibold text-slate-500">현재 연결된 캘린더</p>
                <p className="text-sm font-medium text-slate-900 mt-0.5">
                  {state.googleCalendarId || 'firstoa8@gmail.com'}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                state.googleConnected
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {state.googleConnected ? '연결됨' : '확인 중'}
              </span>
            </div>

            {/* 캘린더 변경 안내 버튼 */}
            <button
              onClick={() => setShowGuide(o => !o)}
              className="w-full flex items-center justify-between py-2.5 px-3 bg-blue-50 rounded-xl active:bg-blue-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Info size={14} className="text-blue-500" />
                <span className="text-sm font-semibold text-blue-700">다른 캘린더로 변경하는 방법</span>
              </div>
              {showGuide
                ? <ChevronUp size={14} className="text-blue-400" />
                : <ChevronDown size={14} className="text-blue-400" />
              }
            </button>

            {showGuide && (
              <div className="bg-blue-50 rounded-xl p-4 space-y-3 text-xs text-blue-800">
                <p className="font-bold text-sm text-blue-900">캘린더 변경 방법 (2단계)</p>

                {/* 1단계 */}
                <div className="space-y-1.5">
                  <p className="font-semibold text-blue-800">① 새 캘린더에 서비스 계정 공유</p>
                  <p className="text-blue-700 leading-relaxed">
                    구글 캘린더 → 변경할 캘린더 설정 → <strong>특정 사용자와 공유</strong>에서 아래 서비스 계정 이메일을 추가하고 <strong>"일정 변경 가능"</strong> 권한 부여
                  </p>
                  <div className="bg-white rounded-lg p-2.5 flex items-center justify-between gap-2">
                    <code className="text-xs text-slate-700 break-all flex-1">
                      cs-schedule-sync@gen-lang-client-0911669357.iam.gserviceaccount.com
                    </code>
                    <CopyButton text="cs-schedule-sync@gen-lang-client-0911669357.iam.gserviceaccount.com" />
                  </div>
                </div>

                {/* 2단계 */}
                <div className="space-y-1.5">
                  <p className="font-semibold text-blue-800">② Vercel 환경변수 변경</p>
                  <p className="text-blue-700 leading-relaxed">
                    <a
                      href="https://vercel.com/httq9302-8629s-projects/cs-schedule/settings/environment-variables"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-semibold"
                    >
                      Vercel 환경변수 설정 페이지 →
                    </a>
                    에서 <code className="bg-white px-1 rounded">VITE_GOOGLE_CALENDAR_ID</code> 값을 새 캘린더 ID로 변경 후 재배포
                  </p>
                  <p className="text-blue-600 text-[11px]">
                    캘린더 ID 확인: 구글 캘린더 → 캘린더 설정 → 하단 "캘린더 ID" (예: abc123@group.calendar.google.com)
                  </p>
                </div>

                {/* 개인 계정 캘린더 */}
                <div className="bg-white rounded-lg p-2.5">
                  <p className="font-semibold text-blue-800 mb-1">개인 계정 기본 캘린더인 경우</p>
                  <p className="text-blue-700 leading-relaxed">
                    캘린더 ID = 구글 계정 이메일 주소 (예: <code>yourname@gmail.com</code>)
                  </p>
                </div>
              </div>
            )}
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
