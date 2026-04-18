import { useState } from 'react'
import { StoreProvider } from '@/store/useStore.jsx'
import NavBar from '@/components/NavBar'
import TodayPage from '@/pages/TodayPage'
import CalendarPage from '@/pages/CalendarPage'
import SettingsPage from '@/pages/SettingsPage'
import SyncPage from '@/pages/SyncPage'

function AppInner() {
  const [tab, setTab] = useState('today')

  const pages = {
    today: <TodayPage />,
    calendar: <CalendarPage />,
    settings: <SettingsPage />,
    sync: <SyncPage />,
  }

  return (
    <div
      className="relative flex flex-col bg-slate-100 overflow-hidden"
      style={{
        width: '100%',
        maxWidth: 480,
        height: '100dvh',
        margin: '0 auto',
      }}
    >
      {/* 페이지 영역 */}
      <div className="flex-1 overflow-hidden relative">
        {pages[tab]}
      </div>

      {/* 하단 네비게이션 */}
      <NavBar active={tab} onChange={setTab} />
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <AppInner />
    </StoreProvider>
  )
}
