-- JianPay returns both a cashier URL and, for WeChat QR checkout, a direct
-- QR image URL. Keep both so the website can render the QR without losing the
-- fallback cashier page.
ALTER TABLE commerce__payments ADD COLUMN pay_qrcode_url TEXT;
