import { createClient } from './server'

export async function financesDb() {
  const supabase = await createClient()
  return supabase.schema('finances')
}
