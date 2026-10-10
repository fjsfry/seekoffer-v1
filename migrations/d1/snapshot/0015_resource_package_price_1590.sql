-- Update the catalog only. Existing orders and payment amounts are immutable snapshots.
UPDATE commerce__products
SET amount_cents = 1590, version = version + 1,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'resource_complete_application_kit_v1'
  AND slug = 'complete-application-kit'
  AND amount_cents = 990;
