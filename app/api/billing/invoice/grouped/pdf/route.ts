import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { currentOrganizationId: true },
    });

    if (!user || !user.currentOrganizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    // Get filter parameters
    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const type = searchParams.get('type');

    if (!startDateStr || !endDateStr) {
      return NextResponse.json({ error: 'Date range required' }, { status: 400 });
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    // Build where clause
    const where: any = {
      organizationId: user.currentOrganizationId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Type filter
    if (type && type !== 'all') {
      if (type === 'subscription') {
        where.type = 'SUBSCRIPTION_PAYMENT';
      } else if (type === 'credits') {
        where.type = 'CREDIT_PURCHASE';
      }
    }

    // Fetch transactions in the date range
    const transactions = await prisma.billingTransaction.findMany({
      where,
      include: {
        organization: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (transactions.length === 0) {
      return NextResponse.json({ error: 'No transactions found in date range' }, { status: 404 });
    }

    // Calculate totals
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
    const totalCredits = transactions.reduce((sum, t) => sum + (t.creditsAdded || 0), 0);

    // Generate invoice number
    const startPrefix = startDate.toISOString().slice(0, 7).replace('-', '');
    const endPrefix = endDate.toISOString().slice(0, 7).replace('-', '');
    const invoiceNumber = `INV-${startPrefix}-${endPrefix}-GROUPED`;

    // Generate HTML for the grouped invoice
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Statement ${invoiceNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      padding: 40px;
      max-width: 900px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #2563eb;
    }
    .company-info h1 {
      font-size: 32px;
      color: #2563eb;
      margin-bottom: 8px;
    }
    .company-info p {
      color: #666;
      font-size: 14px;
    }
    .invoice-info {
      text-align: right;
    }
    .invoice-number {
      font-size: 24px;
      font-weight: bold;
      color: #333;
      margin-bottom: 8px;
    }
    .invoice-meta {
      font-size: 14px;
      color: #666;
    }
    .invoice-meta strong {
      color: #333;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }
    .bill-to {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .bill-to p {
      margin: 4px 0;
      font-size: 14px;
    }
    .bill-to .name {
      font-weight: 600;
      font-size: 16px;
      color: #333;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    thead {
      background: #f9fafb;
    }
    th {
      text-align: left;
      padding: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: #666;
      border-bottom: 2px solid #e5e7eb;
    }
    th.right {
      text-align: right;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 13px;
    }
    td.right {
      text-align: right;
    }
    .type-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }
    .type-subscription {
      background: #dbeafe;
      color: #1e40af;
    }
    .type-credits {
      background: #d1fae5;
      color: #065f46;
    }
    .summary-box {
      background: #d1fae5;
      padding: 16px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .summary-box .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .summary-box .label {
      font-size: 14px;
      font-weight: 500;
      color: #065f46;
    }
    .summary-box .value {
      font-size: 18px;
      font-weight: bold;
      color: #065f46;
    }
    .totals {
      margin-left: auto;
      width: 350px;
      margin-top: 20px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      font-size: 14px;
    }
    .total-row.subtotal {
      color: #666;
    }
    .total-row.grand-total {
      border-top: 2px solid #e5e7eb;
      font-size: 18px;
      font-weight: bold;
      padding-top: 16px;
      margin-top: 8px;
    }
    .total-row.grand-total .amount {
      color: #2563eb;
    }
    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 12px;
      color: #999;
    }
    @media print {
      body {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      <h1>Tasty Creative</h1>
      <p>AI-Powered Content Creation Platform</p>
    </div>
    <div class="invoice-info">
      <div class="invoice-number">${invoiceNumber}</div>
      <div class="invoice-meta">
        <p><strong>Statement Period:</strong></p>
        <p>${startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p>to</p>
        <p>${endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Bill To</div>
    <div class="bill-to">
      <p class="name">${transactions[0].organization.name}</p>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Transaction Details</div>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th class="right">Type</th>
          <th class="right">Credits</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${transactions.map(t => `
          <tr>
            <td>${new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
            <td>
              <div style="font-weight: 500; margin-bottom: 4px;">${t.description}</div>
              ${t.planName ? `<div style="font-size: 12px; color: #666;">${t.planName}</div>` : ''}
            </td>
            <td class="right">
              <span class="type-badge type-${t.type === 'SUBSCRIPTION_PAYMENT' ? 'subscription' : 'credits'}">
                ${t.type === 'SUBSCRIPTION_PAYMENT' ? 'Subscription' : 'Credits'}
              </span>
            </td>
            <td class="right">${t.creditsAdded ? `+${t.creditsAdded.toLocaleString()}` : '-'}</td>
            <td class="right">$${t.amount.toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  ${totalCredits > 0 ? `
    <div class="summary-box">
      <div class="row">
        <span class="label">Total Credits Added</span>
        <span class="value">+${totalCredits.toLocaleString()}</span>
      </div>
    </div>
  ` : ''}

  <div class="totals">
    <div class="total-row subtotal">
      <span>Subtotal (${transactions.length} transaction${transactions.length !== 1 ? 's' : ''})</span>
      <span>$${totalAmount.toFixed(2)}</span>
    </div>
    <div class="total-row subtotal">
      <span>Tax</span>
      <span>$0.00</span>
    </div>
    <div class="total-row grand-total">
      <span>Total</span>
      <span class="amount">$${totalAmount.toFixed(2)} USD</span>
    </div>
  </div>

  <div class="footer">
    <p>Thank you for your business!</p>
    <p>This is a computer-generated statement and does not require a signature.</p>
  </div>

  <script>
    // Auto-print when the page loads
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('Error generating grouped invoice PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate grouped invoice PDF' },
      { status: 500 }
    );
  }
}
