-- Satu Undangan Database Migration: Update Template Prices to 2026 Strategy (49k / 79k / 99k)
-- Description: Align all template_designs table prices with the new pricing tier model.

START TRANSACTION;

-- 1. Update prices by category UUID
UPDATE template_designs 
SET price = 49000.00 
WHERE categoryId = 'c0000000-0000-4000-8000-000000000001';

UPDATE template_designs 
SET price = 79000.00 
WHERE categoryId = 'c0000000-0000-4000-8000-000000000002';

UPDATE template_designs 
SET price = 99000.00 
WHERE categoryId = 'c0000000-0000-4000-8000-000000000003';

-- 2. Fallback updates by slug for newly registered templates
UPDATE template_designs SET price = 49000.00 WHERE slug IN ('dark-elegant', 'light-modern');
UPDATE template_designs SET price = 79000.00 WHERE slug IN ('botanical-watercolor', 'royal-gold', 'minimalist-terra', 'pixel-quest', 'retro-nostalgia');
UPDATE template_designs SET price = 99000.00 WHERE slug IN ('celestial-sparkle', 'editorial-magazine', 'modern-noir', 'azure-shores', 'cyberpunk-neon', 'arabian-night', 'manuk-dadali', 'meowly-married');

COMMIT;

-- Verification check
SELECT id, name, slug, categoryId, price, isPublished FROM template_designs ORDER BY price ASC, id ASC;
