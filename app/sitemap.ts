import { MetadataRoute } from 'next'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://anwesha.iitp.ac.in'
  const currentDate = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/events`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/pronite`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/anweshapass`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/accommodation`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/campusambassador`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/merchandise`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/merch`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/gallery`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/ourteam`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/oursponsors`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/aboutus`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/leaderboard`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: currentDate,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: currentDate,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
  ]

  const eventRoutes: MetadataRoute.Sitemap = []
  try {
    const eventsFilePath = path.join(process.cwd(), 'public', 'events', 'events_data.json')
    if (fs.existsSync(eventsFilePath)) {
      const raw = fs.readFileSync(eventsFilePath, 'utf8')
      const events = JSON.parse(raw)
      if (Array.isArray(events)) {
        const seen = new Set<string>()
        for (const item of events) {
          const rawName = item['Event Name'] || item['Event'] || item['name']
          if (rawName && typeof rawName === 'string') {
            const cleanSlug = rawName.trim().replace(/\s+/g, '-').toLowerCase()
            if (!seen.has(cleanSlug)) {
              seen.add(cleanSlug)
              eventRoutes.push({
                url: `${baseUrl}/events/${encodeURIComponent(cleanSlug)}`,
                lastModified: currentDate,
                changeFrequency: 'weekly',
                priority: 0.8,
              })
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Failed to parse events_data.json for sitemap', err)
  }

  return [...staticRoutes, ...eventRoutes]
}
