import { MetadataRoute } from 'next'

export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://anwesha.iitp.ac.in'
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/profile',
          '/user/',
          '/verify-email/',
          '/reset-password/',
          '/submit-id',
          '/test-payment',
          '/payment-status',
          '/change-password',
          '/password-reset',
          '/forgot-password',
          '/ca-login',
          '/ca-register',
          '/userLogin',
          '/userRegister',
          '/send-verification',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/api/',
          '/profile',
          '/user/',
          '/verify-email/',
          '/reset-password/',
          '/submit-id',
          '/test-payment',
          '/payment-status',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
