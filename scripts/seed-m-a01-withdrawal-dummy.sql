-- Dummy data for manual test case M-A01:
-- Admin > Monitoring Penarikan > Buka antrean penarikan dana.
--
-- Safe to rerun:
-- - Users and affiliate profiles are upserted by unique email / affiliate code.
-- - Pending withdraw requests are inserted only if the profile has no pending M-A01 request.

SET @now = NOW();

INSERT INTO users (
  name,
  email,
  password,
  provider,
  isAdmin,
  avatar,
  isApproved,
  aiCredits
) VALUES
  (
    '[DUMMY M-A01] Andi Reseller BCA',
    'dummy.m-a01.bca@satuundangan.test',
    NULL,
    'dummy',
    false,
    NULL,
    true,
    1
  ),
  (
    '[DUMMY M-A01] Siti Reseller Mandiri',
    'dummy.m-a01.mandiri@satuundangan.test',
    NULL,
    'dummy',
    false,
    NULL,
    true,
    1
  )
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  provider = VALUES(provider),
  isApproved = VALUES(isApproved);

INSERT INTO affiliate_profiles (
  userId,
  affiliateCode,
  tier,
  status,
  commissionBalance,
  totalEarned,
  totalSales,
  totalSalesAmount,
  bankName,
  bankAccountNumber,
  bankAccountName,
  whatsappNumber,
  lastSaleAt
)
SELECT
  u.id,
  'DUMMYM01BCA',
  'bronze',
  'active',
  500000.00,
  500000.00,
  5,
  5000000.00,
  'BCA',
  '1234567890',
  '[DUMMY M-A01] Andi Reseller BCA',
  '6281111111101',
  @now
FROM users u
WHERE u.email = 'dummy.m-a01.bca@satuundangan.test'
ON DUPLICATE KEY UPDATE
  status = VALUES(status),
  commissionBalance = VALUES(commissionBalance),
  totalEarned = VALUES(totalEarned),
  bankName = VALUES(bankName),
  bankAccountNumber = VALUES(bankAccountNumber),
  bankAccountName = VALUES(bankAccountName),
  whatsappNumber = VALUES(whatsappNumber);

INSERT INTO affiliate_profiles (
  userId,
  affiliateCode,
  tier,
  status,
  commissionBalance,
  totalEarned,
  totalSales,
  totalSalesAmount,
  bankName,
  bankAccountNumber,
  bankAccountName,
  whatsappNumber,
  lastSaleAt
)
SELECT
  u.id,
  'DUMMYM01MDR',
  'silver',
  'active',
  750000.00,
  750000.00,
  8,
  7500000.00,
  'Mandiri',
  '9876543210',
  '[DUMMY M-A01] Siti Reseller Mandiri',
  '6281111111102',
  @now
FROM users u
WHERE u.email = 'dummy.m-a01.mandiri@satuundangan.test'
ON DUPLICATE KEY UPDATE
  status = VALUES(status),
  commissionBalance = VALUES(commissionBalance),
  totalEarned = VALUES(totalEarned),
  bankName = VALUES(bankName),
  bankAccountNumber = VALUES(bankAccountNumber),
  bankAccountName = VALUES(bankAccountName),
  whatsappNumber = VALUES(whatsappNumber);

INSERT INTO withdraw_requests (
  affiliateProfileId,
  requestedAmount,
  status,
  adminNote,
  proofUrl,
  processedAt,
  processedByUserId
)
SELECT
  p.id,
  250000.00,
  'pending',
  'DUMMY M-A01 - pending withdrawal for manual testing',
  NULL,
  NULL,
  NULL
FROM affiliate_profiles p
WHERE p.affiliateCode = 'DUMMYM01BCA'
  AND NOT EXISTS (
    SELECT 1
    FROM withdraw_requests wr
    WHERE wr.affiliateProfileId = p.id
      AND wr.status = 'pending'
      AND wr.adminNote = 'DUMMY M-A01 - pending withdrawal for manual testing'
  );

INSERT INTO withdraw_requests (
  affiliateProfileId,
  requestedAmount,
  status,
  adminNote,
  proofUrl,
  processedAt,
  processedByUserId
)
SELECT
  p.id,
  500000.00,
  'pending',
  'DUMMY M-A01 - pending withdrawal for manual testing',
  NULL,
  NULL,
  NULL
FROM affiliate_profiles p
WHERE p.affiliateCode = 'DUMMYM01MDR'
  AND NOT EXISTS (
    SELECT 1
    FROM withdraw_requests wr
    WHERE wr.affiliateProfileId = p.id
      AND wr.status = 'pending'
      AND wr.adminNote = 'DUMMY M-A01 - pending withdrawal for manual testing'
  );

SELECT
  wr.id AS withdrawRequestId,
  wr.status,
  wr.requestedAmount,
  p.affiliateCode,
  p.bankName,
  p.bankAccountNumber,
  p.bankAccountName,
  u.name AS resellerName
FROM withdraw_requests wr
JOIN affiliate_profiles p ON p.id = wr.affiliateProfileId
JOIN users u ON u.id = p.userId
WHERE p.affiliateCode IN ('DUMMYM01BCA', 'DUMMYM01MDR')
ORDER BY wr.createdAt DESC;
