import { useState, useMemo } from 'react'
import { Plus, Search, X, RefreshCw } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'
dayjs.locale('ko')

import { useStore } from '@/store/useStore.jsx'
import ScheduleCard from '@/components/ScheduleCard'
import BottomSheet from '@/components/BottomSheet'
import ScheduleForm from '@/components/ScheduleForm'
import PostponeSheet from '@/components/PostponeSheet'

const TEAMS = [
  { id: 'A', label: 'A팀', sub: '오전 9시' },
  { id: 'B', label: 'B팀', sub: '오후 12시' },
  { id: 'C', label: 'C팀', sub: '오후 3시' },
  { id: 'D', label: 'D팀', sub: '오후 6시' },
]

const STATUS_FILTERS = ['전체', '예정', '진행중', '완료', '익일', '특이']

// 다음 평일 구하기 (토=6, 일=0 건너뜀)
function nextWeekday(dateStr) {
  let d = dayjs(dateStr).add(1, 'day')
  while (d.day() === 0 || d.day() === 6) {
    d = d.add(1, 'day')
  }
  return d.format('YYYY-MM-DD')
}

export default function TodayPage() {
  const { state, actions } = useStore()
  const today = dayjs().format('YYYY-MM-DD')
  const nextWorkday = useMemo(() => nextWeekday(today), [today])

  const [activeTeam, setActiveTeam] = useState('A')
  const [statusFilter, setStatusFilter] = useState('전체')
  const [search, setSearch] = useState('')
  const [editItem, setEditItem] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [postponeItem, setPostponeItem] = useState(null)

  // 일정 필터링
  const displaySchedules = useMemo(() => {
    return state.schedules
      .filter(s => {
        if (s.team !== activeTeam) return false
        if (statusFilter === '익일') return s.date === nextWorkday
        if (statusFilter === '전체') return s.date === today || s.date === nextWorkday
        return s.date === today && s.status === statusFilter
      })
      .filter(s => {
        if (!search) return true
        const q = search.toLowerCase()
        return (s.title + s.location + s.member + (s.memo || '')).toLowerCase().includes(q)
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return a.start.localeCompare(b.start)
      })
  }, [state.schedules, today, nextWorkday, activeTeam, statusFilter, search])

  // 팀별 통계 (오늘 기준)
  const stats = useMemo(() => {
    const items = state.schedules.filter(s => s.date === today && s.team === activeTeam)
    const nextItems = state.schedules.filter(s => s.date === nextWorkday && s.team === activeTeam)
    return {
      total: items.length,
      done: items.filter(s => s.status === '완료').length,
      inProgress: items.filter(s => s.status === '진행중').length,
      issue: items.filter(s => s.status === '특이').length,
      nextDay: nextItems.length,
    }
  }, [state.schedules, today, nextWorkday, activeTeam])

  const handleComplete = (id) => actions.setStatus(id, '완료')
  const handleIssue = (id) => actions.setStatus(id, '특이')

  const handleSave = (formData) => {
    if (formData.id) {
      actions.updateSchedule(formData)
    } else {
      actions.addSchedule({ ...formData, date: formData.date || today })
    }
    setIsFormOpen(false)
    setEditItem(null)
  }

  const handleDelete = (id) => {
    actions.deleteSchedule(id)
    setIsFormOpen(false)
    setEditItem(null)
  }

  const handleTapCard = (item) => {
    setEditItem(item)
    setIsFormOpen(true)
  }

  const handlePostponeConfirm = (id, date) => {
    actions.postponeSchedule(id, date)
  }

  const progressPct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0

  // 필터별 카운트
  const filterCount = (f) => {
    if (f === '전체') return state.schedules.filter(s => (s.date === today || s.date === nextWorkday) && s.team === activeTeam).length
    if (f === '익일') return state.schedules.filter(s => s.date === nextWorkday && s.team === activeTeam).length
    return state.schedules.filter(s => s.date === today && s.team === activeTeam && s.status === f).length
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── 헤더 ── */}
      <header className="bg-slate-900 text-white px-5 pt-12 pb-5 safe-top shrink-0">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-slate-400 font-medium">
              {dayjs().format('YYYY년 M월 D일 dddd')}
            </p>
            <h1 className="text-2xl font-bold mt-0.5">오늘 외근 일정</h1>
          </div>
          <button
            onClick={() => { setEditItem(null); setIsFormOpen(true) }}
            className="w-10 h-10 bg-white/15 rounded-2xl flex items-center justify-center active:bg-white/25 transition-colors mt-1"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* 통계 칩 */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {[
            { label: '전체', value: stats.total, color: 'bg-white/15' },
            { label: '완료', value: stats.done, color: 'bg-emerald-500/30' },
            { label: '진행중', value: stats.inProgress, color: 'bg-amber-500/30' },
            { label: '특이', value: stats.issue, color: stats.issue > 0 ? 'bg-rose-500/40' : 'bg-white/10' },
            { label: '익일', value: stats.nextDay, color: 'bg-blue-500/30' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`${color} rounded-xl px-3 py-2 text-center min-w-[52px] shrink-0`}>
              <p className="text-[10px] text-white/70 font-medium">{label}</p>
              <p className="text-lg font-bold leading-none mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        {/* 진행률 바 */}
        {stats.total > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-white/15 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-emerald-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <span className="text-xs text-white/60 font-medium tabular-nums">{progressPct}%</span>
          </div>
        )}
      </header>

      {/* ── 팀 탭 ── */}
      <div className="bg-white border-b border-slate-100 px-4 pt-3 pb-0 shrink-0">
        <div className="grid grid-cols-4 gap-1">
          {TEAMS.map(({ id, label, sub }) => (
            <button
              key={id}
              onClick={() => setActiveTeam(id)}
              className={`py-2.5 rounded-xl text-center transition-all ${
                activeTeam === id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <p className="text-sm font-bold">{label}</p>
              <p className={`text-[10px] font-medium mt-0.5 ${activeTeam === id ? 'text-white/70' : 'text-slate-400'}`}>{sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── 검색 + 상태 필터 ── */}
      <div className="bg-white px-4 py-3 space-y-2.5 shrink-0 border-b border-slate-100">
        {/* 검색 */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름, 주소, 메모 검색"
            className="w-full h-9 pl-8 pr-8 bg-slate-50 rounded-xl text-sm text-slate-900 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
              <X size={14} />
            </button>
          )}
        </div>

        {/* 상태 필터 */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {STATUS_FILTERS.map(f => {
            const count = filterCount(f)
            return (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`shrink-0 h-7 px-3 rounded-full text-xs font-semibold transition-all ${
                  statusFilter === f
                    ? f === '익일'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {f} {count > 0 && <span className="ml-0.5 opacity-70">{count}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 일정 목록 ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 pb-24 space-y-3">
        {/* 익일 일정 구분선 */}
        {statusFilter === '전체' && displaySchedules.some(s => s.date === nextWorkday) && (
          <div className="flex items-center gap-2 py-1">
            <div className="flex-1 h-px bg-blue-100" />
            <span className="text-xs text-blue-500 font-semibold shrink-0">
              익일 ({dayjs(nextWorkday).format('M/D dddd')})
            </span>
            <div className="flex-1 h-px bg-blue-100" />
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {displaySchedules.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-3">
                <RefreshCw size={24} className="text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">
                {statusFilter === '익일' ? '익일 일정이 없습니다' : '오늘 일정이 없습니다'}
              </p>
              <p className="text-slate-400 text-sm mt-1">+ 버튼으로 일정을 추가하세요</p>
            </motion.div>
          ) : (
            displaySchedules.map((item, idx) => {
              // 전체 탭에서 오늘/익일 구분선
              const prevItem = displaySchedules[idx - 1]
              const showDivider = statusFilter === '전체' && item.date === nextWorkday && (!prevItem || prevItem.date === today)
              return (
                <div key={item.id}>
                  {showDivider && (
                    <div className="flex items-center gap-2 py-2">
                      <div className="flex-1 h-px bg-blue-100" />
                      <span className="text-xs text-blue-500 font-semibold shrink-0">
                        ↓ 익일 ({dayjs(nextWorkday).format('M/D dddd')})
                      </span>
                      <div className="flex-1 h-px bg-blue-100" />
                    </div>
                  )}
                  <ScheduleCard
                    item={item}
                    onTap={handleTapCard}
                    onComplete={handleComplete}
                    onPostpone={(item) => setPostponeItem(item)}
                    onIssue={handleIssue}
                  />
                </div>
              )
            })
          )}
        </AnimatePresence>
      </div>

      {/* ── 일정 추가/수정 시트 ── */}
      <BottomSheet
        open={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditItem(null) }}
        title={editItem ? '일정 수정' : '새 일정 추가'}
        fullHeight
      >
        <ScheduleForm
          item={editItem}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => { setIsFormOpen(false); setEditItem(null) }}
        />
      </BottomSheet>

      {/* ── 미루기 시트 ── */}
      <PostponeSheet
        open={!!postponeItem}
        onClose={() => setPostponeItem(null)}
        item={postponeItem}
        onConfirm={handlePostponeConfirm}
      />
    </div>
  )
}
