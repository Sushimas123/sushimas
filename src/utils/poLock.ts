import { supabase } from '@/src/lib/supabaseClient'

export const lockPO = async (poId: number, userId: number, userName: string): Promise<{ success: boolean, message: string }> => {
  try {
    // Check if already locked
    const { data: po } = await supabase
      .from('purchase_orders')
      .select('is_locked, locked_by, locked_by_name')
      .eq('id', poId)
      .single()

    if (po?.is_locked && po.locked_by !== userId) {
      return { success: false, message: `PO sedang diproses oleh ${po.locked_by_name}` }
    }

    // Lock the PO
    const { error } = await supabase
      .from('purchase_orders')
      .update({
        is_locked: true,
        locked_by: userId,
        locked_by_name: userName,
        locked_at: new Date().toISOString()
      })
      .eq('id', poId)

    if (error) throw error

    return { success: true, message: 'PO berhasil di-lock' }
  } catch (error) {
    console.error('Error locking PO:', error)
    return { success: false, message: 'Gagal lock PO' }
  }
}

export const unlockPO = async (poId: number): Promise<void> => {
  await supabase
    .from('purchase_orders')
    .update({
      is_locked: false,
      locked_by: null,
      locked_by_name: null,
      locked_at: null
    })
    .eq('id', poId)
}

export const checkPOLock = async (poId: number): Promise<{ isLocked: boolean, lockedBy?: string }> => {
  const { data } = await supabase
    .from('purchase_orders')
    .select('is_locked, locked_by_name, locked_at')
    .eq('id', poId)
    .single()

  // Auto-unlock if locked for more than 30 minutes
  if (data?.is_locked && data.locked_at) {
    const lockedTime = new Date(data.locked_at).getTime()
    const now = new Date().getTime()
    const diffMinutes = (now - lockedTime) / (1000 * 60)
    
    if (diffMinutes > 30) {
      await unlockPO(poId)
      return { isLocked: false }
    }
  }

  return {
    isLocked: data?.is_locked || false,
    lockedBy: data?.locked_by_name
  }
}

export const forceUnlockPO = async (poId: number, userId: number): Promise<{ success: boolean, message: string }> => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const userRole = user.role
    
    // Only admin/super admin can force unlock
    if (userRole !== 'admin' && userRole !== 'super admin') {
      return { success: false, message: 'Hanya admin yang bisa force unlock' }
    }
    
    await unlockPO(poId)
    return { success: true, message: 'PO berhasil di-unlock' }
  } catch (error) {
    return { success: false, message: 'Gagal unlock PO' }
  }
}
