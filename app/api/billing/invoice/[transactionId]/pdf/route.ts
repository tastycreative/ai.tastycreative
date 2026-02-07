import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: { transactionId: string } }
) {
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

    // Fetch the transaction
    const transaction = await prisma.billingTransaction.findFirst({
      where: {
        id: params.transactionId,
        organizationId: user.currentOrganizationId,
      },
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
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Generate invoice number
    const datePrefix = new Date(transaction.createdAt).toISOString().slice(0, 7).replace('-', '');
    const idSuffix = transaction.id.slice(-8).toUpperCase();
    const invoiceNumber = `INV-${datePrefix}-${idSuffix}`;

    // Generate HTML for the invoice
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${invoiceNumber}</title>
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
      max-width: 800px;
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
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: #666;
      border-bottom: 2px solid #e5e7eb;
    }
    th.right {
      text-align: right;
    }
    td {
      padding: 16px 12px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
    }
    td.right {
      text-align: right;
    }
    .item-description {
      font-weight: 500;
      color: #333;
      margin-bottom: 4px;
    }
    .item-meta {
      font-size: 12px;
      color: #666;
    }
    .credits-badge {
      display: inline-block;
      background: #d1fae5;
      color: #065f46;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      margin-top: 8px;
    }
    .totals {
      margin-left: auto;
      width: 300px;
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
    .status-badge {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-completed {
      background: #d1fae5;
      color: #065f46;
    }
    .status-pending {
      background: #fef3c7;
      color: #92400e;
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
        <p><strong>Issue Date:</strong> ${new Date(transaction.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p><strong>Status:</strong> <span class="status-badge status-${transaction.status.toLowerCase()}">${transaction.status}</span></p>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Bill To</div>
    <div class="bill-to">
      <p class="name">${transaction.organization.name}</p>
      ${transaction.user ? `
        <p>${transaction.user.firstName && transaction.user.lastName ? `${transaction.user.firstName} ${transaction.user.lastName}` : transaction.user.email || 'Unknown User'}</p>
      ` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Invoice Items</div>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="right">Quantity</th>
          <th class="right">Unit Price</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div class="item-description">${transaction.description}</div>
            ${transaction.planName ? `<div class="item-meta">Plan: ${transaction.planName}</div>` : ''}
            ${transaction.billingPeriodStart && transaction.billingPeriodEnd ? `
              <div class="item-meta">
                Period: ${new Date(transaction.billingPeriodStart).toLocaleDateString()} - ${new Date(transaction.billingPeriodEnd).toLocaleDateString()}
              </div>
            ` : ''}
            ${transaction.creditsAdded ? `
              <div class="credits-badge">+${transaction.creditsAdded.toLocaleString()} credits added</div>
            ` : ''}
          </td>
          <td class="right">1</td>
          <td class="right">$${transaction.amount.toFixed(2)}</td>
          <td class="right">$${transaction.amount.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="totals">
    <div class="total-row subtotal">
      <span>Subtotal</span>
      <span>$${transaction.amount.toFixed(2)}</span>
    </div>
    <div class="total-row subtotal">
      <span>Tax</span>
      <span>$0.00</span>
    </div>
    <div class="total-row grand-total">
      <span>Total</span>
      <span class="amount">$${transaction.amount.toFixed(2)} ${transaction.currency.toUpperCase()}</span>
    </div>
  </div>

  <div class="footer">
    <p>Thank you for your business!</p>
    <p>This is a computer-generated invoice and does not require a signature.</p>
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
    console.error('Error generating invoice PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate invoice PDF' },
      { status: 500 }
    );
  }
}
