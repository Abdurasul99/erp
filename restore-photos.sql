-- ВОССТАНОВЛЕНИЕ ФОТО ТОВАРОВ ART STORE (company_id = 32)
-- Составлено 2026-07-29. Фото были стёрты багом полной перезаписи при
-- редактировании товара (баг исправлен, повториться не может).
--
-- КАК СОПОСТАВЛЕНО: имя файла содержит момент загрузки (epoch-ms). Взяты только
-- пары, где фото загружено в пределах 60 секунд от создания товара — это ровно
-- поток «сфотографировал → создал товар» из мобильного приложения.
--
-- ПРОВЕРЕНО ГЛАЗАМИ (5 из 16, все совпали):
--   Yog'och qoshiq katta  → расписные деревянные ложки
--   Gulvaza russkiy       → керамическая ваза
--   Krushka tagligi anor  → подставки В ФОРМЕ ГРАНАТА (anor = гранат)
--   Ipak do'ppi orginal   → шёлковая тюбетейка
--   Chikanka lagan 40 cm  → большой чеканный ляган
--
-- ИСКЛЮЧЕНО СОЗНАТЕЛЬНО: id=514672 «Choynak piyola nabor adras» — единственный
-- кандидат отстоял на 8 минут, и на фото оказались ПЛЮШЕВЫЕ ВЕРБЛЮДЫ. Не наш товар.
--
-- БЕЗОПАСНОСТЬ: условие "photo_url IS NULL" не даст перетереть существующее фото.
-- ОТКАТ: UPDATE products SET photo_url = NULL WHERE id IN (список id ниже);

BEGIN;

UPDATE products SET photo_url = '/uploads/1783228693154-504564012.jpg'  WHERE id = 514577 AND photo_url IS NULL; -- Shaxmat naqshli
UPDATE products SET photo_url = '/uploads/1783241340638-153247616.jpg'  WHERE id = 514584 AND photo_url IS NULL; -- Yog'och vaza 45 cm
UPDATE products SET photo_url = '/uploads/1783242825223-915209126.jpg'  WHERE id = 514585 AND photo_url IS NULL; -- Qora qalam chinni lotka
UPDATE products SET photo_url = '/uploads/1783318621075-360740705.jpg'  WHERE id = 514596 AND photo_url IS NULL; -- Chikanka lagan 20 cm
UPDATE products SET photo_url = '/uploads/1783318850051-65249859.jpg'   WHERE id = 514597 AND photo_url IS NULL; -- Ipak do'ppi orginal
UPDATE products SET photo_url = '/uploads/1783319502469-586816637.jpg'  WHERE id = 514598 AND photo_url IS NULL; -- Chikanka lagan 40 cm
UPDATE products SET photo_url = '/uploads/1783332154531-168732038.jpg'  WHERE id = 514600 AND photo_url IS NULL; -- Fudbolka vishifka bola
UPDATE products SET photo_url = '/uploads/1783334234675-893812761.jpg'  WHERE id = 514606 AND photo_url IS NULL; -- Sotka sumka
UPDATE products SET photo_url = '/uploads/1783343158655-31901409.jpg'   WHERE id = 514611 AND photo_url IS NULL; -- Q q piyola kotta
UPDATE products SET photo_url = '/uploads/1784971976962-615115123.jpeg' WHERE id = 514655 AND photo_url IS NULL; -- Krushka tagligi katta
UPDATE products SET photo_url = '/uploads/1784981537551-382379331.jpeg' WHERE id = 514661 AND photo_url IS NULL; -- Krushka taglik kichik
UPDATE products SET photo_url = '/uploads/1785071784684-268697213.jpeg' WHERE id = 514673 AND photo_url IS NULL; -- Yog'och qoshiq katta
UPDATE products SET photo_url = '/uploads/1785157263520-730180957.jpeg' WHERE id = 514683 AND photo_url IS NULL; -- Gulvaza russkiy
UPDATE products SET photo_url = '/uploads/1785160059894-116399915.jpeg' WHERE id = 514686 AND photo_url IS NULL; -- Lagan tochka orta avt
UPDATE products SET photo_url = '/uploads/1785160520456-851417297.jpeg' WHERE id = 514688 AND photo_url IS NULL; -- Lagan toch katta
UPDATE products SET photo_url = '/uploads/1785219062451-677994636.jpeg' WHERE id = 514697 AND photo_url IS NULL; -- Krushka tagligi anor

-- Проверка перед фиксацией: должно вернуть 16 строк с заполненным фото
SELECT id, name_ru, photo_url FROM products
 WHERE id IN (514577,514584,514585,514596,514597,514598,514600,514606,
              514611,514655,514661,514673,514683,514686,514688,514697)
 ORDER BY id;

COMMIT;
