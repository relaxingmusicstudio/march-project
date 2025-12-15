// Plain-language terminology glossary
// Maps technical terms to simple, understandable language

export const terminology = {
  // Revenue & Money
  MRR: {
    simple: "Monthly Income",
    tooltip: "Money you make each month from customers",
    action: "View revenue breakdown",
  },
  ARR: {
    simple: "Yearly Income",
    tooltip: "Total money you make in a year from customers",
    action: "View yearly trends",
  },
  LTV: {
    simple: "Customer Value",
    tooltip: "Total money a customer pays over their whole relationship with you",
    action: "See top customers",
  },
  CAC: {
    simple: "Cost to Get Customer",
    tooltip: "How much you spend to get one new customer",
    action: "View acquisition costs",
  },
  "Weighted Value": {
    simple: "Likely Revenue",
    tooltip: "Total value multiplied by the chance of closing the deal",
    action: "View deal probabilities",
  },
  "Avg Deal Size": {
    simple: "Average Job Value",
    tooltip: "The typical amount you earn per job or deal",
    action: "View deal sizes",
  },

  // Leads & Conversions
  "Lead Score": {
    simple: "Interest Level",
    tooltip: "How interested this lead is in buying (0-100)",
    action: "See scoring breakdown",
  },
  "Hot Leads": {
    simple: "Ready to Buy",
    tooltip: "Leads that are very interested and ready to make a decision",
    action: "View hot leads",
  },
  "Warm Leads": {
    simple: "Interested",
    tooltip: "Leads showing interest but not ready to buy yet",
    action: "View warm leads",
  },
  "Cold Leads": {
    simple: "New Contacts",
    tooltip: "New leads that haven't shown much interest yet",
    action: "View cold leads",
  },
  "Conversion Rate": {
    simple: "Success Rate",
    tooltip: "Percentage of visitors or leads who become customers",
    action: "View conversion funnel",
  },

  // Clients & Health
  "Health Score": {
    simple: "Client Happiness",
    tooltip: "How well this client is doing - based on usage, support tickets, and engagement",
    action: "See health factors",
  },
  "At Risk": {
    simple: "Needs Attention",
    tooltip: "Clients who might leave if we don't help them soon",
    action: "View at-risk clients",
  },
  "Active Clients": {
    simple: "Paying Customers",
    tooltip: "Customers who are currently paying for your service",
    action: "View all clients",
  },
  Churned: {
    simple: "Cancelled",
    tooltip: "Customers who stopped using your service",
    action: "View cancelled clients",
  },

  // Pipeline & Deals
  Pipeline: {
    simple: "Potential Deals",
    tooltip: "All the deals you're currently working on",
    action: "View all deals",
  },
  "Close Rate": {
    simple: "Win Rate",
    tooltip: "Percentage of deals you successfully close",
    action: "View win/loss stats",
  },
  "Active Deals": {
    simple: "Deals in Progress",
    tooltip: "Deals you're currently working on",
    action: "View active deals",
  },

  // Campaigns & Messages
  "Delivery Rate": {
    simple: "Messages Delivered",
    tooltip: "Percentage of messages that reached the recipient",
    action: "View delivery stats",
  },
  "Open Rate": {
    simple: "Messages Opened",
    tooltip: "Percentage of people who opened your message",
    action: "View open stats",
  },
  "Click Rate": {
    simple: "Links Clicked",
    tooltip: "Percentage of people who clicked a link in your message",
    action: "View click stats",
  },
  "Opt-Outs": {
    simple: "Unsubscribed",
    tooltip: "People who asked to stop receiving messages",
    action: "View unsubscribes",
  },

  // Support
  "Open Tickets": {
    simple: "Needs Help",
    tooltip: "Support requests that haven't been resolved yet",
    action: "View open tickets",
  },
  "Response Time": {
    simple: "How Fast You Reply",
    tooltip: "Average time it takes to respond to a support request",
    action: "View response stats",
  },

  // General Stats
  "Total Leads": {
    simple: "All Leads",
    tooltip: "Everyone who has shown interest in your business",
    action: "View all leads",
  },
  "Total Campaigns": {
    simple: "Message Campaigns",
    tooltip: "Number of marketing campaigns you've created",
    action: "View all campaigns",
  },
  "SMS Sent": {
    simple: "Texts Sent",
    tooltip: "Total number of text messages you've sent",
    action: "View message history",
  },
} as const;

export type TerminologyKey = keyof typeof terminology;

export function getSimpleTerm(technicalTerm: string): string {
  const entry = terminology[technicalTerm as TerminologyKey];
  return entry?.simple || technicalTerm;
}

export function getTooltip(technicalTerm: string): string {
  const entry = terminology[technicalTerm as TerminologyKey];
  return entry?.tooltip || "";
}

export function getAction(technicalTerm: string): string {
  const entry = terminology[technicalTerm as TerminologyKey];
  return entry?.action || "";
}
