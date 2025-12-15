import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const CookiePolicy = () => {
  return (
    <>
      <Helmet>
        <title>Cookie Policy | ApexLocal360</title>
        <meta name="description" content="Cookie Policy for ApexLocal360 AI Voice Agent services." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl py-12">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          
          <h1 className="text-4xl font-bold text-foreground mb-8">Cookie Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: December 15, 2024</p>
          
          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">What Are Cookies</h2>
              <p className="text-muted-foreground leading-relaxed">
                Cookies are small text files stored on your device when you visit our website. They help us provide you with a better experience by remembering your preferences and understanding how you use our site.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Types of Cookies We Use</h2>
              
              <div className="space-y-6">
                <div className="p-4 bg-card rounded-lg border border-border">
                  <h3 className="text-lg font-medium text-foreground mb-2">Essential Cookies</h3>
                  <p className="text-muted-foreground text-sm mb-2">Required for the website to function properly. Cannot be disabled.</p>
                  <ul className="list-disc list-inside text-muted-foreground text-sm space-y-1">
                    <li>Authentication and session management</li>
                    <li>Security features</li>
                    <li>Load balancing</li>
                  </ul>
                </div>

                <div className="p-4 bg-card rounded-lg border border-border">
                  <h3 className="text-lg font-medium text-foreground mb-2">Analytics Cookies</h3>
                  <p className="text-muted-foreground text-sm mb-2">Help us understand how visitors use our website.</p>
                  <ul className="list-disc list-inside text-muted-foreground text-sm space-y-1">
                    <li>Page views and navigation patterns</li>
                    <li>Time spent on pages</li>
                    <li>Traffic sources</li>
                  </ul>
                </div>

                <div className="p-4 bg-card rounded-lg border border-border">
                  <h3 className="text-lg font-medium text-foreground mb-2">Functional Cookies</h3>
                  <p className="text-muted-foreground text-sm mb-2">Remember your preferences and settings.</p>
                  <ul className="list-disc list-inside text-muted-foreground text-sm space-y-1">
                    <li>Language preferences</li>
                    <li>Theme settings (dark/light mode)</li>
                    <li>Form data for convenience</li>
                  </ul>
                </div>

                <div className="p-4 bg-card rounded-lg border border-border">
                  <h3 className="text-lg font-medium text-foreground mb-2">Marketing Cookies</h3>
                  <p className="text-muted-foreground text-sm mb-2">Used to deliver relevant advertisements.</p>
                  <ul className="list-disc list-inside text-muted-foreground text-sm space-y-1">
                    <li>Ad targeting and retargeting</li>
                    <li>Campaign effectiveness measurement</li>
                    <li>Social media integration</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Managing Cookies</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You can manage your cookie preferences at any time:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Use our cookie consent banner to update preferences</li>
                <li>Adjust your browser settings to block cookies</li>
                <li>Delete existing cookies from your browser</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Note: Blocking certain cookies may impact your experience on our website.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Third-Party Cookies</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may use third-party services that set their own cookies, including:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
                <li>Google Analytics for website analytics</li>
                <li>Stripe for payment processing</li>
                <li>Intercom for customer support</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Updates to This Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Cookie Policy from time to time. Any changes will be posted on this page with an updated revision date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                Questions about our use of cookies? Contact us at:<br />
                Email: privacy@apexlocal360.com
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

export default CookiePolicy;
