import Link from "next/link";

export const metadata = { title: "Privacy Policy — Tarana.ai" };

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-gray-900">{heading}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-gray-600">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="h-1 w-8 rounded-full bg-blue-600" />
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-gray-900">
          Privacy Policy <span className="text-blue-600">— Tarana.ai</span>
        </h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: September 2026</p>

        <p className="mt-6 text-sm leading-6 text-gray-600">
          Tarana.ai is an AI-powered Baguio travel companion that plans itineraries, meals, and
          routes. This policy explains what data we collect, how we use it, and the choices you
          have. By using Tarana.ai, you agree to this policy.
        </p>

        <Section heading="Data we collect">
          <p>We collect only what we need to run the service:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-gray-900">Account data:</strong> your name, email address,
              and password (hashed) when you register with email credentials, or your name, email,
              and profile details shared by Google when you sign in with Google OAuth via NextAuth.
            </li>
            <li>
              <strong className="text-gray-900">Preferences you provide:</strong> travel dates,
              group size, budget, interests, dietary needs, and other itinerary inputs you enter to
              generate a trip.
            </li>
            <li>
              <strong className="text-gray-900">Your content:</strong> saved itineraries, saved
              meals, referral codes you create or redeem, and credit balances tied to your account,
              stored in our database (Supabase).
            </li>
            <li>
              <strong className="text-gray-900">Device data:</strong> your remembered email
              preference stored in your browser&apos;s localStorage when you tick
              &ldquo;Remember me&rdquo; on sign-in.
            </li>
          </ul>
        </Section>

        <Section heading="How we use it">
          <ul className="list-disc space-y-1 pl-5">
            <li>Create and secure your account, and sign you in.</li>
            <li>
              Generate your itineraries: your trip preferences are sent to Google Gemini to produce
              plans, suggestions, and meal ideas.
            </li>
            <li>
              Enrich your trips: coordinates are sent to TomTom for traffic and routing and to
              OpenWeather for weather forecasts; places and photos are loaded from Google Places,
              Wikimedia, Unsplash, and TomTom.
            </li>
            <li>Track credit balances, daily credits, referrals, and saved trips and meals.</li>
            <li>Operate, debug, prevent abuse, and improve the service.</li>
          </ul>
        </Section>

        <Section heading="Cookies and local storage">
          <p>
            We use essential cookies for authentication sessions (via NextAuth) and browser
            localStorage for the &ldquo;Remember me&rdquo; feature: when enabled, your email
            address and preference are stored on your own device so the sign-in form can pre-fill
            it next time. Clearing your browser storage removes them. We do not use advertising
            cookies.
          </p>
        </Section>

        <Section heading="Third-party services">
          <p>
            To provide the service, limited data is shared with the following providers, each
            governed by its own privacy policy:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-gray-900">Google Gemini</strong> — itinerary and content
              generation from the preferences you submit.
            </li>
            <li>
              <strong className="text-gray-900">TomTom</strong> — routing, traffic, and map data
              from the coordinates in your trip.
            </li>
            <li>
              <strong className="text-gray-900">OpenWeather</strong> — weather forecasts for your
              destinations.
            </li>
            <li>
              <strong className="text-gray-900">Google Places &amp; Google OAuth</strong> — place
              details and Google sign-in.
            </li>
            <li>
              <strong className="text-gray-900">Wikimedia &amp; Unsplash</strong> — place photos and
              imagery.
            </li>
            <li>
              <strong className="text-gray-900">Supabase</strong> — database and hosting for
              accounts, credits, referrals, and saved content.
            </li>
          </ul>
        </Section>

        <Section heading="Data retention">
          <p>
            We keep your account data, saved itineraries and meals, referral records, and credit
            balances for as long as your account is active so your trips persist between visits. If
            you delete your account, we delete or anonymize your personal data within a reasonable
            period, except where we must retain limited records for security, fraud prevention, or
            legal compliance.
          </p>
        </Section>

        <Section heading="Your rights">
          <p>
            You may request access, correction, export, or deletion of your personal data at any
            time by contacting us (see below). You can also update your name and password in your
            account, turn off &ldquo;Remember me&rdquo; to remove the locally stored email, and
            delete saved itineraries or meals.
          </p>
        </Section>

        <Section heading="Security">
          <p>
            Passwords are hashed, sessions are managed via NextAuth, and database access is scoped
            per user. No method of transmission or storage is completely secure, so we cannot
            guarantee absolute security, but we apply reasonable safeguards to protect your data.
          </p>
        </Section>

        <Section heading="Children">
          <p>
            Tarana.ai is not directed at children under 13, and we do not knowingly collect their
            personal data. If you believe a child has provided us data, contact us and we will
            delete it.
          </p>
        </Section>

        <Section heading="Changes">
          <p>
            We may update this policy as the service evolves. Material changes will be reflected by
            updating the &ldquo;Last updated&rdquo; date above, and continued use of Tarana.ai after
            changes means you accept the revised policy.
          </p>
        </Section>

        <Section heading="Contact">
          <p>
            Questions about this policy or your data? Contact us through the app or via the support
            channels listed on our home page. See also our{" "}
            <Link href="/terms" className="font-medium text-blue-600 hover:underline">
              Terms of Service
            </Link>
            .
          </p>
        </Section>

        <div className="mt-12 border-t border-gray-200 pt-6">
          <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
