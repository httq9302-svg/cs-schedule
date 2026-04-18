import { CheckSquare, CalendarDays, Settings, RefreshCw } from 'lucide-react'

const TABS = [
  { id: 'today',    label: '오늘',   Icon: CheckSquare },
  { id: 'calendar', label: '캘린더', Icon: CalendarDays },
  { id: 'settings', label: '설정',   Icon: Settings },
  { id: 'sync',     label: '동기화', Icon: RefreshCw },
]

export default function NavBar({ active, onChange, syncConnected }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-100 safe-bottom"
         style={{ maxWidth: 480, margin: '0 auto' }}>
      <div className="grid grid-cols-4 h-16">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = active === id
          const showDot = id === 'sync' && syncConnected
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors relative ${
                isActive ? 'text-slate-900' : 'text-slate-400'
              }`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
                {showDot && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-white" />
                )}
              </div>
              <span className={`text-[10px] font-medium ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                {label}
              </span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-slate-900 rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
