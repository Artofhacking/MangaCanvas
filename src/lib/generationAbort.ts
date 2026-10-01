/** Abort reason for the cancel button. Anything else must not cancel a submitted video job. */
export const USER_CANCEL_ABORT_REASON = 'user'

/** Abort reason when the page or workflow goes away. Stops the local poller only. */
export const DETACH_ABORT_REASON = 'detach'

export function isUserCancelAbort(signal?: AbortSignal | null): boolean {
  return Boolean(signal?.aborted && signal.reason === USER_CANCEL_ABORT_REASON)
}
