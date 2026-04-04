import { useEffect, useState } from 'react'
import './App.css'
import ChatPage from './ChatPage'
import LandingPage from './LandingPage'
import type { StoredProfile } from './types'

const profileStorageKey = 'chat-writing-coach.profile'

function getStoredProfile(): StoredProfile {
  const rawValue = localStorage.getItem(profileStorageKey)
  if (!rawValue) return { name: '', apiKey: '' }
  try {
    return JSON.parse(rawValue) as StoredProfile
  } catch {
    return { name: '', apiKey: '' }
  }
}

function persistProfile(profile: StoredProfile) {
  localStorage.setItem(profileStorageKey, JSON.stringify(profile))
}

function getRoomIdFromPath(pathname: string) {
  const match = pathname.match(/^\/r\/([A-Za-z0-9_-]+)$/)
  return match?.[1] ?? null
}

function App() {
  const [profile, setProfile] = useState<StoredProfile>(() => getStoredProfile())
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => { persistProfile(profile) }, [profile])

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  function navigate(path: string) {
    window.history.pushState({}, '', path)
    setPathname(path)
  }

  const roomId = getRoomIdFromPath(pathname)

  if (!roomId) {
    return (
      <LandingPage
        profile={profile}
        onProfileChange={setProfile}
        onNavigateToRoom={(nextRoomId) => navigate(`/r/${nextRoomId}`)}
      />
    )
  }

  return (
    <ChatPage
      profile={profile}
      onProfileChange={setProfile}
      roomId={roomId}
      onGoToLanding={() => navigate('/')}
    />
  )
}

export default App
