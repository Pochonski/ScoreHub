import { z } from 'zod'

export const TeamSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  badgeUrl: z.string().optional(),
  score: z.number().nullable().optional(),
})

export const GameStatusGroupSchema = z.number().min(1).max(4)

export const GameSchema = z.object({
  id: z.number().or(z.string().transform(Number)),
  homeTeam: TeamSchema,
  awayTeam: TeamSchema,
  statusGroup: GameStatusGroupSchema,
  startTime: z.string().optional(),
  minute: z.number().optional(),
  stage: z.string().optional(),
  statusText: z.string().optional(),
  groupName: z.string().optional(),
})

export const NewsSchema = z.object({
  id: z.number().or(z.string().transform(Number)).optional(),
  title: z.string(),
  url: z.string().url().optional(),
  image: z.string().optional(),
  publishDate: z.string().optional(),
  source: z.string().optional(),
})

export const GameArraySchema = z.array(GameSchema)
export const NewsArraySchema = z.array(NewsSchema)

export const AthleteSchema = z.object({
  id: z.number(),
  name: z.string(),
  shortName: z.string().optional(),
  age: z.number().optional(),
  position: z.object({ id: z.number(), name: z.string() }).optional(),
  formationPosition: z.object({ id: z.number(), name: z.string() }).optional(),
  nationalTeamId: z.number().optional(),
  clubId: z.number().optional(),
  nationalTeamStatsText: z.string().optional(),
  shortBio: z.string().optional(),
  photoUrl: z.string().optional(),
  thumbnailUrl: z.string().optional(),
})

export const StandingRowSchema = z.object({
  position: z.number(),
  team: z.object({
    id: z.number(),
    name: z.string(),
    badgeUrl: z.string().optional(),
  }),
  played: z.number(),
  won: z.number(),
  drawn: z.number(),
  lost: z.number(),
  goalsFor: z.number(),
  goalsAgainst: z.number(),
  goalDiff: z.number(),
  points: z.number(),
  recentForm: z.array(z.string()),
})

export const StandingGroupSchema = z.object({
  name: z.string(),
  rows: z.array(StandingRowSchema),
})

export const AthleteArraySchema = z.array(AthleteSchema)
export const StandingGroupArraySchema = z.array(StandingGroupSchema)
