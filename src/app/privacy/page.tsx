// src/app/privacy/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — Carnation Spa',
  description: 'Privacy Policy for Carnation Spa. Learn how we collect, use, and protect your personal information.',
}

const UPDATED = 'March 1, 2025'

export default function PrivacyPage() {
  return (
    <>
      {/* Nav bar */}
      <header style={{ background:'#1c1712', padding:'1.2rem 3rem', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <Link href="/" style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.5rem', fontWeight:300, color:'#faf6f0', letterSpacing:'0.2em', textDecoration:'none' }}>
          Carnation
        </Link>
        <Link href="/" style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.72rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'#a8927a', textDecoration:'none', borderBottom:'1px solid rgba(168,146,122,0.3)', paddingBottom:2 }}>
          ← Back to Home
        </Link>
      </header>

      {/* Hero */}
      <section style={{ background:'#f4ede3', padding:'5rem 3rem 4rem', textAlign:'center' }}>
        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.72rem', letterSpacing:'0.2em', textTransform:'uppercase', color:'#a8927a', marginBottom:'1rem' }}>
          Legal
        </div>
        <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(2.2rem,4vw,3.5rem)', fontWeight:300, color:'#2d2318', margin:'0 0 1rem' }}>
          Privacy Policy
        </h1>
        <p style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.78rem', color:'rgba(168,146,122,0.7)', letterSpacing:'0.08em' }}>
          Last updated: {UPDATED}
        </p>
      </section>

      {/* Content */}
      <main style={{ background:'#faf6f0', padding:'5rem 3rem', maxWidth:760, margin:'0 auto' }}>

        <Section title="1. Introduction">
          <P>Carnation Spa LLC ("Carnation Spa," "we," "our," or "us") operates the website at carnationspa.com and the online booking system associated with it. This Privacy Policy explains what personal information we collect, how we use it, and the choices you have regarding your information.</P>
          <P>By using our website or booking a service, you agree to the practices described in this policy. If you do not agree, please do not use our services.</P>
        </Section>

        <Section title="2. Information We Collect">
          <SubTitle>Information you provide directly</SubTitle>
          <ul style={ulStyle}>
            <li style={liStyle}><strong>Name</strong> — used to identify your appointment.</li>
            <li style={liStyle}><strong>Phone number</strong> — used to send booking confirmations and appointment reminders via SMS, and to verify your identity during booking.</li>
            <li style={liStyle}><strong>Appointment notes</strong> — optional details you share (e.g., areas to focus on, allergies). Stored only to help us provide you a better service.</li>
          </ul>
          <SubTitle>Information collected automatically</SubTitle>
          <ul style={ulStyle}>
            <li style={liStyle}><strong>Usage data</strong> — standard web server logs including IP address, browser type, and pages visited, retained for up to 30 days for security purposes.</li>
            <li style={liStyle}><strong>Cloudflare Turnstile</strong> — we use Cloudflare's CAPTCHA-alternative service to prevent automated abuse. Cloudflare may collect technical signals from your browser. See <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer" style={linkStyle}>Cloudflare's Privacy Policy</a> for details.</li>
          </ul>
        </Section>

        <Section title="3. How We Use Your Information">
          <ul style={ulStyle}>
            <li style={liStyle}>To create and manage your appointment bookings.</li>
            <li style={liStyle}>To send you an SMS confirmation immediately after booking.</li>
            <li style={liStyle}>To send appointment reminders via SMS (typically 24 hours before your appointment).</li>
            <li style={liStyle}>To allow you to view or cancel your appointment via a secure link sent by SMS.</li>
            <li style={liStyle}>To prevent fraud and abuse of our booking system.</li>
          </ul>
          <P>We do <strong>not</strong> use your information for marketing, advertising, or any purpose beyond what is listed above.</P>
        </Section>

        <Section title="4. SMS / Text Messages">
          <P>By providing your phone number during booking, you consent to receive transactional SMS messages from Carnation Spa, including:</P>
          <ul style={ulStyle}>
            <li style={liStyle}>Booking confirmation (sent once at time of booking).</li>
            <li style={liStyle}>Appointment reminder (sent approximately 24 hours before your appointment).</li>
            <li style={liStyle}>A secure management link to view or cancel your appointment.</li>
          </ul>
          <P>Message and data rates may apply depending on your carrier. These are transactional messages — we do not send promotional or marketing texts. To opt out of reminders, reply <strong>STOP</strong> to any message or contact us directly.</P>
        </Section>

        <Section title="5. Data Retention">
          <P>Appointment records (including your name, phone number, and service details) are retained for up to <strong>2 years</strong> to support business records and compliance. You may request deletion of your data at any time by contacting us (see Section 8).</P>
          <P>Server access logs are retained for up to 30 days. Verification codes expire within 10 minutes of issuance.</P>
        </Section>

        <Section title="6. Data Sharing">
          <P>We do <strong>not</strong> sell, rent, or share your personal information with third parties for their own marketing purposes. We may share data only in the following limited circumstances:</P>
          <ul style={ulStyle}>
            <li style={liStyle}><strong>SMS delivery provider</strong> — your phone number is shared with our SMS gateway to deliver booking confirmations and reminders.</li>
            <li style={liStyle}><strong>Legal requirements</strong> — if required by applicable law, court order, or governmental authority.</li>
            <li style={liStyle}><strong>Business transfers</strong> — in connection with a merger, acquisition, or sale of assets, with notice provided to you.</li>
          </ul>
        </Section>

        <Section title="7. Cookies &amp; Tracking">
          <P>Our website uses a session cookie solely to keep you logged in if you access the staff management area. We do not use advertising cookies, tracking pixels, or analytics cookies. Third-party services (Cloudflare, Google Maps embed) may set their own cookies subject to their own policies.</P>
        </Section>

        <Section title="8. Your Rights">
          <P>Depending on where you are located, you may have the right to:</P>
          <ul style={ulStyle}>
            <li style={liStyle}>Access the personal information we hold about you.</li>
            <li style={liStyle}>Request correction of inaccurate information.</li>
            <li style={liStyle}>Request deletion of your personal information.</li>
            <li style={liStyle}>Opt out of SMS communications by replying <strong>STOP</strong>.</li>
          </ul>
          <P>To exercise any of these rights, contact us at the information below. We will respond within 30 days.</P>
        </Section>

        <Section title="9. Data Security">
          <P>We implement reasonable technical and organizational measures to protect your personal information, including encrypted connections (HTTPS), hashed passwords, and access controls limiting who can view booking data. No method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.</P>
        </Section>

        <Section title="10. Children's Privacy">
          <P>Our services are not directed to individuals under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such information, please contact us and we will delete it promptly.</P>
        </Section>

        <Section title="11. Changes to This Policy">
          <P>We may update this Privacy Policy from time to time. When we do, we will revise the "Last updated" date at the top of this page. Continued use of our services after any changes constitutes acceptance of the updated policy.</P>
        </Section>

        <Section title="12. Contact Us" last>
          <P>If you have questions or requests regarding this Privacy Policy, please contact us:</P>
          <div style={{ background:'#f4ede3', border:'1px solid #e8ddd0', borderRadius:2, padding:'1.5rem 1.8rem', marginTop:'1rem', fontFamily:"'DM Mono',monospace", fontSize:'0.82rem', lineHeight:2, color:'#6b4f35' }}>
            <strong style={{ display:'block', marginBottom:'0.25rem', fontFamily:"'Jost',sans-serif", fontSize:'1rem' }}>Carnation Spa LLC</strong>
            120 Cambridge St, Suite 8<br />
            Burlington, MA 01803<br />
            (978) 330-0895
          </div>
        </Section>
      </main>

      {/* Footer */}
      <footer style={{ background:'#1c1712', padding:'2.5rem 3rem', textAlign:'center' }}>
        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.72rem', letterSpacing:'0.1em', color:'rgba(168,146,122,0.4)' }}>
          © 2025 Carnation Spa LLC. &nbsp;·&nbsp;{' '}
          <Link href="/privacy" style={{ color:'rgba(168,146,122,0.5)', textDecoration:'none', borderBottom:'1px solid rgba(168,146,122,0.2)', paddingBottom:1 }}>Privacy Policy</Link>
          &nbsp;·&nbsp;{' '}
          <Link href="/terms" style={{ color:'rgba(168,146,122,0.5)', textDecoration:'none', borderBottom:'1px solid rgba(168,146,122,0.2)', paddingBottom:1 }}>Terms &amp; Conditions</Link>
        </div>
      </footer>
    </>
  )
}

// ── Small layout helpers ────────────────────────────────

const ulStyle: React.CSSProperties = {
  paddingLeft:'1.4rem',
  margin:'0.75rem 0',
  lineHeight:1.9,
}
const liStyle: React.CSSProperties = {
  fontSize:'0.97rem',
  color:'#5a4030',
  marginBottom:'0.4rem',
  fontFamily:"'Jost',sans-serif",
}
const linkStyle: React.CSSProperties = {
  color:'#c9a96e',
  textDecoration:'none',
  borderBottom:'1px solid rgba(201,169,110,0.4)',
}

function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <section style={{ marginBottom: last ? 0 : '3.5rem' }}>
      <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.55rem', fontWeight:400, color:'#2d2318', marginBottom:'1.2rem', paddingBottom:'0.6rem', borderBottom:'1px solid #e8ddd0' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.72rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'#a8927a', margin:'1.2rem 0 0.5rem' }}>
      {children}
    </div>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize:'0.97rem', color:'#5a4030', lineHeight:1.9, margin:'0.6rem 0', fontFamily:"'Jost',sans-serif" }}>
      {children}
    </p>
  )
}
