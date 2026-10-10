import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { playerDisplayLabel } from '../lib/format'
import {
  acceptPendingFriendInvite,
  friendInviteTokenForAuth,
  stashFriendInviteToken,
} from '../lib/friendInvite'
import { OrDivider } from '../components/GoogleSignInButton'
import { SocialSignInButtons } from '../components/SocialSignInButtons'
import { Avatar, Button, ErrorText, PageHeader, Spinner } from '../components/ui'
import { InviteTicket } from '../components/InviteTicket'
import type { PublicUser } from '../lib/types'
import { useLocale } from '../i18n/LocaleProvider'

type Preview = {
  valid: boolean
  inviter: PublicUser
  expires_at: string
}

export function FriendInvitePage() {
  const { token = '' } = useParams()
  const { user } = useAuth()
  const { t } = useLocale()
  const fi = t.account.friendInvite
  const viewerIsAdmin = user?.role === 'admin'
  const navigate = useNavigate()
  const [acceptError, setAcceptError] = useState('')
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    if (token) stashFriendInviteToken(token)
  }, [token])

  const { data: preview, isLoading, error } = useQuery({
    queryKey: ['friend-invite-preview', token],
    enabled: token.length > 0,
    queryFn: () => api<Preview>(`/api/friend-invites/${encodeURIComponent(token)}`),
    retry: false,
  })

  const inviter = preview?.inviter
  const canAccept = !!user && user.onboarded && inviter && user.id !== inviter.id

  const accept = async () => {
    setAccepting(true)
    setAcceptError('')
    try {
      await api(`/api/friend-invites/${encodeURIComponent(token)}/accept`, { method: 'POST' })
      navigate('/profile', { replace: true })
    } catch (e) {
      setAcceptError(errorMessage(e))
    } finally {
      setAccepting(false)
    }
  }

  const afterAuth = async () => {
    if (friendInviteTokenForAuth()) {
      await acceptPendingFriendInvite()
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-full">
      <PageHeader title={fi.title} back="/" />
      <div className="mx-auto grid max-w-md gap-4 p-5">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner className="text-ink-2" />
          </div>
        ) : error || !inviter ? (
          <div className="grid gap-3 text-center">
            <p className="text-ink-2">{fi.invalid}</p>
            <Button type="button" onClick={() => navigate('/', { replace: true })}>{fi.goToMap}</Button>
          </div>
        ) : (
          <InviteTicket
            stub={t.games.link.stub}
            pull={t.games.link.stubPull}
            actions={
              <>

            {user?.id === inviter.id ? (
              <p className="text-center text-sm text-ink-2">{fi.ownLink}</p>
            ) : user && !user.onboarded ? (
              <div className="grid gap-2">
                <p className="text-center text-sm text-ink-2">{fi.finishSetup}</p>
                <Button type="button" onClick={() => navigate('/', { replace: true })}>{fi.continueSetup}</Button>
              </div>
            ) : canAccept ? (
              <div className="grid gap-2">
                <Button type="button" loading={accepting} onClick={() => void accept()}>
                  {fi.accept}
                </Button>
                <ErrorText>{acceptError}</ErrorText>
              </div>
            ) : !user ? (
              <div className="grid gap-3">
                <SocialSignInButtons showTerms onSignedIn={() => void afterAuth()} navigateAfterSignIn={null} />
                <OrDivider className="text-ink-2" />
                <Button type="button" onClick={() => navigate('/register', { replace: true })}>
                  {t.welcome.createAccount}
                </Button>
                <p className="text-center text-sm text-ink-2">
                  {t.account.register.alreadyPlaying}{' '}
                  <Link to="/?login=1" className="font-semibold text-brand">
                    {t.welcome.logIn}
                  </Link>
                </p>
              </div>
            ) : null}
              </>
            }
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <Avatar size={72} user={inviter} />
              <p className="display text-2xl font-bold">{playerDisplayLabel(inviter, viewerIsAdmin)}</p>
              <p className="text-ink-2">{fi.wantsToBeFriends}</p>
            </div>
          </InviteTicket>
        )}
      </div>
    </div>
  )
}
