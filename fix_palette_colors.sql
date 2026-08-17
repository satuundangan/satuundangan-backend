-- Palette Color Patch for Existing Databases
-- Idempotent: safe to re-run; updates palette colors for all known templates.
-- Run: mysql satu_undangan_local < fix_palette_colors.sql

SET FOREIGN_KEY_CHECKS = 0;

-- Palette UUIDs (deterministic per slug)
SET @pal_dark_elegant    = 'p0000000-0000-4000-8000-000000000001';
SET @pal_light_modern    = 'p0000000-0000-4000-8000-000000000002';
SET @pal_botanical       = 'p0000000-0000-4000-8000-000000000003';
SET @pal_royal_gold      = 'p0000000-0000-4000-8000-000000000004';
SET @pal_minimalist_terra= 'p0000000-0000-4000-8000-000000000005';
SET @pal_celestial       = 'p0000000-0000-4000-8000-000000000006';
SET @pal_editorial       = 'p0000000-0000-4000-8000-000000000007';
SET @pal_pixel_quest     = 'p0000000-0000-4000-8000-000000000008';
SET @pal_retro           = 'p0000000-0000-4000-8000-000000000010';
SET @pal_modern_noir     = 'p0000000-0000-4000-8000-000000000011';
SET @pal_azure           = 'p0000000-0000-4000-8000-000000000012';
SET @pal_cyberpunk       = 'p0000000-0000-4000-8000-000000000013';
SET @pal_kimi            = 'p0000000-0000-4000-8000-000000000014';
SET @pal_royal_emerald   = 'p0000000-0000-4000-8000-000000000016';
SET @pal_sakura          = 'p0000000-0000-4000-8000-000000000017';

-- Upsert palette colors
INSERT INTO `master_palette_colors` (`id`, `name`, `primary`, `secondary`, `accent`, `is_active`) VALUES
(@pal_dark_elegant,     'Dark Elegant',          '#d6b18a', '#1a1a1a', '#f0f0f0', 1),
(@pal_light_modern,     'Light Modern',          '#2563eb', '#f3f4f6', '#60a5fa', 1),
(@pal_botanical,        'Botanical Watercolor',  '#b48c5b', '#4a4a4a', '#e8d5c4', 1),
(@pal_royal_gold,       'Royal Gold Heritage',   '#d4af37', '#0a1128', '#f1c40f', 1),
(@pal_minimalist_terra, 'Minimalist Sand & Terra','#3d405b', '#81b29a', '#e07a5f', 1),
(@pal_celestial,        'Celestial Sparkle',     '#f3ca40', '#050b1a', '#e6b033', 1),
(@pal_editorial,        'The Editorial Story',   '#1a1a1a', '#f5f5f5', '#b48c5b', 1),
(@pal_pixel_quest,      'Pixel Quest 8-Bit',     '#f43f5e', '#101018', '#facc15', 1),
(@pal_retro,            'Retro Nostalgia',       '#2c2c2c', '#e06d53', '#fdfbf7', 1),
(@pal_modern_noir,      'Modern Noir',           '#808080', '#0a0a0a', '#e5e5e5', 1),
(@pal_azure,            'Azure Shores',          '#1e3a8a', '#e0f2fe', '#ffb703', 1),
(@pal_cyberpunk,        'Cyberpunk Neon',        '#00f0ff', '#ff003c', '#facc15', 1),
(@pal_kimi,             'Kimi no Na wa',         '#ff8a00', '#020111', '#ffffff', 1),
(@pal_royal_emerald,    'Royal Emerald',         '#d4af37', '#022b1d', '#ffffff', 1),
(@pal_sakura,           'Sakura Blossom',        '#d6336c', '#fff8fa', '#ffb6c1', 1)
ON DUPLICATE KEY UPDATE
  `name`      = VALUES(`name`),
  `primary`   = VALUES(`primary`),
  `secondary` = VALUES(`secondary`),
  `accent`    = VALUES(`accent`),
  `is_active` = VALUES(`is_active`);

-- Link templates by slug (works even if template ids differ across environments)
UPDATE `template_designs` SET `paletteId` = @pal_dark_elegant     WHERE `slug` = 'dark-elegant';
UPDATE `template_designs` SET `paletteId` = @pal_light_modern     WHERE `slug` = 'light-modern';
UPDATE `template_designs` SET `paletteId` = @pal_botanical        WHERE `slug` = 'botanical-watercolor';
UPDATE `template_designs` SET `paletteId` = @pal_royal_gold       WHERE `slug` = 'royal-gold';
UPDATE `template_designs` SET `paletteId` = @pal_minimalist_terra WHERE `slug` = 'minimalist-terra';
UPDATE `template_designs` SET `paletteId` = @pal_celestial        WHERE `slug` = 'celestial-sparkle';
UPDATE `template_designs` SET `paletteId` = @pal_editorial        WHERE `slug` = 'editorial-magazine';
UPDATE `template_designs` SET `paletteId` = @pal_pixel_quest      WHERE `slug` = 'pixel-quest';
UPDATE `template_designs` SET `paletteId` = @pal_retro            WHERE `slug` = 'retro-nostalgia';
UPDATE `template_designs` SET `paletteId` = @pal_modern_noir      WHERE `slug` = 'modern-noir';
UPDATE `template_designs` SET `paletteId` = @pal_azure            WHERE `slug` = 'azure-shores';
UPDATE `template_designs` SET `paletteId` = @pal_cyberpunk        WHERE `slug` = 'cyberpunk-neon';
UPDATE `template_designs` SET `paletteId` = @pal_kimi             WHERE `slug` = 'kimi-no-na-wa';
UPDATE `template_designs` SET `paletteId` = @pal_royal_emerald    WHERE `slug` = 'royal-emerald';
UPDATE `template_designs` SET `paletteId` = @pal_sakura           WHERE `slug` = 'sakura-blossom';

SET FOREIGN_KEY_CHECKS = 1;
