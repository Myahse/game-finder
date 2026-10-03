import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { usePublicProfileByUsername } from '../lib/queries'
import { PlayerProfileView } from './ProfilePage'
import { Loading } from './CourtPage'

export function PublicProfilePage() {
  const { username = '' } = useParams()
  const { user } = useAuth()
  const viewerIsAdmin = user?.role === 'admin'
  const { data: profile, isLoading, isError } = usePublicProfileByUsername(username)

  if (isLoading) return <Loading />
  const resolved = isError ? undefined : profile

  if (user?.onboarded && resolved) {
    return <Navigate to={`/users/${resolved.id}`} replace />
  }

  return (
    <PlayerProfileView
      profile={resolved}
      title={resolved ? `@${resolved.username}` : 'Player'}
      back="/"
      viewerIsAdmin={viewerIsAdmin}
    />
  )
}
