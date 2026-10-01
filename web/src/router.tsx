import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { AppShell } from './components/AppShell'
import { WelcomePage } from './routes/WelcomePage'
import { LoginPage, RegisterPage } from './routes/AuthPages'
import { OnboardingPage } from './routes/OnboardingPage'
import { MapPage } from './routes/MapPage'
import { CourtPage } from './routes/CourtPage'
import { GamePage } from './routes/GamePage'
import { CreateGamePage } from './routes/CreateGamePage'
import { PlayPage } from './routes/PlayPage'
import { MyGamesPage } from './routes/MyGamesPage'
import { ProfilePage, UserPage } from './routes/ProfilePage'
import { NotificationsPage } from './routes/NotificationsPage'
import { AddCourtPage } from './routes/AddCourtPage'
import { ReportCourtPage } from './routes/ReportCourtPage'
import { AdminLayout } from './routes/admin/AdminLayout'
import { AdminDashboard } from './routes/admin/AdminDashboard'
import { AdminCourts } from './routes/admin/AdminCourts'
import { AdminGames } from './routes/admin/AdminGames'
import { AdminUsers } from './routes/admin/AdminUsers'
import { AdminReports } from './routes/admin/AdminReports'
import { AdminSettings } from './routes/admin/AdminSettings'

function RequireAuth() {
  const { user } = useAuth()
  const loc = useLocation()
  if (!user) return <Navigate to="/welcome" replace state={{ from: loc.pathname }} />
  if (!user.onboarded && loc.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />
  return <Outlet />
}

function GuestOnly() {
  const { user } = useAuth()
  return user ? <Navigate to="/" replace /> : <Outlet />
}

function RequireAdmin() {
  const { user } = useAuth()
  return user?.role === 'admin' ? <Outlet /> : <Navigate to="/" replace />
}

export const router = createBrowserRouter([
  {
    element: <GuestOnly />,
    children: [
      { path: '/welcome', element: <WelcomePage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      { path: '/onboarding', element: <OnboardingPage /> },
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <MapPage /> },
          { path: '/play', element: <PlayPage /> },
          { path: '/my-games', element: <MyGamesPage /> },
          { path: '/notifications', element: <NotificationsPage /> },
          { path: '/profile', element: <ProfilePage /> },
          { path: '/users/:id', element: <UserPage /> },
          { path: '/courts/new', element: <AddCourtPage /> },
          { path: '/courts/:id', element: <CourtPage /> },
          { path: '/courts/:id/report', element: <ReportCourtPage /> },
          { path: '/games/new', element: <CreateGamePage /> },
          { path: '/games/:id', element: <GamePage /> },
          {
            element: <RequireAdmin />,
            children: [
              {
                path: '/admin',
                element: <AdminLayout />,
                children: [
                  { index: true, element: <AdminDashboard /> },
                  { path: 'courts', element: <AdminCourts /> },
                  { path: 'games', element: <AdminGames /> },
                  { path: 'users', element: <AdminUsers /> },
                  { path: 'reports', element: <AdminReports /> },
                  { path: 'settings', element: <AdminSettings /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
