-- DB SYNC SCRIPT: SATU UNDANGAN TEMPLATES & COMPONENTS
-- Date: 2026-04-24

SET FOREIGN_KEY_CHECKS = 0;

-- 1. TAMBAHKAN MASTER SECTIONS YANG KURANG
INSERT IGNORE INTO `master_sections` (`id`, `label`, `key`, `is_active`) VALUES 
('s0000000-0000-4000-8000-000000000012', 'Turut Mengundang', 'extended-family', 1),
('s0000000-0000-4000-8000-000000000013', 'Live Streaming', 'live-streaming', 1),
('s0000000-0000-4000-8000-000000000014', 'Dress Code', 'dress-code', 1);

-- 2. UPDATE HARGA & KATEGORI TEMPLATE LAMA (ID 1-7)
UPDATE `template_designs` SET `price` = 79000.00 WHERE `id` IN (1, 2);
UPDATE `template_designs` SET `price` = 129000.00 WHERE `id` IN (3, 4, 5);
UPDATE `template_designs` SET `price` = 149000.00 WHERE `id` IN (6, 7);

-- 3. TAMBAHKAN 5 TEMPLATE BARU (ID 8-12)
INSERT IGNORE INTO `template_designs` (`id`, `name`, `slug`, `previewUrl`, `description`, `tags`, `isPremium`, `price`, `categoryId`, `isPublished`) VALUES 
(8, 'Zen Tranquility', 'zen-tranquility', 'https://satuundangan.id/demo/zen-tranquility', 'Minimalist Japanese aesthetic with earthy tones', '["minimalist","japanese","zen"]', 1, 129000.00, 'c0000000-0000-4000-8000-000000000002', 1),
(9, 'Retro Nostalgia', 'retro-nostalgia', 'https://satuundangan.id/demo/retro-nostalgia', 'Classic scrapbook and polaroid style', '["retro","vintage","scrapbook"]', 1, 129000.00, 'c0000000-0000-4000-8000-000000000002', 1),
(10, 'Modern Noir', 'modern-noir', 'https://satuundangan.id/demo/modern-noir', 'Cinematic high-contrast dark elegant style', '["noir","dark","cinematic"]', 1, 149000.00, 'c0000000-0000-4000-8000-000000000003', 1),
(11, 'Azure Shores', 'azure-shores', 'https://satuundangan.id/demo/azure-shores', 'Mediterranean beach and summer vibes', '["beach","blue","summer"]', 1, 149000.00, 'c0000000-0000-4000-8000-000000000003', 1),
(12, 'Cyberpunk Neon', 'cyberpunk-neon', 'https://satuundangan.id/demo/cyberpunk-neon', 'Futuristic neon and tech-savvy design', '["cyberpunk","neon","future"]', 1, 149000.00, 'c0000000-0000-4000-8000-000000000003', 1);

-- 4. RE-MAP DEFAULT SECTIONS (Hapus dulu biar bersih, lalu insert ulang)
DELETE FROM `template_design_sections` WHERE `templateDesignId` BETWEEN 1 AND 12;

-- Section IDs Mapping for reference
SET @hero = 's0000000-0000-4000-8000-000000000001';
SET @couple = 's0000000-0000-4000-8000-000000000002';
SET @event = 's0000000-0000-4000-8000-000000000003';
SET @gallery = 's0000000-0000-4000-8000-000000000004';
SET @rsvp = 's0000000-0000-4000-8000-000000000005';
SET @story = 's0000000-0000-4000-8000-000000000006';
SET @gift = 's0000000-0000-4000-8000-000000000007';
SET @music = 's0000000-0000-4000-8000-000000000008';
SET @video = 's0000000-0000-4000-8000-000000000009';
SET @menu = 's0000000-0000-4000-8000-000000000010';
SET @prokes = 's0000000-0000-4000-8000-000000000011';
SET @extfam = 's0000000-0000-4000-8000-000000000012';
SET @live = 's0000000-0000-4000-8000-000000000013';
SET @dress = 's0000000-0000-4000-8000-000000000014';

INSERT INTO `template_design_sections` (`templateDesignId`, `sectionId`, `order`, `is_enabled`) VALUES
-- 1. Dark Elegant (Basic)
(1, @hero, 1, 1), (1, @couple, 2, 1), (1, @event, 3, 1), (1, @rsvp, 4, 1), (1, @music, 5, 1),
-- 2. Light Modern (Basic)
(2, @hero, 1, 1), (2, @couple, 2, 1), (2, @event, 3, 1), (2, @rsvp, 4, 1), (2, @music, 5, 1),
-- 3. Botanical Watercolor (Premium)
(3, @hero, 1, 1), (3, @couple, 2, 1), (3, @story, 3, 1), (3, @event, 4, 1), (3, @gallery, 5, 1), (3, @rsvp, 6, 1), (3, @gift, 7, 1), (3, @music, 8, 1),
-- 4. Royal Gold (Premium)
(4, @hero, 1, 1), (4, @couple, 2, 1), (4, @story, 3, 1), (4, @event, 4, 1), (4, @gallery, 5, 1), (4, @rsvp, 6, 1), (4, @gift, 7, 1), (4, @music, 8, 1),
-- 5. Minimalist Terra (Premium)
(5, @hero, 1, 1), (5, @couple, 2, 1), (5, @story, 3, 1), (5, @event, 4, 1), (5, @gallery, 5, 1), (5, @rsvp, 6, 1), (5, @gift, 7, 1), (5, @music, 8, 1),
-- 8. Zen Tranquility (Premium)
(8, @hero, 1, 1), (8, @couple, 2, 1), (8, @story, 3, 1), (8, @event, 4, 1), (8, @gallery, 5, 1), (8, @rsvp, 6, 1), (8, @gift, 7, 1), (8, @music, 8, 1),
-- 9. Retro Nostalgia (Premium)
(9, @hero, 1, 1), (9, @couple, 2, 1), (9, @story, 3, 1), (9, @event, 4, 1), (9, @gallery, 5, 1), (9, @rsvp, 6, 1), (9, @gift, 7, 1), (9, @music, 8, 1),
-- 6. Celestial Sparkle (Exclusive)
(6, @hero, 1, 1), (6, @couple, 2, 1), (6, @story, 3, 1), (6, @event, 4, 1), (6, @gallery, 5, 1), (6, @rsvp, 6, 1), (6, @gift, 7, 1), (6, @video, 8, 1), (6, @extfam, 9, 1), (6, @live, 10, 1), (6, @dress, 11, 1), (6, @music, 12, 1),
-- 7. Editorial Magazine (Exclusive)
(7, @hero, 1, 1), (7, @couple, 2, 1), (7, @story, 3, 1), (7, @event, 4, 1), (7, @gallery, 5, 1), (7, @rsvp, 6, 1), (7, @gift, 7, 1), (7, @menu, 8, 1), (7, @extfam, 9, 1), (7, @live, 10, 1), (7, @dress, 11, 1), (7, @music, 12, 1),
-- 10. Modern Noir (Exclusive)
(10, @hero, 1, 1), (10, @couple, 2, 1), (10, @story, 3, 1), (10, @event, 4, 1), (10, @gallery, 5, 1), (10, @rsvp, 6, 1), (10, @gift, 7, 1), (10, @video, 8, 1), (10, @extfam, 9, 1), (10, @live, 10, 1), (10, @dress, 11, 1), (10, @music, 12, 1),
-- 11. Azure Shores (Exclusive)
(11, @hero, 1, 1), (11, @couple, 2, 1), (11, @story, 3, 1), (11, @event, 4, 1), (11, @gallery, 5, 1), (11, @rsvp, 6, 1), (11, @gift, 7, 1), (11, @video, 8, 1), (11, @extfam, 9, 1), (11, @live, 10, 1), (11, @dress, 11, 1), (11, @music, 12, 1),
-- 12. Cyberpunk Neon (Exclusive)
(12, @hero, 1, 1), (12, @couple, 2, 1), (12, @story, 3, 1), (12, @event, 4, 1), (12, @gallery, 5, 1), (12, @rsvp, 6, 1), (12, @gift, 7, 1), (12, @video, 8, 1), (12, @extfam, 9, 1), (12, @live, 10, 1), (12, @dress, 11, 1), (12, @music, 12, 1);

-- 5. UPDATE DEFAULT MUSIC FOR EACH TEMPLATE
UPDATE `template_designs` SET `defaultMusic` = 'romantic_music1.mp3' WHERE `id` IN (1, 2);
UPDATE `template_designs` SET `defaultMusic` = 'wedding-instrumental-garden.mp3' WHERE `id` = 3;
UPDATE `template_designs` SET `defaultMusic` = 'wedding-sacred-ceremony.mp3' WHERE `id` = 4;
UPDATE `template_designs` SET `defaultMusic` = 'wedding-acoustic-morning.mp3' WHERE `id` = 5;
UPDATE `template_designs` SET `defaultMusic` = 'wedding-warm-reception.mp3' WHERE `id` = 8;
UPDATE `template_designs` SET `defaultMusic` = 'wedding-elegant-firstdance.mp3' WHERE `id` = 9;
UPDATE `template_designs` SET `defaultMusic` = 'wedding-romantic-aisle.mp3' WHERE `id` = 6;
UPDATE `template_designs` SET `defaultMusic` = 'wedding-elegant-firstdance.mp3' WHERE `id` = 7;
UPDATE `template_designs` SET `defaultMusic` = 'wedding-sacred-ceremony.mp3' WHERE `id` = 10;
UPDATE `template_designs` SET `defaultMusic` = 'wedding-acoustic-morning.mp3' WHERE `id` = 11;
UPDATE `template_designs` SET `defaultMusic` = 'wedding-romantic-aisle.mp3' WHERE `id` = 12;

SET FOREIGN_KEY_CHECKS = 1;
