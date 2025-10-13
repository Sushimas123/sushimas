import { supabase } from '@/src/lib/supabaseClient'

export const lockRequest = async (requestId: number, userId: number, userName: string): Promise<{ success: boolean, message: string }> => {
  try {
    // Check if already locked
    const { data: request } = await supabase
      .from('petty_cash_requests')
      .select('is_locked, locked_by, locked_by_name')
      .eq('id', requestId)
      .single()

    if (request?.is_locked && request.locked_by !== userId) {
      return { success: false, message: `Request sedang diproses oleh ${request.locked_by_name}` }
    }

    // Lock the request
    const { error } = await supabase
      .from('petty_cash_requests')
      .update({
        is_locked: true,
        locked_by: userId,
        locked_by_name: userName,
        locked_at: new Date().toISOString()
      })
      .eq('id', requestId)

    if (error) throw error

    return { success: true, message: 'Request berhasil di-lock' }
  } catch (error) {
    console.error('Error locking request:', error)
    return { success: false, message: 'Gagal lock request' }
  }
}

export const unlockRequest = async (requestId: number): Promise<void> => {
  await supabase
    .from('petty_cash_requests')
    .update({
      is_locked: false,
      locked_by: null,
      locked_by_name: null,
      locked_at: null
    })
    .eq('id', requestId)
}

export const checkRequestLock = async (requestId: number): Promise<{ isLocked: boolean, lockedBy?: string }> => {
  const { data } = await supabase
    .from('petty_cash_requests')
    .select('is_locked, locked_by_name, locked_at')
    .eq('id', requestId)
    .single()

  // Auto-unlock if locked for more than 30 minutes
  if (data?.is_locked && data.locked_at) {
    const lockedTime = new Date(data.locked_at).getTime()
    const now = new Date().getTime()
    const diffMinutes = (now - lockedTime) / (1000 * 60)
    
    if (diffMinutes > 30) {
      await unlockRequest(requestId)
      return { isLocked: false }
    }
  }

  return {
    isLocked: data?.is_locked || false,
    lockedBy: data?.locked_by_name
  }
}

export const forceUnlockRequest = async (requestId: number): Promise<{ success: boolean, message: string }> => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const userRole = user.role
    
    // Only admin/super admin can force unlock
    if (userRole !== 'admin' && userRole !== 'super admin') {
      return { success: false, message: 'Hanya admin yang bisa force unlock' }
    }
    
    await unlockRequest(requestId)
    return { success: true, message: 'Request berhasil di-unlock' }
  } catch (error) {
    return { success: false, message: 'Gagal unlock request' }
  }
}