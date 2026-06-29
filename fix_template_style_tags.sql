-- Template Style Tags Patch
-- Assigns visual style tags (Minimalis, Rustic, Elegan, Floral) to each template.
-- Idempotent: safe to re-run.
-- Run: mysql satu_undangan_local < fix_template_style_tags.sql

SET FOREIGN_KEY_CHECKS = 0;

UPDATE `template_designs` SET `tags` = '["elegant","dark","gold","Elegan"]' WHERE `slug` = 'dark-elegant';
UPDATE `template_designs` SET `tags` = '["clean","modern","white","Minimalis"]' WHERE `slug` = 'light-modern';
UPDATE `template_designs` SET `tags` = '["floral","watercolor","romantic","Rustic","Floral"]' WHERE `slug` = 'botanical-watercolor';
UPDATE `template_designs` SET `tags` = '["royal","gold","heritage","Elegan"]' WHERE `slug` = 'royal-gold';
UPDATE `template_designs` SET `tags` = '["boho","minimalist","earthy","Minimalis","Rustic"]' WHERE `slug` = 'minimalist-terra';
UPDATE `template_designs` SET `tags` = '["celestial","dreamy","night","Elegan"]' WHERE `slug` = 'celestial-sparkle';
UPDATE `template_designs` SET `tags` = '["editorial","magazine","fashion","Minimalis"]' WHERE `slug` = 'editorial-magazine';
UPDATE `template_designs` SET `tags` = '["retro","8bit","pixel","gaming","Retro"]' WHERE `slug` = 'pixel-quest';
UPDATE `template_designs` SET `tags` = '["retro","vintage","scrapbook","Retro"]' WHERE `slug` = 'retro-nostalgia';
UPDATE `template_designs` SET `tags` = '["noir","dark","cinematic","Minimalis"]' WHERE `slug` = 'modern-noir';
UPDATE `template_designs` SET `tags` = '["beach","blue","summer","Minimalis"]' WHERE `slug` = 'azure-shores';
UPDATE `template_designs` SET `tags` = '["cyberpunk","neon","future","Retro"]' WHERE `slug` = 'cyberpunk-neon';
UPDATE `template_designs` SET `tags` = '["royal","emerald","green","Elegan"]' WHERE `slug` = 'royal-emerald';
UPDATE `template_designs` SET `tags` = '["sakura","floral","pink","Floral"]' WHERE `slug` = 'sakura-blossom';
UPDATE `template_designs` SET `tags` = '["celestial","twilight","anime","comet","romantic","Elegan"]' WHERE `slug` = 'kimi-no-na-wa';

SET FOREIGN_KEY_CHECKS = 1;
