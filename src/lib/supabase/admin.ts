import { createClient } from '@supabase/supabase-js'

function createBaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// For public schema tables (e.g. transactions)
export function createPublicAdminClient() {
  return createBaseAdminClient()
}

// For finances schema tables (e.g. billing_cycles, goals)
export function createFinancesAdminClient() {
  return createBaseAdminClient().schema('finances')
}

// For purchases schema tables (e.g. products, receipt_items)
export function createPurchasesAdminClient() {
  return createBaseAdminClient().schema('purchases')
}

// The single owner's user_id for the current single-user phase.
// Swap this for session.user.id when moving to multi-user.
export function ownerUserId(): string {
  const uid = process.env.OWNER_USER_ID
  if (!uid) throw new Error('OWNER_USER_ID env var is not set')
  return uid
}
