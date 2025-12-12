import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";

const faqs = [
  {
    question: "What is an AI voice agent for plumbers?",
    answer:
      "Think of it as your best receptionist who never sleeps, never calls in sick, and never has a bad day. An AI voice agent answers your phone 24/7, talks to customers naturally, books jobs on your calendar, and even upsells services like water heater flushes or drain maintenance. The difference? It costs a fraction of a full-time employee and works every single night, weekend, and holiday.",
  },
  {
    question: "How much does a missed call cost a plumbing business?",
    answer:
      "Here's the math that keeps plumbers up at night: the average service call is worth $350-$500, but emergency jobs? Those run $800-$3,000. Miss just one emergency call a week, and you're leaving $50,000+ on the table every year. The real kicker? 85% of people who can't reach you won't bother leaving a voicemail—they'll just call the next plumber on Google.",
  },
  {
    question: "How quickly can I get an AI voice agent set up?",
    answer:
      "We handle everything in 48 hours, start to finish. No tech headaches on your end. We'll hop on a quick call to learn your business, then our team builds and trains your custom AI agent with your pricing, service area, and booking preferences. By day three, you're capturing calls you used to miss.",
  },
  {
    question: "Does the AI voice agent sound robotic?",
    answer:
      "This isn't your grandma's automated phone tree. Our AI uses the same technology behind ChatGPT but optimized for natural phone conversations. Customers genuinely can't tell the difference—we've had business owners call to test it and get fooled by their own AI. It handles interruptions, asks follow-up questions, and even laughs at jokes.",
  },
  {
    question: "Can the AI handle emergency plumbing calls?",
    answer:
      "Absolutely—this is where it really shines. The AI is trained to recognize urgency words like 'flooding,' 'burst pipe,' or 'no hot water with a newborn.' It immediately prioritizes these calls, gathers the critical info (address, access instructions, what's happening), and can text or call your on-call tech within seconds. No more middle-of-the-night calls waking up your whole house.",
  },
  {
    question: "What happens if the AI can't answer a question?",
    answer:
      "The AI knows what it knows—and more importantly, knows what it doesn't. If a customer asks something outside its training (like a super technical question about your sump pump brand compatibility), it'll professionally say 'Let me have our team get back to you on that' and schedule a callback. It never makes stuff up or gives wrong information that could burn you.",
  },
  {
    question: "Will the AI work with my existing scheduling software?",
    answer:
      "We integrate with pretty much everything plumbers actually use—ServiceTitan, Housecall Pro, Jobber, Google Calendar, you name it. During setup, we connect directly to your system so when the AI books a job, it shows up on your calendar instantly. No double-booking, no manual entry, no 'oops, I forgot to add that appointment.'",
  },
  {
    question: "How does the AI know my pricing and services?",
    answer:
      "During onboarding, we do a deep dive into your business. You tell us your service area, pricing tiers, what services you offer (and which ones you want to push), your availability, and any special instructions. We then train your AI specifically on YOUR business—it's not a generic bot, it's YOUR virtual dispatcher who knows that you charge $99 for drain cleaning and don't service anything north of Highway 50.",
  },
  {
    question: "What if I want to change something after setup?",
    answer:
      "Business changes, we get it. New pricing for the busy season? Hired another tech and expanded your service area? Just shoot us a message and we'll update your AI within 24 hours. Most changes are included in your plan—we're not going to nickel-and-dime you every time you want to tweak something.",
  },
  {
    question: "Is there a long-term contract or commitment?",
    answer:
      "Nope, and that's intentional. We're confident enough in what we deliver that we don't need to lock you in. It's month-to-month, cancel anytime. That said, once you see your after-hours calls turning into booked jobs, you're not going to want to go back to voicemail purgatory.",
  },
  {
    question: "How do I know the AI is actually working?",
    answer:
      "You get a dashboard that shows everything: how many calls came in, how many got booked, what times people are calling, even recordings of the conversations (with customer consent, of course). Most owners tell us they're shocked at how many calls they were missing at 6 AM or 9 PM. The data doesn't lie—you'll see exactly what the AI is doing for you.",
  },
];

const FAQSection = () => {
  return (
    <section className="py-20 bg-secondary/30" aria-labelledby="faq-heading">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Section Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium mb-4">
            <HelpCircle className="w-4 h-4" />
            Frequently Asked Questions
          </div>
          <h2
            id="faq-heading"
            className="text-3xl md:text-4xl font-bold text-foreground mb-4"
          >
            Everything You Need to Know
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Get answers to the most common questions about our AI voice agents
            for plumbing businesses.
          </p>
        </div>

        {/* FAQ Accordion */}
        <Accordion
          type="single"
          collapsible
          className="w-full space-y-4"
          itemScope
          itemType="https://schema.org/FAQPage"
        >
          {faqs.map((faq, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="bg-card border border-border rounded-lg px-6 shadow-sm data-[state=open]:shadow-md transition-shadow"
              itemScope
              itemProp="mainEntity"
              itemType="https://schema.org/Question"
            >
              <AccordionTrigger className="text-left text-foreground font-semibold hover:text-accent hover:no-underline py-5 text-base md:text-lg">
                <span itemProp="name">{faq.question}</span>
              </AccordionTrigger>
              <AccordionContent
                className="text-muted-foreground pb-5 text-base leading-relaxed"
                itemScope
                itemProp="acceptedAnswer"
                itemType="https://schema.org/Answer"
              >
                <span itemProp="text">{faq.answer}</span>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">
            Still have questions? We're here to help.
          </p>
          <a
            href="#contact"
            className="inline-flex items-center gap-2 text-accent font-semibold hover:underline"
          >
            Contact our team
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
