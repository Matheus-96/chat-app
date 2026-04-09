import { Route, Routes } from 'react-router-dom'
import { LandingPage } from '../features/landing/LandingPage'
import { RoomPage } from '../features/chat/RoomPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/room/:roomCode" element={<RoomPage />} />
    </Routes>
  )
}