-- Satu Undangan Production Seed Script
-- Target Database: MySQL
-- Description: Truncate existing data and re-initialize with production-ready data for Categories, Sections, and Templates.

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Truncate Tables
TRUNCATE TABLE template_design_sections;
TRUNCATE TABLE template_designs;
TRUNCATE TABLE categories;
TRUNCATE TABLE master_sections;
TRUNCATE TABLE master_palette_colors;

-- 2. Insert Categories
-- UUIDs generated for reference in templates
SET @cat_basic = 'c0000000-0000-4000-8000-000000000001';
SET @cat_premium = 'c0000000-0000-4000-8000-000000000002';
SET @cat_exclusive = 'c0000000-0000-4000-8000-000000000003';

INSERT INTO categories (id, name, color) VALUES 
(@cat_basic, 'Basic', '#94a3b8'),
(@cat_premium, 'Premium', '#d4af37'),
(@cat_exclusive, 'Exclusive', '#1e293b');

-- 3. Insert Master Sections (Fitur)
-- Static UUIDs for stable relations
SET @sec_hero = 's0000000-0000-4000-8000-000000000001';
SET @sec_couple = 's0000000-0000-4000-8000-000000000002';
SET @sec_event = 's0000000-0000-4000-8000-000000000003';
SET @sec_gallery = 's0000000-0000-4000-8000-000000000004';
SET @sec_rsvp = 's0000000-0000-4000-8000-000000000005';
SET @sec_story = 's0000000-0000-4000-8000-000000000006';
SET @sec_gift = 's0000000-0000-4000-8000-000000000007';
SET @sec_music = 's0000000-0000-4000-8000-000000000008';
SET @sec_video = 's0000000-0000-4000-8000-000000000009';
SET @sec_menu = 's0000000-0000-4000-8000-000000000010';

INSERT INTO master_sections (id, label, `key`, is_active) VALUES 
(@sec_hero, 'Header / Hero', 'hero', 1),
(@sec_couple, 'Profil Pasangan', 'couple', 1),
(@sec_event, 'Detail Acara & Lokasi', 'event', 1),
(@sec_gallery, 'Galeri Foto', 'gallery', 1),
(@sec_rsvp, 'Konfirmasi Kehadiran (RSVP)', 'rsvp', 1),
(@sec_story, 'Cerita Cinta (Love Story)', 'love-story', 1),
(@sec_gift, 'Amplop Digital (Gift)', 'gift', 1),
(@sec_music, 'Musik Latar (Background Music)', 'music', 1),
(@sec_video, 'Video Prewedding', 'video', 1),
(@sec_menu, 'Menu Hidangan', 'menu', 1);

-- 4. Insert Template Designs
-- id | name | slug | previewUrl | thumbnailUrl | isPublished | isPremium | categoryId | price | description | tags
INSERT INTO template_designs (id, name, slug, previewUrl, thumbnailUrl, isPublished, isPremium, categoryId, price, description, tags) VALUES 
(1, 'Dark Elegant', 'dark-elegant', NULL, NULL, 1, 0, @cat_basic, 0, 'Desain mewah dengan nuansa gelap dan emas', 'elegant,dark,gold'),
(2, 'Light Modern', 'light-modern', NULL, NULL, 1, 0, @cat_basic, 0, 'Desain bersih, cerah, dan kontemporer', 'clean,modern,white'),
(3, 'Botanical Watercolor', 'botanical-watercolor', NULL, NULL, 1, 1, @cat_premium, 50000, 'Desain bunga cat air yang romantis dan manis', 'floral,watercolor,romantic'),
(4, 'Royal Gold Heritage', 'royal-gold', NULL, NULL, 1, 1, @cat_premium, 75000, 'Desain megah dengan ukiran emas tradisional', 'royal,gold,heritage'),
(5, 'Minimalist Sand & Terra', 'minimalist-terra', NULL, NULL, 1, 1, @cat_premium, 50000, 'Estetika boho dengan warna bumi yang hangat', 'boho,minimalist,earthy'),
(6, 'Celestial Sparkle', 'celestial-sparkle', NULL, NULL, 1, 1, @cat_exclusive, 100000, 'Nuansa magis langit malam bertabur bintang', 'celestial,dreamy,night'),
(7, 'The Editorial Story', 'editorial-magazine', NULL, NULL, 1, 1, @cat_exclusive, 150000, 'Gaya majalah fashion kelas atas yang ikonik', 'editorial,magazine,fashion'),
(13, 'Pixel Quest 8-Bit', 'pixel-quest', '/demo/pixel-quest', NULL, 1, 1, @cat_premium, 129000, 'Desain retro 8-bit yang unik dan penuh nostalgia', '["retro","8bit","pixel","gaming"]');

-- 5. Link Templates to Sections (Default Features)
-- dark-elegant
INSERT INTO template_design_sections (templateDesignId, sectionId, `order`, is_enabled) VALUES 
(1, @sec_hero, 1, 1), (1, @sec_couple, 2, 1), (1, @sec_event, 3, 1), (1, @sec_gallery, 4, 1), (1, @sec_rsvp, 5, 1), (1, @sec_music, 6, 1);
-- light-modern
INSERT INTO template_design_sections (templateDesignId, sectionId, `order`, is_enabled) VALUES 
(2, @sec_hero, 1, 1), (2, @sec_couple, 2, 1), (2, @sec_event, 3, 1), (2, @sec_gallery, 4, 1), (2, @sec_rsvp, 5, 1), (2, @sec_music, 6, 1);
-- botanical-watercolor
INSERT INTO template_design_sections (templateDesignId, sectionId, `order`, is_enabled) VALUES 
(3, @sec_hero, 1, 1), (3, @sec_couple, 2, 1), (3, @sec_event, 3, 1), (3, @sec_gallery, 4, 1), (3, @sec_rsvp, 5, 1), (3, @sec_music, 6, 1), (3, @sec_story, 7, 1);
-- royal-gold
INSERT INTO template_design_sections (templateDesignId, sectionId, `order`, is_enabled) VALUES 
(4, @sec_hero, 1, 1), (4, @sec_couple, 2, 1), (4, @sec_event, 3, 1), (4, @sec_gallery, 4, 1), (4, @sec_rsvp, 5, 1), (4, @sec_gift, 6, 1);
-- minimalist-terra
INSERT INTO template_design_sections (templateDesignId, sectionId, `order`, is_enabled) VALUES 
(5, @sec_hero, 1, 1), (5, @sec_couple, 2, 1), (5, @sec_event, 3, 1), (5, @sec_gallery, 4, 1), (5, @sec_rsvp, 5, 1);
-- celestial-sparkle
INSERT INTO template_design_sections (templateDesignId, sectionId, `order`, is_enabled) VALUES 
(6, @sec_hero, 1, 1), (6, @sec_couple, 2, 1), (6, @sec_event, 3, 1), (6, @sec_gallery, 4, 1), (6, @sec_rsvp, 5, 1), (6, @sec_video, 6, 1);
-- editorial-magazine
INSERT INTO template_design_sections (templateDesignId, sectionId, `order`, is_enabled) VALUES 
(7, @sec_hero, 1, 1), (7, @sec_couple, 2, 1), (7, @sec_event, 3, 1), (7, @sec_gallery, 4, 1), (7, @sec_rsvp, 5, 1), (7, @sec_menu, 6, 1);
-- pixel-quest
INSERT INTO template_design_sections (templateDesignId, sectionId, `order`, is_enabled) VALUES 
(13, @sec_hero, 1, 1), (13, @sec_couple, 2, 1), (13, @sec_story, 3, 1), (13, @sec_event, 4, 1), (13, @sec_gallery, 5, 1), (13, @sec_rsvp, 6, 1), (13, @sec_gift, 7, 1), (13, @sec_music, 8, 1);

SET FOREIGN_KEY_CHECKS = 1;
