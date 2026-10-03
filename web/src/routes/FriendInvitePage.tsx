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
import type { PublicUser } from '../lib/types'

type Preview = {
  valid: boolean
  inviter: PublicUser
  expires_at: string
}

export function FriendInvitePage() {
  const { token = '' } = useParams()
  const { user } = useAuth()
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
      <PageHeader title="Friend invite" back="/" />
      <div className="mx-auto grid max-w-md gap-4 p-5">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner className="text-ink-2" />
          </div>
        ) : error || !inviter ? (
          <div className="grid gap-3 text-center">
            <p className="text-ink-2">This invite link is invalid or has expired.</p>
            <Button type="button" onClick={() => navigate('/', { replace: true })}>Go to map</Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-3 text-center">
              <Avatar size={72} user={inviter} />
              <p className="display text-2xl font-bold">{playerDisplayLabel(inviter, viewerIsAdmin)}</p>
              <p className="text-ink-2">wants to be friends on Find the Game.</p>
            </div>

            {user?.id === inviter.id ? (
              <p className="text-center text-sm text-ink-2">This is your own invite link — share it with someone else.</p>
            ) : user && !user.onboarded ? (
              <div className="grid gap-2">
                <p className="text-center text-sm text-ink-2">Finish setting up your profile, then accept the invite from here or your profile.</p>
                <Button type="button" onClick={() => navigate('/', { replace: true })}>Continue setup</Button>
              </div>
            ) : canAccept ? (
              <div className="grid gap-2">
                <Button type="button" loading={accepting} onClick={() => void accept()}>
                  Accept friend request
                </Button>
                <ErrorText>{acceptError}</ErrorText>
              </div>
            ) : !user ? (
              <div className="grid gap-3">
                <SocialSignInButtons showTerms onSignedIn={() => void afterAuth()} navigateAfterSignIn={null} />
                <OrDivider className="text-ink-2" />
                <Button type="button" onClick={() => navigate('/register', { replace: true })}>
                  Create account
                </Button>
                <p className="text-center text-sm text-ink-2">
                  Already playing?{' '}
                  <Link to="/?login=1" className="font-semibold text-brand">
                    Log in
                  </Link>
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
