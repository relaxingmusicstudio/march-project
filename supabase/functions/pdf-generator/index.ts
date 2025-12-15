import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProposalData {
  clientName: string;
  businessName: string;
  dealValue: number;
  services: string[];
  validUntil: string;
  preparedBy?: string;
}

interface ContractData {
  clientName: string;
  businessName: string;
  planName: string;
  monthlyRate: number;
  startDate: string;
  termMonths: number;
}

interface ReportData {
  clientName: string;
  periodStart: string;
  periodEnd: string;
  metrics: {
    callsHandled: number;
    leadsGenerated: number;
    appointmentsBooked: number;
    revenueGenerated: number;
  };
}

function generateProposalHTML(data: ProposalData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 40px; color: #1a1a1a; }
    .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #3b82f6; padding-bottom: 20px; }
    .logo { font-size: 28px; font-weight: bold; color: #3b82f6; }
    .title { font-size: 24px; margin: 20px 0; }
    .section { margin: 30px 0; }
    .section-title { font-size: 18px; font-weight: bold; color: #3b82f6; margin-bottom: 15px; }
    .client-info { background: #f8fafc; padding: 20px; border-radius: 8px; }
    .services-list { list-style: none; padding: 0; }
    .services-list li { padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
    .services-list li:before { content: "✓ "; color: #22c55e; font-weight: bold; }
    .pricing { background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; }
    .price { font-size: 48px; font-weight: bold; }
    .price-note { font-size: 14px; opacity: 0.9; }
    .footer { margin-top: 40px; text-align: center; color: #64748b; font-size: 12px; }
    .valid-until { background: #fef3c7; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">ApexLocal360</div>
    <div class="title">Service Proposal</div>
  </div>
  
  <div class="section">
    <div class="section-title">Prepared For</div>
    <div class="client-info">
      <p><strong>Client:</strong> ${data.clientName}</p>
      <p><strong>Business:</strong> ${data.businessName}</p>
      ${data.preparedBy ? `<p><strong>Prepared By:</strong> ${data.preparedBy}</p>` : ''}
    </div>
  </div>
  
  <div class="section">
    <div class="section-title">Included Services</div>
    <ul class="services-list">
      ${data.services.map(s => `<li>${s}</li>`).join('')}
    </ul>
  </div>
  
  <div class="section">
    <div class="pricing">
      <div class="price">$${data.dealValue.toLocaleString()}</div>
      <div class="price-note">Investment Amount</div>
    </div>
  </div>
  
  <div class="valid-until">
    <strong>Proposal Valid Until:</strong> ${data.validUntil}
  </div>
  
  <div class="footer">
    <p>ApexLocal360 | AI-Powered Business Solutions</p>
    <p>This proposal is confidential and intended only for the named recipient.</p>
  </div>
</body>
</html>`;
}

function generateContractHTML(data: ContractData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Times New Roman', serif; margin: 0; padding: 40px; color: #1a1a1a; line-height: 1.6; }
    .header { text-align: center; margin-bottom: 40px; }
    .title { font-size: 24px; font-weight: bold; text-transform: uppercase; }
    .section { margin: 25px 0; }
    .section-title { font-size: 14px; font-weight: bold; text-transform: uppercase; margin-bottom: 10px; }
    .terms { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; margin: 20px 0; }
    .signature-block { margin-top: 60px; display: flex; justify-content: space-between; }
    .signature-line { width: 45%; border-top: 1px solid #1a1a1a; padding-top: 10px; }
    .footer { margin-top: 40px; text-align: center; color: #64748b; font-size: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">Service Agreement</div>
    <p>Contract Number: ${Date.now().toString(36).toUpperCase()}</p>
  </div>
  
  <div class="section">
    <div class="section-title">Parties</div>
    <p>This agreement is between <strong>ApexLocal360</strong> ("Provider") and <strong>${data.businessName}</strong> ("Client"), represented by ${data.clientName}.</p>
  </div>
  
  <div class="section">
    <div class="section-title">Service Plan</div>
    <p>Provider agrees to furnish the <strong>${data.planName}</strong> service plan to Client.</p>
  </div>
  
  <div class="terms">
    <div class="section-title">Terms</div>
    <p><strong>Monthly Rate:</strong> $${data.monthlyRate.toLocaleString()}/month</p>
    <p><strong>Start Date:</strong> ${data.startDate}</p>
    <p><strong>Initial Term:</strong> ${data.termMonths} months</p>
    <p><strong>Billing:</strong> Monthly, in advance</p>
  </div>
  
  <div class="section">
    <div class="section-title">Terms & Conditions</div>
    <p>1. Services will commence on the Start Date and continue for the Initial Term.</p>
    <p>2. Either party may terminate with 30 days written notice after the Initial Term.</p>
    <p>3. Client agrees to pay all invoices within 15 days of receipt.</p>
    <p>4. Provider guarantees 99.9% uptime for all AI services.</p>
  </div>
  
  <div class="signature-block">
    <div class="signature-line">
      <p>Provider Signature</p>
      <p>Date: _____________</p>
    </div>
    <div class="signature-line">
      <p>Client Signature</p>
      <p>Date: _____________</p>
    </div>
  </div>
  
  <div class="footer">
    <p>ApexLocal360 | AI-Powered Business Solutions</p>
  </div>
</body>
</html>`;
}

function generateReportHTML(data: ReportData): string {
  const roi = data.metrics.revenueGenerated / (data.metrics.callsHandled * 0.5 + 100);
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 40px; color: #1a1a1a; }
    .header { text-align: center; margin-bottom: 40px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; padding: 30px; border-radius: 12px; }
    .logo { font-size: 24px; font-weight: bold; }
    .title { font-size: 20px; margin: 10px 0; }
    .period { font-size: 14px; opacity: 0.9; }
    .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 30px 0; }
    .metric { background: #f8fafc; padding: 25px; border-radius: 12px; text-align: center; }
    .metric-value { font-size: 36px; font-weight: bold; color: #3b82f6; }
    .metric-label { font-size: 14px; color: #64748b; margin-top: 5px; }
    .highlight { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; }
    .highlight .metric-value { color: white; }
    .highlight .metric-label { color: rgba(255,255,255,0.9); }
    .roi-section { background: #fef3c7; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0; }
    .footer { margin-top: 40px; text-align: center; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">ApexLocal360</div>
    <div class="title">Value Report for ${data.clientName}</div>
    <div class="period">${data.periodStart} - ${data.periodEnd}</div>
  </div>
  
  <div class="metrics">
    <div class="metric">
      <div class="metric-value">${data.metrics.callsHandled.toLocaleString()}</div>
      <div class="metric-label">Calls Handled</div>
    </div>
    <div class="metric">
      <div class="metric-value">${data.metrics.leadsGenerated.toLocaleString()}</div>
      <div class="metric-label">Leads Generated</div>
    </div>
    <div class="metric">
      <div class="metric-value">${data.metrics.appointmentsBooked.toLocaleString()}</div>
      <div class="metric-label">Appointments Booked</div>
    </div>
    <div class="metric highlight">
      <div class="metric-value">$${data.metrics.revenueGenerated.toLocaleString()}</div>
      <div class="metric-label">Revenue Generated</div>
    </div>
  </div>
  
  <div class="roi-section">
    <p><strong>Your ROI:</strong> ${roi.toFixed(1)}x return on investment this period!</p>
  </div>
  
  <div class="footer">
    <p>Generated by ApexLocal360 AI</p>
    <p>Questions? Contact your success manager.</p>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { documentType, data, leadId, clientId, accountId } = await req.json();

    let html: string;
    let title: string;

    switch (documentType) {
      case 'proposal':
        html = generateProposalHTML(data as ProposalData);
        title = `Proposal - ${data.clientName}`;
        break;
      case 'contract':
        html = generateContractHTML(data as ContractData);
        title = `Contract - ${data.businessName}`;
        break;
      case 'report':
        html = generateReportHTML(data as ReportData);
        title = `Value Report - ${data.clientName}`;
        break;
      default:
        throw new Error(`Unknown document type: ${documentType}`);
    }

    // Save document record
    const { data: doc, error } = await supabase
      .from('generated_documents')
      .insert({
        document_type: documentType,
        title,
        data,
        status: 'generated',
        lead_id: leadId || null,
        client_id: clientId || null,
        account_id: accountId || null
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`Generated ${documentType} document: ${title}`);

    // Return the HTML (in a real implementation, we'd convert to PDF)
    return new Response(JSON.stringify({
      success: true,
      documentId: doc.id,
      title,
      html,
      // In production, you'd use a service like Puppeteer or wkhtmltopdf
      pdfUrl: null,
      message: 'Document generated successfully. PDF conversion available with external service.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('pdf-generator error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
