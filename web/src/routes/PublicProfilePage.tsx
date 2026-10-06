import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { playerUsernameLabel } from '../lib/format'
import { useProfileByUsername } from '../lib/queries'
import { PlayerProfileView } from './ProfilePage'
import { Button } from '../components/ui'
import { Loading } from './CourtPage'
import { useLocale } from '../i18n/LocaleProvider'

export function PublicProfilePage() {
  const { username = '' } = useParams()
  const { user } = useAuth()
  const { t } = useLocale()
  const pp = t.account.publicProfile
  const viewerIsAdmin = user?.role === 'admin'
  const { data: profile, isLoading, isError, isSelf } = useProfileByUsername(username)

  if (isLoading) return <Loading />

  const handle = username.trim().replace(/^@/, '')
  const title = profile ? playerUsernameLabel(profile) : handle ? `@${handle}` : t.common.player

  if (!profile && isError && !isSelf) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="display text-2xl font-bold">{pp.notFound}</h1>
        <p className="mt-2 text-ink-2">
          {handle ? (
            <>
              {pp.noAccountBefore}<span className="font-semibold text-ink">@{handle}</span>{pp.noAccountAfter}
            </>
          ) : (
            pp.invalidLink
          )}
        </p>
        {!user ? (
          <div className="mt-6 grid gap-2">
            <Button type="button" onClick={() => (window.location.href = '/register')}>{t.welcome.createAccount}</Button>
            <Link to="/?login=1" className="text-sm font-semibold text-brand">{t.welcome.logIn}</Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-2">
            {user?.username && user.username.toLowerCase() !== handle.toLowerCase() ? (
              <Link
                to={`/u/${encodeURIComponent(user.username)}`}
                className="text-sm font-semibold text-brand"
              >
                {pp.viewYourProfile.replace('{user}', user.username)}
              </Link>
            ) : null}
            <Link to="/" className="text-sm font-semibold text-ink-2">{pp.backToMap}</Link>
          </div>
        )}
      </div>
    )
  }

  return (
    <PlayerProfileView
      profile={profile}
      title={title}
      back="/"
      viewerIsAdmin={viewerIsAdmin}
    />
  )
}
