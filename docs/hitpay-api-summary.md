# HitPay API Integration Summary

This document summarizes the key integration points, endpoints, and webhook behaviors for HitPay based on the following official documentation:

- [Events Webhooks](https://docs.hitpayapp.com/apis/guide/events)
- [Online Payments](https://docs.hitpayapp.com/apis/guide/online-payments)
- [In-Person Payments Overview](https://docs.hitpayapp.com/apis/guide/in-person-payments/overview)
- [Handling Failed In-Person Payments](https://docs.hitpayapp.com/apis/guide/in-person-payments/failed-payments)

---

## 1. Events Webhooks ([Docs](https://docs.hitpayapp.com/apis/guide/events))
- **Webhooks:** HitPay triggers webhooks for events like payments, orders, charges, invoices, payouts, and transfers.
- **Event Types:** `created`, `updated`, `charge`, `payout`, `invoice`, `order`, `transfer`.
- **Payload:** Contains details about the event (e.g., order status, payment status, customer info, timestamps).
- **Usage:** Register your webhook endpoint in HitPay dashboard. Listen for these events to update your backend order/payment status.

## 2. Online Payments ([Docs](https://docs.hitpayapp.com/apis/guide/online-payments))
- **Step 1: Create Payment Request**
  - Endpoint: `POST https://api.sandbox.hit-pay.com/v1/payment-requests`
  - Required fields: `amount`, `currency`, `email`, `redirect_url`, `reference_number`
  - Response: Includes `id`, `status`, `url` (checkout link), and more.
- **Step 2: Present Checkout Page**
  - Redirect user to the `url` from the response for payment.
- **Step 3: Handle Payment Result**
  - User is redirected to your `redirect_url` after payment.
  - Listen for HitPay webhooks to confirm payment status (`pending`, `paid`, etc).

## 3. In-Person Payments Overview ([Docs](https://docs.hitpayapp.com/apis/guide/in-person-payments/overview))
- **Supported Terminals:** WisePOS E, FlexiPOS, Ingenico S1F2, Ingenico DX4000.
- **Flow:**
  1. Client device requests backend to start a payment.
  2. Backend calls HitPay Payment Request API with `payment method = wifi_card_reader`.
  3. HitPay triggers payment on the connected terminal.
  4. Customer completes payment on device.
  5. HitPay sends a webhook to your backend with payment status.
  6. Backend updates order status accordingly.

## 4. Handling Failed In-Person Payments ([Docs](https://docs.hitpayapp.com/apis/guide/in-person-payments/failed-payments))
- **Failed Payment Webhook:**
  1. HitPay sends a webhook with `status=failed` if payment fails.
  2. Payment request status updated to failed in HitPay system.
  3. Webhook contains error details—should be shown to user or logged.

---

**Best Practices:**
- Always listen for webhooks to update payment/order status.
- On payment failure, update your system and inform the user with error details from the webhook.
- Use the official docs for full payload schemas and advanced use cases.
