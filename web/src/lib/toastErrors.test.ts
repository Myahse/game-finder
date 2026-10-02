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
