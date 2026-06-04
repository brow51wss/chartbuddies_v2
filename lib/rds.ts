/**
 * RDS connection layer for PHI tables.
 *
 * All PHI tables (patients, mar_forms, mar_medications, mar_administrations,
 * mar_prn_records, mar_prn_medications, mar_vital_signs, progress_note_entries)
 * are stored in AWS RDS PostgreSQL. Non-PHI tables remain in Supabase.
 *
 * Access control: every public-facing helper verifies the caller's Supabase
 * JWT and resolves their role + hospital_id before executing a query, so RLS
 * is enforced at the application layer instead of the database layer.
 */

import { Pool, PoolClient, QueryResult } from 'pg'
import { createClient } from '@supabase/supabase-js'
import getConfig from 'next/config'

// Allow self-signed / AWS-managed TLS certs in Lambda environments
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

// ---------------------------------------------------------------------------
// Connection pool (singleton, reused across Lambda warm invocations)
// ---------------------------------------------------------------------------

let pool: Pool | null = null

function getRdsConnectionString(): string {
  const { serverRuntimeConfig } = getConfig() || {}
  return serverRuntimeConfig?.RDS_CONNECTION_STRING || process.env.RDS_CONNECTION_STRING || ''
}

function getServiceRoleKey(): string {
  const { serverRuntimeConfig } = getConfig() || {}
  return serverRuntimeConfig?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

function getPool(): Pool {
  if (!pool) {
    const connectionString = getRdsConnectionString()
    if (!connectionString) {
      throw new Error('RDS_CONNECTION_STRING environment variable is not set')
    }
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }, // RDS uses self-signed cert in some configs
      max: 5,          // keep small for serverless Lambda concurrency
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    })
    pool.on('error', (err) => {
      console.error('[RDS] Unexpected pool error', err)
      pool = null // force reconnect on next call
    })
  }
  return pool
}

// ---------------------------------------------------------------------------
// Raw query helpers
// ---------------------------------------------------------------------------

export async function rdsQuery(
  sql: string,
  params?: any[],
): Promise<QueryResult<any>> {
  const client = await getPool().connect()
  try {
    return await client.query(sql, params)
  } finally {
    client.release()
  }
}

export async function rdsTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ---------------------------------------------------------------------------
// Caller identity resolution
// ---------------------------------------------------------------------------

export interface CallerIdentity {
  userId: string
  role: 'superadmin' | 'head_nurse' | 'nurse'
  hospitalId: string | null
}

/**
 * Resolve who is making an API call from their Supabase JWT.
 * Reads user_profiles from Supabase (non-PHI) to get role + hospital_id.
 */
export async function resolveCallerFromToken(
  authHeader: string | undefined,
): Promise<CallerIdentity> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header')
  }
  const token = authHeader.slice(7)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = getServiceRoleKey()

  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL env var is not set')
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY env var is not set')

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) throw new Error('Invalid or expired token')

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .select('id, role, hospital_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) throw new Error('User profile not found')

  return {
    userId: profile.id,
    role: profile.role,
    hospitalId: profile.hospital_id ?? null,
  }
}

// ---------------------------------------------------------------------------
// Access-control helpers (mirrors the old Supabase RLS policies)
// ---------------------------------------------------------------------------

/**
 * Check if the caller can read/write a patient row.
 * - superadmin with no hospital_id: global access
 * - superadmin / head_nurse / nurse with hospital_id: facility scope
 */
export function callerCanAccessHospital(
  caller: CallerIdentity,
  hospitalId: string,
): boolean {
  if (caller.role === 'superadmin' && caller.hospitalId === null) return true
  return caller.hospitalId === hospitalId
}

/**
 * Build a WHERE clause fragment that restricts PHI rows to the caller's
 * facility. Pass the alias for the column that holds hospital_id.
 *
 * Returns { clause, params, offset } where offset is the next $N index.
 */
export function facilityWhereClause(
  caller: CallerIdentity,
  hospitalIdColumn: string,
  startIndex = 1,
): { clause: string; params: any[]; nextIndex: number } {
  if (caller.role === 'superadmin' && caller.hospitalId === null) {
    // Global superadmin — no restriction
    return { clause: '', params: [], nextIndex: startIndex }
  }
  return {
    clause: `AND ${hospitalIdColumn} = $${startIndex}`,
    params: [caller.hospitalId],
    nextIndex: startIndex + 1,
  }
}
