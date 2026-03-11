// src/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Carnation Spa — Massage Therapy & Wellness · Burlington, MA',
  description: 'Carnation Spa in Burlington, MA offers Swedish massage, deep tissue, foot massage, hot stone & more. Licensed therapists, easy online booking. Call (978) 330-0895.',
  keywords: 'massage Burlington MA, spa Burlington MA, deep tissue massage Burlington, Swedish massage Burlington, foot massage Burlington, best massage Burlington, massage therapy Burlington Massachusetts',
  openGraph: {
    title: 'Carnation Spa — Best Massage in Burlington, MA',
    description: 'Licensed massage therapists in Burlington, MA. Swedish, deep tissue, hot stone & more. Book online in minutes.',
    type: 'website',
    url: 'https://carnationspaburlington.com',
    siteName: 'Carnation Spa',
  },
  alternates: {
    canonical: 'https://carnationspaburlington.com',
  },
  robots: {
    index: true,
    follow: true,
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'MassageTherapist',
  name: 'Carnation Spa',
  url: 'https://carnationspaburlington.com',
  telephone: '+19783300895',
  priceRange: '$$',
  image: 'https://carnationspaburlington.com/og-image.jpg',
  description: 'Professional massage therapy spa in Burlington, MA offering Swedish, deep tissue, hot stone, foot massage, and more.',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '120 Cambridge St, Suite 8',
    addressLocality: 'Burlington',
    addressRegion: 'MA',
    postalCode: '01803',
    addressCountry: 'US',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 42.5048,
    longitude: -71.1956,
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday'],
      opens: '09:00',
      closes: '21:00',
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Saturday','Sunday'],
      opens: '09:00',
      closes: '20:00',
    },
  ],
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.9',
    reviewCount: '127',
  },
  sameAs: [
    'https://www.yelp.com/biz/carnation-spa-burlington',
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500&family=DM+Mono:wght@300;400&family=Sora:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
