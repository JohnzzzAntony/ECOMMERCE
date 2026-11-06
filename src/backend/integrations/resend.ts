import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  console.warn('[Resend] RESEND_API_KEY not set — emails will be skipped')
}

export const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'johns.antony@hotmail.com'

// ─── Order Confirmation (to customer) ────────────────────────────────────────
export async function sendOrderConfirmation(order: {
  orderNumber: string
  customerName: string
  email: string
  total: number
  paymentMethod: string
  items: Array<{ productName: string; qty: number; unitPrice: number; subtotal: number }>
}) {
  const itemsHtml = order.items
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee">${i.productName}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.qty}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">AED ${i.unitPrice.toFixed(2)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">AED ${i.subtotal.toFixed(2)}</td>
        </tr>`
    )
    .join('')

  try {
    await resend.emails.send({
      from: `NexEcoms <${FROM}>`,
      to: order.email,
      subject: `Order Confirmed — ${order.orderNumber} | NexEcoms`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#222">
          <div style="background:#1a56db;padding:24px;text-align:center">
            <h1 style="color:#fff;margin:0;font-size:24px">NexEcoms</h1>
            <p style="color:#cce3ff;margin:8px 0 0">Your order is confirmed!</p>
          </div>
          <div style="padding:24px">
            <p>Hi <strong>${order.customerName}</strong>,</p>
            <p>Thank you for your order. We've received it and will process it shortly.</p>
            <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0">
              <p style="margin:0"><strong>Order Number:</strong> ${order.orderNumber}</p>
              <p style="margin:8px 0 0"><strong>Payment:</strong> ${order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Card Payment'}</p>
            </div>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <thead>
                <tr style="background:#f1f5f9">
                  <th style="padding:8px;text-align:left">Product</th>
                  <th style="padding:8px;text-align:center">Qty</th>
                  <th style="padding:8px;text-align:right">Price</th>
                  <th style="padding:8px;text-align:right">Subtotal</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
              <tfoot>
                <tr>
                  <td colspan="3" style="padding:12px 8px;text-align:right;font-weight:bold">Total</td>
                  <td style="padding:12px 8px;text-align:right;font-weight:bold;font-size:18px;color:#1a56db">
                    AED ${order.total.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
            <p>If you have any questions, reply to this email or contact us on WhatsApp.</p>
            <p style="color:#666;font-size:12px;margin-top:32px;border-top:1px solid #eee;padding-top:16px">
              NexEcoms — Dubai, UAE | www.jkrinternational.com
            </p>
          </div>
        </div>
      `,
    })
  } catch (err) {
    console.error('[Resend] sendOrderConfirmation failed:', err)
  }
}

// ─── Order Admin Notification ─────────────────────────────────────────────────
export async function sendOrderAdminNotification(order: {
  orderNumber: string
  customerName: string
  email: string
  phone?: string | null
  total: number
  paymentMethod: string
  items: Array<{ productName: string; qty: number; subtotal: number }>
}) {
  try {
    await resend.emails.send({
      from: `JKR Orders <${FROM}>`,
      to: ADMIN_EMAIL,
      subject: `🛒 New Order: ${order.orderNumber} — AED ${order.total.toFixed(2)}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2>New Order Received</h2>
          <p><strong>Order #:</strong> ${order.orderNumber}</p>
          <p><strong>Customer:</strong> ${order.customerName} (${order.email})</p>
          ${order.phone ? `<p><strong>Phone:</strong> ${order.phone}</p>` : ''}
          <p><strong>Payment:</strong> ${order.paymentMethod}</p>
          <p><strong>Total:</strong> AED ${order.total.toFixed(2)}</p>
          <h3>Items:</h3>
          <ul>${order.items.map((i) => `<li>${i.productName} x${i.qty} = AED ${i.subtotal.toFixed(2)}</li>`).join('')}</ul>
        </div>
      `,
    })
  } catch (err) {
    console.error('[Resend] sendOrderAdminNotification failed:', err)
  }
}

// ─── Enquiry Admin Notification ───────────────────────────────────────────────
export async function sendEnquiryNotification(enquiry: {
  customerName: string
  email: string
  phone?: string
  company?: string
  message?: string
  itemsJson: string
  total: number
}) {
  let items: any[] = []
  try { items = JSON.parse(enquiry.itemsJson) } catch {}

  try {
    await resend.emails.send({
      from: `JKR Enquiries <${FROM}>`,
      to: ADMIN_EMAIL,
      subject: `📋 New Enquiry from ${enquiry.customerName}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2>New Enquiry</h2>
          <p><strong>Name:</strong> ${enquiry.customerName}</p>
          <p><strong>Email:</strong> ${enquiry.email}</p>
          ${enquiry.phone ? `<p><strong>Phone:</strong> ${enquiry.phone}</p>` : ''}
          ${enquiry.company ? `<p><strong>Company:</strong> ${enquiry.company}</p>` : ''}
          ${enquiry.message ? `<p><strong>Message:</strong> ${enquiry.message}</p>` : ''}
          <p><strong>Estimated Total:</strong> AED ${enquiry.total.toFixed(2)}</p>
          ${items.length > 0 ? `<h3>Products:</h3><ul>${items.map((i: any) => `<li>${i.productName || i.name} x${i.qty || i.quantity}</li>`).join('')}</ul>` : ''}
        </div>
      `,
    })
  } catch (err) {
    console.error('[Resend] sendEnquiryNotification failed:', err)
  }
}

// ─── Contact Form Admin Notification ─────────────────────────────────────────
export async function sendContactNotification(contact: {
  name: string
  email: string
  phone?: string
  subject?: string
  message: string
}) {
  try {
    await resend.emails.send({
      from: `JKR Contact <${FROM}>`,
      to: ADMIN_EMAIL,
      subject: `📩 Contact: ${contact.subject || 'New Message'} — from ${contact.name}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2>New Contact Message</h2>
          <p><strong>Name:</strong> ${contact.name}</p>
          <p><strong>Email:</strong> ${contact.email}</p>
          ${contact.phone ? `<p><strong>Phone:</strong> ${contact.phone}</p>` : ''}
          ${contact.subject ? `<p><strong>Subject:</strong> ${contact.subject}</p>` : ''}
          <p><strong>Message:</strong></p>
          <blockquote style="border-left:4px solid #1a56db;padding-left:16px;color:#444">
            ${contact.message}
          </blockquote>
        </div>
      `,
    })
  } catch (err) {
    console.error('[Resend] sendContactNotification failed:', err)
  }
}

// ─── Newsletter Welcome ───────────────────────────────────────────────────────
export async function sendNewsletterWelcome(email: string) {
  try {
    await resend.emails.send({
      from: `NexEcoms <${FROM}>`,
      to: email,
      subject: 'Welcome to NexEcoms Newsletter!',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1a56db;padding:24px;text-align:center">
            <h1 style="color:#fff;margin:0">NexEcoms</h1>
          </div>
          <div style="padding:24px">
            <h2>You're subscribed! 🎉</h2>
            <p>Thank you for subscribing to the NexEcoms newsletter.</p>
            <p>You'll be the first to know about new products, exclusive offers, and the latest in medical equipment technology.</p>
            <p style="color:#666;font-size:12px;margin-top:32px;border-top:1px solid #eee;padding-top:16px">
              NexEcoms — Dubai, UAE<br>
              <a href="https://jkrinternational.com" style="color:#1a56db">www.jkrinternational.com</a>
            </p>
          </div>
        </div>
      `,
    })
  } catch (err) {
    console.error('[Resend] sendNewsletterWelcome failed:', err)
  }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

// ─── Enquiry Reply (admin → customer) ─────────────────────────────────────────
/** Returns true only if Resend accepted the email. */
export async function sendEnquiryResponse(reply: { to: string; customerName: string; response: string }) {
  if (!process.env.RESEND_API_KEY) return false
  try {
    const { error } = await resend.emails.send({
      from: `NexEcoms <${FROM}>`,
      to: reply.to,
      replyTo: ADMIN_EMAIL,
      subject: 'Re: Your enquiry | NexEcoms',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#222">
          <div style="background:#1a56db;padding:24px;text-align:center">
            <h1 style="color:#fff;margin:0;font-size:24px">NexEcoms</h1>
          </div>
          <div style="padding:24px">
            <p>Hi <strong>${escapeHtml(reply.customerName)}</strong>,</p>
            <p>Thank you for your enquiry. Here is our response:</p>
            <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0;white-space:pre-wrap">${escapeHtml(reply.response)}</div>
            <p>Simply reply to this email if you have any questions.</p>
          </div>
        </div>
      `,
    })
    if (error) console.error('[Resend] sendEnquiryResponse failed:', error.message)
    return !error
  } catch (err) {
    console.error('[Resend] sendEnquiryResponse failed:', err)
    return false
  }
}
