import { describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { toastFromApiError } from './toastErrors'
import { ApiError } from './api'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

describe('toastFromApiError', () => {
  it('uses friendly copy for browse_location_mismatch', () => {
    toastFromApiError(new ApiError(422, 'browse_location_mismatch', 'Map center is too far'))
    expect(toast.error).toHaveBeenCalledWith(
      'Map area unavailable',
      expect.objectContaining({ description: expect.stringContaining('alert zone') }),
    )
  })
})

describe('toastFromApiError fallbacks', () => {
  it('uses the translated code copy, then the server message', () => {
    toastFromApiError(new ApiError(409, 'game_full', 'whatever'))
    expect(toast.error).toHaveBeenLastCalledWith('This game is full.')
    toastFromApiError(new ApiError(400, 'some_new_code', 'Server says no.'))
    expect(toast.error).toHaveBeenLastCalledWith('Server says no.')
  })
})
