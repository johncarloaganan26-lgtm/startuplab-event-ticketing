# HitPay Webhook 401/500 Debugging Checklist

If you encounter 401 Unauthorized or 500 errors when processing HitPay webhooks, check the following:

- **Raw Body Capture**
  - Ensure the raw request body is captured before any body parsing middleware.
  - HMAC verification must use the exact raw payload as sent by HitPay.

- **Signature Verification**
  - For legacy HMAC: Concatenate all key+value pairs (sorted by key, with no separators, and do not filter out empty strings).
  - For modern webhooks: Use the `Hitpay-Signature` header and compute HMAC over the raw JSON body.
  - Support both signature types.
  - Add debug logs showing all signature candidates and verification steps.

- **Database JSONB Columns**
  - Only insert/update valid JS objects (not stringified JSON or undefined) into JSONB columns.
  - Typos in variable names for payload storage can break JSONB writes and signature verification.

- **General Debugging**
  - If any payment webhook fails with 401 or 500, always check raw body handling, signature logic, and JSONB insert/update code first.

---

**Quick Reference:**
- Raw body must be untouched for HMAC.
- Legacy HMAC = sorted key+value concat, no separators.
- Modern HMAC = header over raw JSON.
- JSONB columns require real JS objects.
- Log everything during debugging.
