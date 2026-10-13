# Модель размещения v1 (без Supabase)

Статус: проектирование, не внедрено в production. Ветка feature/accommodation-data-model.

## Принцип
Объект (property) → категория размещения (room_type) → физическая единица (unit) → бронирование (booking).
Филиал — отдельный property с необязательным group_id (бренд/сеть), не номер и не unit.

## Совместимость
- Существующие house_001..house_009 остаются стабильными legacy ID.
- house_004 = property «Точка Краснолесье».
- house_005 и house_006 — legacy ID категорий «Комфорт» и «Для двоих», НЕ отдельные property.
- Для A-frame создаётся отдельный room_type ID, не равный house_004; три unit с собственными ID.
- Не переназначать старые ID бронирований без миграционной таблицы соответствий.
- Остальные объекты пока представляются property с одной категорией и одной unit только после подтверждения модели размещения владельцем.

## Поля
properties: id, name, address, coordinates, contacts, amenities, description, media, group_id?, active.
room_types: id, property_id, title, capacity?, price_from?, description, amenities, media, active.
units: id, room_type_id, label, active, external_calendar_id?.
bookings: id, unit_id?, room_type_id, property_id, checkin_date, checkout_date, status, source, external_id?, created_at, updated_at.
availability_blocks: id, unit_id, checkin_date, checkout_date, reason, source, external_id?.

## Важные правила
- Даты проживания: [checkin_date, checkout_date), дата выезда не занята.
- До подтверждения физической unit бронирование считается запросом, а не гарантированным резервированием.
- Нельзя подтверждать две пересекающиеся брони одной unit.
- Обработку записи/проверки выполняет сервер n8n; localStorage не является источником истины.
- Не записывать гостевые контакты в публичный JSON или репозиторий.
- Фото и цены категории не копировать в каждую unit.
- UI строит категории по property_id динамически; без жёстких условий house_004.
- Данные каталога на первом этапе можно хранить в JSON, бронирования остаются в Google Sheets через n8n.
- При переходе в Supabase сохранять ID и API-контракты, переносить таблицы и данные отдельно.

## Следующий этап до изменения production
1. Проверить фактические категории, цены и физические единицы у «Точки Краснолесье».
2. Сопоставить старые house_id в Google Sheets/n8n с property/room_type/unit.
3. Реализовать data adapter и динамические вложенные карточки в этой ветке.
4. Провести тесты без создания реальных броней; проверить мобильную версию.
5. Только после проверки отдельно согласовать выпуск.
