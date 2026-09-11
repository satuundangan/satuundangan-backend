-- Add the config-driven Manuk Dadali template.
-- The artwork is an original abstract Sunda-inspired illustration.

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
  'Manuk Dadali',
  'manuk-dadali',
  'dynamic-theme',
  'https://dev.satuundangan.id/demo/manuk-dadali',
  'https://cdn.satuundangan.id/templates/manuk-dadali-cover.svg',
  1,
  @cat_exclusive,
  239000.00,
  'Hijau leuweung, cokelat kayu, dan emas hangat dalam nuansa Sunda yang anggun.',
  '["sunda","manuk-dadali","budaya","tradisional","hijau"]',
  'Bold & Unik',
  '{
    "version":1,
    "colors":{"primary":"#1f5f4a","secondary":"#6b4226","accent":"#d5a441","background":"#f3efe3","surface":"#fbfaf4","text":"#1d2f28","textMuted":"#69766b"},
    "fonts":{"heading":{"family":"Marcellus","weights":[400,600],"fallback":"serif"},"script":{"family":"Parisienne","weights":[400],"fallback":"cursive"},"body":{"family":"Karla","weights":[300,400,600],"fallback":"sans-serif"}},
    "hero":{"variant":"framed","backgroundImage":"","overlayColor":"#102c22","overlayOpacity":0.3},
    "couple":{"photoFallback":"hide"},
    "sections":{"hero":{"background":{"type":"color","value":"#fbfaf4"},"ornamentTop":"","ornamentBottom":""},"quote":{"background":{"type":"color","value":"#f3efe3"},"ornamentTop":"","ornamentBottom":""},"couple":{"background":{"type":"color","value":"#fbfaf4"},"ornamentTop":"","ornamentBottom":""},"event":{"background":{"type":"color","value":"#f3efe3"},"ornamentTop":"","ornamentBottom":""},"love-story":{"background":{"type":"color","value":"#fbfaf4"},"ornamentTop":"","ornamentBottom":""},"gallery":{"background":{"type":"color","value":"#f3efe3"},"ornamentTop":"","ornamentBottom":""},"gift":{"background":{"type":"color","value":"#fbfaf4"},"ornamentTop":"","ornamentBottom":""},"rsvp":{"background":{"type":"color","value":"#f3efe3"},"ornamentTop":"","ornamentBottom":""},"wishes":{"background":{"type":"color","value":"#fbfaf4"},"ornamentTop":"","ornamentBottom":""},"footer":{"background":{"type":"color","value":"#f3efe3"},"ornamentTop":"","ornamentBottom":""}},
    "ornaments":{"corner":"","divider":"","frame":""},
    "decor":{"borderRadius":"0.75rem","patternUrl":"","patternOpacity":0.08}
  }',
  'https://cdn.satuundangan.id/1779017731211-Manuk Dadali (Trap Remix)  Prod. Marcel NTX - Indonesian Trap Beat.mp3'
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

SET @manuk_dadali_id = LAST_INSERT_ID();
DELETE FROM template_design_sections WHERE templateDesignId = @manuk_dadali_id;
INSERT INTO template_design_sections (templateDesignId, sectionId, `order`, is_enabled) VALUES
  (@manuk_dadali_id, @sec_hero, 1, 1),
  (@manuk_dadali_id, @sec_couple, 2, 1),
  (@manuk_dadali_id, @sec_story, 3, 1),
  (@manuk_dadali_id, @sec_event, 4, 1),
  (@manuk_dadali_id, @sec_dress, 5, 1),
  (@manuk_dadali_id, @sec_gallery, 6, 1),
  (@manuk_dadali_id, @sec_gift, 7, 1),
  (@manuk_dadali_id, @sec_rsvp, 8, 1),
  (@manuk_dadali_id, @sec_family, 9, 1),
  (@manuk_dadali_id, @sec_music, 10, 1);
