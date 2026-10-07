import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { Spinner } from './components/ui'
import { AppShell } from './components/AppShell'
import { WelcomePage } from './routes/WelcomePage'
import { PrivacyPage, TermsPage } from './routes/LegalPage'
import { LoginPage, RegisterPage } from './routes/AuthPages'
import { OnboardingPage } from './routes/OnboardingPage'
import { MapPage } from './routes/MapPage'
import { CourtPage } from './routes/CourtPage'
import { GamePage } from './routes/GamePage'
import { CreateGamePage } from './routes/CreateGamePage'
import { PlayPage } from './routes/PlayPage'
import { MyGamesPage } from './routes/MyGamesPage'
import { ProfilePage, UserPage } from './routes/ProfilePage'
import { ChallengeDetailPage, ChallengesPage } from './routes/ChallengesPage'
import { NotFoundPage, RouteErrorPage } from './routes/NotFoundPage'
import { AvatarStudioPage } from './routes/AvatarStudioPage'
import { NotificationsPage } from './routes/NotificationsPage'
import { AddCourtPage } from './routes/AddCourtPage'
import { ReportCourtPage } from './routes/ReportCourtPage'
import { AdminLayout } from './routes/admin/AdminLayout'
import { AdminDashboard } from './routes/admin/AdminDashboard'
import { AdminUsage } from './routes/admin/AdminUsage'
import { AdminCourts } from './routes/admin/AdminCourts'
import { AdminCourtReview } from './routes/admin/AdminCourtReview'
import { AdminGames } from './routes/admin/AdminGames'
import { AdminUsers } from './routes/admin/AdminUsers'
import { AdminReports } from './routes/admin/AdminReports'
import { AdminSettings } from './routes/admin/AdminSettings'
import { FriendInvitePage } from './routes/FriendInvitePage'
import { PublicProfilePage } from './routes/PublicProfilePage'
import { VerifyEmailPage } from './routes/VerifyEmailPage'
import { GameLinkPage } from './routes/GameLinkPage'
import { GameJoinLanding } from './routes/GameJoinLanding'
import { pathMatchesPendingGame, pendingGamePathAfterAuth } from './lib/gameInvite'

const GUEST_PATHS = new Set(['/register', '/terms', '/privacy', '/login'])

function isFriendInvitePath(path: string) {
  return path.startsWith('/friend/')
}

function isPublicProfilePath(path: string) {
  return path.startsWith('/u/')
}

function isGameSharePath(path: string) {
  return path.startsWith('/g/')
}

function legacyGamePath(path: string): string | null {
  const m = path.match(/^\/games\/([^/]+)$/)
  if (!m || m[1] === 'new') return null
  return m[1]
}

/** Logged-out: welcome at `/` (and `/welcome`). Logged-in: app shell or onboarding. */
/** Shown while the cookie session is restored on a deep link, so a reload doesn't bounce to `/`. */
function SessionSplash() {
  return (
    <div className="flex min-h-full items-center justify-center bg-bg">
      <Spinner className="text-brand" />
    </div>
  )
}

function RootAuthLayout() {
  const { user, sessionReady } = useAuth()
  const loc = useLocation()
  const path = loc.pathname

  if (isFriendInvitePath(path) || isPublicProfilePath(path) || isGameSharePath(path) || path === '/verify-email') {
    return <Outlet />
  }

  if (!user) {
    const legacyGameId = legacyGamePath(path)
    if (legacyGameId) return <GameJoinLanding gameId={legacyGameId} />
    if (path === '/' || path === '/welcome') return <WelcomePage />
    if (GUEST_PATHS.has(path)) return <Outlet />
    if (!sessionReady) return <SessionSplash />
    return <Navigate to="/" replace state={{ from: path }} />
  }

  if (['/register', '/login', '/welcome'].includes(path)) return <Navigate to="/" replace />

  // Finish sport + level on `/` (not a separate /onboarding URL).
  if (path === '/onboarding') return <Navigate to="/" replace />
  if (!user.onboarded) {
    if (path === '/') return <OnboardingPage />
    return <Navigate to="/" replace />
  }

  const pendingGame = pendingGamePathAfterAuth()
  if (
    pendingGame &&
    user.onboarded &&
    !isGameSharePath(path) &&
    !pathMatchesPendingGame(path, pendingGame)
  ) {
    return <Navigate to={pendingGame} replace />
  }

  return <Outlet />
}

function RequireAdmin() {
  const { user } = useAuth()
  return user?.role === 'admin' ? <Outlet /> : <Navigate to="/" replace />
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootAuthLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: 'welcome', element: <Navigate to="/" replace /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'verify-email', element: <VerifyEmailPage /> },
      { path: 'friend/:token', element: <FriendInvitePage /> },
      { path: 'g/:token', element: <GameLinkPage /> },
      { path: 'u/:username', element: <PublicProfilePage /> },
      {
        element: <AppShell />,
        children: [
          { index: true, element: <MapPage /> },
          { path: 'play', element: <PlayPage /> },
          { path: 'my-games', element: <MyGamesPage /> },
          { path: 'notifications', element: <NotificationsPage /> },
          { path: 'challenges', element: <ChallengesPage /> },
          { path: 'challenges/:id', element: <ChallengeDetailPage /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'profile/avatar', element: <AvatarStudioPage /> },
          { path: 'users/:id', element: <UserPage /> },
          { path: 'courts/new', element: <AddCourtPage /> },
          { path: 'courts/:id', element: <CourtPage /> },
          { path: 'courts/:id/report', element: <ReportCourtPage /> },
          { path: 'games/new', element: <CreateGamePage /> },
          { path: 'games/:id', element: <GamePage /> },
          {
            element: <RequireAdmin />,
            children: [
              {
                path: 'admin',
                element: <AdminLayout />,
                children: [
                  { index: true, element: <AdminDashboard /> },
                  { path: 'usage', element: <AdminUsage /> },
                  { path: 'courts', element: <AdminCourts /> },
                  { path: 'courts/:courtId', element: <AdminCourtReview /> },
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
  { path: '*', element: <NotFoundPage /> },
])
