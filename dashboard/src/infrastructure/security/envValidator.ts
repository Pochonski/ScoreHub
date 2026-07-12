import { z } from 'zod'
import { logger } from '@/infrastructure/logging/Logger'

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().min(1).default('/api/football'),
})

let validated = false

export function validateEnv(): void {
  if (validated) return
  validated = true

  const result = envSchema.safeParse(import.meta.env)
  if (!result.success) {
    logger.warn('[EnvValidator] Invalid or missing environment variables', {
      issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    })
  }
}

export function getEnvVar<K extends keyof z.infer<typeof envSchema>>(key: K): z.infer<typeof envSchema>[K] {
  const result = envSchema.safeParse(import.meta.env)
  if (!result.success) {
    throw new Error(`[EnvValidator] Missing required env var: ${key}`)
  }
  return result.data[key]
}
