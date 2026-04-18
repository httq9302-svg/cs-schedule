import { useState } from 'react'
import dayjs from 'dayjs'
import BottomSheet from './BottomSheet'

const QUICK_OPTIONS = [
  { label: '내일', days: 1 },
  { label: '모레', days: 2 },
  { label: '1주일 후', days: 7 },
  { label: '2주일 후', days: 14 },
  { label: '1개월 후', days: 30 },
  { label: '3개월 후', days: 90 },
]

export default function PostponeSheet({ open, onClose, item, onConfirm }) {
  const [selectedDate, setSelectedDate] = useState('')
  const [activeQuick, setActiveQuick] = useState(null)

  const handleQuick = (days, label) => {
    const date = dayjs().add(days, 'day').format('YYYY-MM-DD')
    setSelectedDate(date)
    setActiveQuick(label)
  }

  const handleConfirm = () => {
    if (!selectedDate) return
    onConfirm(item.id, selectedDate)
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="일정 미루기">
      <div className="px-5 py-4 space-y-5 pb-8">
        {item && (
          <div className="bg-slate-50 rounded-xl px-4 py-3">
            <p className="text-xs text-slate-400 mb-0.5">미룰 일정</p>
            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">현재 날짜: {item.date}</p>
          </div>
        )}

        {/* 빠른 선택 */}
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2">빠른 선택</p>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_OPTIONS.map(({ label, days }) => (
              <button
                key={label}
                onClick={() => handleQuick(days, label)}
                className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  activeQuick === label
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 active:bg-slate-50'
                }`}
              >
                {label}
                <span className="block text-[10px] font-normal mt-0.5 opacity-60">
                  {dayjs().add(days, 'day').format('M/D')}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 직접 날짜 선택 */}
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2">직접 날짜 선택</p>
          <input
            type="date"
            value={selectedDate}
            min={dayjs().add(1, 'day').format('YYYY-MM-DD')}
            onChange={(e) => { setSelectedDate(e.target.value); setActiveQuick(null) }}
            className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          />
        </div>

        {selectedDate && (
          <div className="bg-violet-50 rounded-xl px-4 py-3 text-sm text-violet-700">
            <span className="font-semibold">{dayjs(selectedDate).format('YYYY년 M월 D일 (ddd)')}</span>으로 미룹니다
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={!selectedDate}
          className={`w-full h-12 rounded-xl font-semibold text-sm transition-all ${
            selectedDate ? 'bg-slate-900 text-white active:bg-slate-800' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          미루기 확정
        </button>
      </div>
    </BottomSheet>
  )
}
