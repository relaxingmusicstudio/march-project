import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const TermsOfService = () => {
  return (
    <>
      <Helmet>
        <title>Terms of Service | ApexLocal360</title>
        <meta name="description" content="Terms of Service for ApexLocal360 AI Voice Agent services." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl py-12">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          
          <h1 className="text-4xl font-bold text-foreground mb-8">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">Last updated: December 15, 2024</p>
          
          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">1. Agreement to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing or using ApexLocal360's AI voice agent services ("Services"), you agree to be bound by these Terms of Service. If you do not agree, please do not use our Services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">2. Description of Services</h2>
              <p className="text-muted-foreground leading-relaxed">
                ApexLocal360 provides AI-powered voice agents for HVAC businesses to handle incoming calls, book appointments, and manage customer inquiries 24/7. Services include but are not limited to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
                <li>24/7 AI voice receptionist</li>
                <li>Appointment scheduling and management</li>
                <li>Lead capture and qualification</li>
                <li>Call analytics and reporting</li>
                <li>CRM integrations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">3. Account Registration</h2>
              <p className="text-muted-foreground leading-relaxed">
                To use our Services, you must create an account and provide accurate, complete information. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">4. Subscription and Payment</h2>
              <div className="space-y-4 text-muted-foreground">
                <p className="leading-relaxed">
                  <strong className="text-foreground">Billing:</strong> Subscriptions are billed monthly. Payment is due at the beginning of each billing cycle.
                </p>
                <p className="leading-relaxed">
                  <strong className="text-foreground">No Long-Term Contracts:</strong> All plans are month-to-month with no long-term commitments required.
                </p>
                <p className="leading-relaxed">
                  <strong className="text-foreground">Refunds:</strong> We offer a 14-day money-back guarantee for new customers.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">5. Acceptable Use</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">You agree not to:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Use the Services for any illegal purpose</li>
                <li>Attempt to interfere with or disrupt the Services</li>
                <li>Reverse engineer or attempt to extract source code</li>
                <li>Use the Services to harass, abuse, or harm others</li>
                <li>Violate any applicable laws or regulations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">6. Intellectual Property</h2>
              <p className="text-muted-foreground leading-relaxed">
                All content, features, and functionality of the Services are owned by ApexLocal360 and protected by intellectual property laws. You may not copy, modify, or distribute our content without permission.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">7. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                To the maximum extent permitted by law, ApexLocal360 shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the Services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">8. Service Availability</h2>
              <p className="text-muted-foreground leading-relaxed">
                We strive for 99.9% uptime but do not guarantee uninterrupted access. We may temporarily suspend services for maintenance or updates.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">9. Termination</h2>
              <p className="text-muted-foreground leading-relaxed">
                Either party may terminate this agreement at any time. Upon termination, your right to use the Services will immediately cease. We may terminate accounts that violate these terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">10. Changes to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update these terms from time to time. Continued use of the Services after changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">11. Contact</h2>
              <p className="text-muted-foreground leading-relaxed">
                Questions about these Terms? Contact us at:<br />
                Email: legal@apexlocal360.com<br />
                Address: [Your Business Address]
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

export default TermsOfService;
