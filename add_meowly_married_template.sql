-- Add Meowly Married (3D Cat-Themed) Template
-- Date: 2026-07-14

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Insert Template Design
-- Category: Exclusive (c0000000-0000-4000-8000-000000000003)
-- Price: 149000.00 (Exclusive tier)
INSERT INTO `template_designs` (`id`, `name`, `slug`, `previewUrl`, `description`, `tags`, `price`, `categoryId`, `isPublished`, `defaultMusic`)
VALUES (13, 'Meowly Married', 'meowly-married', 'https://satuundangan.id/demo/meowly-married', 'Cute 3D cat-themed folding invitation for cat lovers', '["3d","cute","cat","pastel"]', 149000.00, 'c0000000-0000-4000-8000-000000000003', 1, 'wedding-acoustic-morning.mp3')
ON DUPLICATE KEY UPDATE 
  `name` = VALUES(`name`),
  `previewUrl` = VALUES(`previewUrl`),
  `description` = VALUES(`description`),
  `tags` = VALUES(`tags`),
  `price` = VALUES(`price`),
  `isPublished` = VALUES(`isPublished`),
  `defaultMusic` = VALUES(`defaultMusic`);

-- 2. Map Default Sections
DELETE FROM `template_design_sections` WHERE `templateDesignId` = 13;

SET @hero = 's0000000-0000-4000-8000-000000000001';
SET @couple = 's0000000-0000-4000-8000-000000000002';
SET @event = 's0000000-0000-4000-8000-000000000003';
SET @gallery = 's0000000-0000-4000-8000-000000000004';
SET @rsvp = 's0000000-0000-4000-8000-000000000005';
SET @story = 's0000000-0000-4000-8000-000000000006';
SET @gift = 's0000000-0000-4000-8000-000000000007';
SET @music = 's0000000-0000-4000-8000-000000000008';

INSERT INTO `template_design_sections` (`templateDesignId`, `sectionId`, `order`, `is_enabled`) VALUES
(13, @hero, 1, 1),
(13, @couple, 2, 1),
(13, @story, 3, 1),
(13, @event, 4, 1),
(13, @gallery, 5, 1),
(13, @gift, 6, 1),
(13, @rsvp, 7, 1),
(13, @music, 8, 1);

SET FOREIGN_KEY_CHECKS = 1;
