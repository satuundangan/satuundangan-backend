-- Add the config-driven Arabian Night template.
-- The visual language is an original Arabian fairy-tale night aesthetic;
-- it intentionally does not use Disney characters, logos, or copyrighted art.

SET @cat_exclusive = 'c0000000-0000-4000-8000-000000000003';
SET @sec_hero = 's0000000-0000-4000-8000-000000000001';
SET @sec_couple = 's0000000-0000-4000-8000-000000000002';
SET @sec_event = 's0000000-0000-4000-8000-000000000003';
SET @sec_gallery = 's0000000-0000-4000-8000-000000000004';
SET @sec_rsvp = 's0000000-0000-4000-8000-000000000005';
SET @sec_story = 's0000000-0000-4000-8000-000000000006';
SET @sec_gift = 's0000000-0000-4000-8000-000000000007';
SET @sec_music = 's0000000-0000-4000-8000-000000000008';
SET @sec_family = 's0000000-0000-4000-8000-000000000012';
SET @sec_dress = 's0000000-0000-4000-8000-000000000014';

INSERT INTO template_designs (
  name, slug, componentKey, previewUrl, thumbnailUrl, isPublished, categoryId,
  price, description, tags, filterGroup, designConfig, defaultMusic
) VALUES (
  'Arabian Night',
  'arabian-night',
  'dynamic-theme',
  'https://satuundangan.id/demo/arabian-night',
  'https://satuundangan.id/assets/images/arabian-night/hero.svg',
  1,
  @cat_exclusive,
  239000.00,
  'Nuansa dongeng malam gurun dengan biru tengah malam dan aksen emas hangat.',
  '["arabian","night","fairytale","desert","royal"]',
  'Romantis & Dreamy',
  '{
    "version":1,
    "colors":{"primary":"#e9c46a","secondary":"#6d4c41","accent":"#f4a261","background":"#0e1a3a","surface":"#16264f","text":"#f8f1de","textMuted":"#c8bfa7"},
    "fonts":{"heading":{"family":"Cinzel","weights":[400,600],"fallback":"serif"},"script":{"family":"Great Vibes","weights":[400],"fallback":"cursive"},"body":{"family":"Manrope","weights":[300,400,600],"fallback":"sans-serif"}},
    "hero":{"variant":"classic","backgroundImage":"","overlayColor":"#050b1d","overlayOpacity":0.35},
    "couple":{"photoFallback":"hide"},
    "sections":{"hero":{"background":{"type":"color","value":"#16264f"},"ornamentTop":"","ornamentBottom":""},"quote":{"background":{"type":"color","value":"#0e1a3a"},"ornamentTop":"","ornamentBottom":""},"couple":{"background":{"type":"color","value":"#16264f"},"ornamentTop":"","ornamentBottom":""},"event":{"background":{"type":"color","value":"#0e1a3a"},"ornamentTop":"","ornamentBottom":""},"love-story":{"background":{"type":"color","value":"#16264f"},"ornamentTop":"","ornamentBottom":""},"gallery":{"background":{"type":"color","value":"#0e1a3a"},"ornamentTop":"","ornamentBottom":""},"gift":{"background":{"type":"color","value":"#16264f"},"ornamentTop":"","ornamentBottom":""},"rsvp":{"background":{"type":"color","value":"#0e1a3a"},"ornamentTop":"","ornamentBottom":""},"wishes":{"background":{"type":"color","value":"#16264f"},"ornamentTop":"","ornamentBottom":""},"footer":{"background":{"type":"color","value":"#0e1a3a"},"ornamentTop":"","ornamentBottom":""}},
    "ornaments":{"corner":"","divider":"","frame":""},
    "decor":{"borderRadius":"1rem","patternUrl":"","patternOpacity":0.08}
  }',
  'wedding-romantic-aisle.mp3'
)
ON DUPLICATE KEY UPDATE
  id = LAST_INSERT_ID(id),
  name = VALUES(name),
  componentKey = VALUES(componentKey),
  previewUrl = VALUES(previewUrl),
  thumbnailUrl = VALUES(thumbnailUrl),
  isPublished = VALUES(isPublished),
  categoryId = VALUES(categoryId),
  price = VALUES(price),
  description = VALUES(description),
  tags = VALUES(tags),
  filterGroup = VALUES(filterGroup),
  designConfig = VALUES(designConfig),
  defaultMusic = VALUES(defaultMusic);

SET @arabian_night_id = LAST_INSERT_ID();
DELETE FROM template_design_sections WHERE templateDesignId = @arabian_night_id;
INSERT INTO template_design_sections (templateDesignId, sectionId, `order`, is_enabled) VALUES
  (@arabian_night_id, @sec_hero, 1, 1),
  (@arabian_night_id, @sec_couple, 2, 1),
  (@arabian_night_id, @sec_story, 3, 1),
  (@arabian_night_id, @sec_event, 4, 1),
  (@arabian_night_id, @sec_dress, 5, 1),
  (@arabian_night_id, @sec_gallery, 6, 1),
  (@arabian_night_id, @sec_gift, 7, 1),
  (@arabian_night_id, @sec_rsvp, 8, 1),
  (@arabian_night_id, @sec_family, 9, 1),
  (@arabian_night_id, @sec_music, 10, 1);
