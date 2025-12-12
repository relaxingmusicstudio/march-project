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
      "An AI voice agent for plumbers is an automated phone answering system powered by artificial intelligence that handles incoming calls 24/7. It can answer customer inquiries, book appointments, provide quotes, upsell services, and qualify leads—all without human intervention. ApexLocal360's AI agents are specifically trained for plumbing businesses and sound natural in conversations.",
  },
  {
    question: "How much does a missed call cost a plumbing business?",
    answer:
      "The average missed plumbing call represents $1,200+ in lost revenue. Emergency plumbing jobs can be worth $500-$3,000, and customers who can't reach you will call a competitor. Studies show 85% of callers who can't reach a business won't call back. ApexLocal360's AI ensures you never miss another valuable call.",
  },
  {
    question: "How quickly can I get an AI voice agent set up?",
    answer:
      "ApexLocal360 offers done-for-you setup in just 48 hours. Our team handles everything: customizing the AI to your business, integrating with your existing systems, training the AI on your services and pricing, and testing to ensure perfect performance. You can start capturing more leads within 2 days.",
  },
  {
    question: "Does the AI voice agent sound robotic?",
    answer:
      "No, ApexLocal360's AI voice agents use advanced natural language processing and voice synthesis to sound remarkably human. Callers often can't tell they're speaking with an AI. The agents understand context, handle interruptions, and respond naturally to questions—just like a trained human receptionist.",
  },
  {
    question: "Can the AI handle emergency plumbing calls?",
    answer:
      "Absolutely. ApexLocal360's AI is trained to identify emergency situations like burst pipes, flooding, and gas leaks. It prioritizes these calls, gathers critical information, and can immediately escalate to your on-call technician while keeping the customer informed and reassured.",
  },
  {
    question: "What happens if the AI can't answer a question?",
    answer:
      "If the AI encounters a question it can't confidently answer, it gracefully handles the situation by offering to take a message, schedule a callback with your team, or transfer the call to a human if one is available. The AI never makes up information—it acknowledges its limitations professionally.",
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
