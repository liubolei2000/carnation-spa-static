// src/app/terms/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms & Conditions — Carnation Spa',
  description: 'Terms and Conditions for Carnation Spa. Please read before booking a service.',
}

const UPDATED = 'March 1, 2025'

export default function TermsPage() {
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
          Terms &amp; Conditions
        </h1>
        <p style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.78rem', color:'rgba(168,146,122,0.7)', letterSpacing:'0.08em' }}>
          Last updated: {UPDATED}
        </p>
      </section>

      {/* Content */}
      <main style={{ background:'#faf6f0', padding:'5rem 3rem', maxWidth:760, margin:'0 auto' }}>

        <Section title="1. Acceptance of Terms">
          <P>By accessing our website or booking an appointment with Carnation Spa LLC ("Carnation Spa," "we," "our," or "us"), you agree to be bound by these Terms and Conditions. If you do not agree, please do not use our services.</P>
          <P>We reserve the right to update these Terms at any time. Continued use of our services after changes are posted constitutes acceptance of the revised Terms.</P>
        </Section>

        <Section title="2. Services">
          <P>Carnation Spa provides massage therapy and wellness services at 120 Cambridge St, Suite 8, Burlington, MA 01803. Services, pricing, and availability are subject to change without notice.</P>
          <P>All services are performed by licensed massage therapists. Services are intended for relaxation and general wellness purposes and do not constitute medical treatment or advice.</P>
        </Section>

        <Section title="3. Appointments &amp; Booking">
          <P>Appointments may be made online through our booking system or by calling us directly. By completing a booking you confirm that:</P>
          <ul style={ulStyle}>
            <li style={liStyle}>The information you provide (name, phone number) is accurate and belongs to you.</li>
            <li style={liStyle}>You are at least 18 years of age, or booking on behalf of a minor with parental/guardian consent.</li>
            <li style={liStyle}>You consent to receive transactional SMS messages for booking confirmation and appointment reminders.</li>
          </ul>
          <P>We reserve the right to refuse or cancel any booking at our discretion.</P>
        </Section>

        <Section title="4. Cancellation &amp; No-Show Policy">
          <SubTitle>Cancellations</SubTitle>
          <P>We ask that you cancel at least <strong>24 hours</strong> before your scheduled appointment. You can cancel anytime via the secure link sent to your phone after booking, or by calling us at (978) 330-0895.</P>
          <SubTitle>Late Cancellations &amp; No-Shows</SubTitle>
          <P>Cancellations made less than 24 hours before the appointment, or failure to appear without notice, may result in a cancellation fee at our discretion. Repeated no-shows may result in restrictions on future bookings.</P>
          <SubTitle>Late Arrivals</SubTitle>
          <P>If you arrive late, your session may be shortened to avoid impacting subsequent appointments, and the full service fee may still apply.</P>
        </Section>

        <Section title="5. Payments">
          <P>Payment is collected in person at the time of service. We accept cash and major credit/debit cards. Prices listed on our website are in U.S. dollars and are subject to change.</P>
          <P>Online bookings do not require advance payment. No charges are made through our website.</P>
        </Section>

        <Section title="6. Health &amp; Safety">
          <P>Certain medical conditions may be contraindicated for massage therapy. You are responsible for informing your therapist of any health conditions, injuries, allergies, or medications before your session begins.</P>
          <P>Carnation Spa reserves the right to refuse or stop a service if we believe it is unsafe to continue due to a client's health condition. In such cases, no refund is owed for time already performed.</P>
          <P>Our services are strictly professional and therapeutic in nature. Any inappropriate behavior will result in immediate termination of the session, full charge for the service, and may be reported to the appropriate authorities.</P>
        </Section>

        <Section title="7. Limitation of Liability">
          <P>To the fullest extent permitted by applicable law, Carnation Spa shall not be liable for any indirect, incidental, special, or consequential damages arising out of your use of our services or website, including but not limited to personal injury, property damage, or loss of data.</P>
          <P>Our total liability for any claim related to our services shall not exceed the amount you paid for the specific service giving rise to the claim.</P>
        </Section>

        <Section title="8. Intellectual Property">
          <P>All content on our website — including text, images, logos, and design — is the property of Carnation Spa LLC and may not be reproduced, distributed, or used without our prior written consent.</P>
        </Section>

        <Section title="9. Third-Party Links">
          <P>Our website may contain links to third-party websites (e.g., Google Maps, Yelp, Instagram). We are not responsible for the content, privacy practices, or terms of those sites. Visiting them is at your own risk.</P>
        </Section>

        <Section title="10. Governing Law">
          <P>These Terms and Conditions are governed by the laws of the Commonwealth of Massachusetts, without regard to its conflict of law provisions. Any disputes arising from these Terms shall be resolved in the courts located in Middlesex County, Massachusetts.</P>
        </Section>

        <Section title="11. Contact Us" last>
          <P>If you have any questions about these Terms and Conditions, please contact us:</P>
          <div style={{ background:'#f4ede3', border:'1px solid #e8ddd0', borderRadius:2, padding:'1.5rem 1.8rem', marginTop:'1rem', fontFamily:"'DM Mono',monospace", fontSize:'0.82rem', lineHeight:2, color:'#6b4f35' }}>
            <strong style={{ display:'block', marginBottom:'0.25rem', fontFamily:"'Jost',sans-serif", fontSize:'1rem' }}>Carnation Spa LLC</strong>
            120 Cambridge St, Suite 8<br />
            Burlington, MA 01803<br />
            (978) 330-0895
          </div>
          <P>Related: <Link href="/privacy" style={{ color:'#c9a96e', textDecoration:'none', borderBottom:'1px solid rgba(201,169,110,0.4)' }}>Privacy Policy</Link></P>
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
