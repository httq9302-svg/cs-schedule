import { motion, AnimatePresence } from 'framer-motion'
import { X, Navigation } from 'lucide-react'

const NAV_APPS = [
  {
    id: 'kakao',
    name: '카카오맵',
    color: 'bg-yellow-400',
    textColor: 'text-yellow-900',
    icon: '🗺',
    getUrl: (addr) => `https://map.kakao.com/link/search/${encodeURIComponent(addr)}`,
  },
  {
    id: 'naver',
    name: '네이버 지도',
    color: 'bg-emerald-500',
    textColor: 'text-white',
    icon: '🧭',
    getUrl: (addr) => `https://map.naver.com/v5/search/${encodeURIComponent(addr)}`,
  },
  {
    id: 'google',
    name: '구글 지도',
    color: 'bg-blue-500',
    textColor: 'text-white',
    icon: '📍',
    getUrl: (addr) => `https://www.google.com/maps/search/${encodeURIComponent(addr)}`,
  },
]

export default function NaviSheet({ open, onClose, location }) {
  const handleSelect = (app) => {
    if (!location) return
    window.open(app.getUrl(location), '_blank')
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 오버레이 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40"
          />

          {/* 시트 */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white rounded-t-3xl z-50 pb-safe"
          >
            {/* 핸들 */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>

            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <div>
                <p className="text-sm font-bold text-slate-900">지도 앱 선택</p>
                {location && (
                  <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[260px]">{location}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 active:bg-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            {/* 앱 목록 */}
            <div className="px-4 py-4 space-y-2.5 pb-8">
              {NAV_APPS.map((app) => (
                <button
                  key={app.id}
                  onClick={() => handleSelect(app)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-slate-50 active:bg-slate-100 transition-colors text-left"
                >
                  <div className={`w-12 h-12 ${app.color} rounded-2xl flex items-center justify-center text-2xl shrink-0`}>
                    {app.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900">{app.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">탭하여 길 찾기</p>
                  </div>
                  <Navigation size={16} className="text-slate-300 shrink-0" />
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
