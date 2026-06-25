# Hotel SaaS Platform — структура на проекта (v0.1)

Работна карта „как го виждаме“ на база попълнения въпросник. За обсъждане и итерация.

## 0. Водещи принципи
- **Composable, не монолит:** всеки продукт е самостоятелен и продаваем сам, но се свързва с останалите през публикуван договор.
- **Каналният мениджър е първи** (демо + първа продажба). Лек, фокусиран, без Booking Engine/фолио/счетоводство.
- **Двупосочна съвместимост:** CM работи и с чужди PMS/CRS; резервационната система работи и с чужди CM.
- **Директни OTA връзки** зад адаптерна абстракция (без агрегатор), демо през OTA sandbox.
- **API-first, multi-tenant** (споделена база + Row-Level Security), наличността е единственият източник на истина.
- **EN + BG** от старта, международно с пилот в България.

## 1. Продуктова екосистема
```
Hotel SaaS Platform
│
├─ ПРОДУКТ 1 · Channel Manager (CM)        ← демо / първи за продажба · самостоятелен
│     свързва се с: наши + ЧУЖДИ PMS/CRS · всички OTA канали
│
├─ ПРОДУКТ 2 · Reservation System / CRS    ← фаза 2 · самостоятелен
│     ├─ Booking Engine (директни резервации + плащания)
│     ├─ Folio (сметка на гост)
│     └─ свързва се с: наши + ЧУЖДИ Channel Managers
│
├─ ПРОДУКТ 3 · PMS (operations)            ← фаза 3 · самостоятелен
│     ├─ Front desk · check-in/out · профили
│     ├─ Housekeeping (+ мобилен/PWA достъп)
│     └─ Поддръжка · минибар → фолио
│
└─ ОБЩА ОСНОВА (под трите продукта)
      ├─ Core Domain ........ Properties · Rooms/Units · Rate Plans · Inventory · Reservations · Guests
      ├─ Connectivity ....... OTA адаптери (Booking, Expedia, Trip.com, Airbnb, Hotelbeds, HRS, WebBeds)
      ├─ Sync Engine ........ опашка · retry · реконсилиация · realtime + 15–30 мин пълен синхрон
      ├─ Identity & RBAC .... роли · scopes · multi-tenant изолация
      ├─ Integration Contract  вътрешен API + webhooks (готов за публично API към чужди PMS/CM)
      └─ Platform ........... одит лог · бекъпи/репликация · мониторинг · нотификации
```

## 2. Channel Manager — MVP (демо продукт)
Екраните от въпросника + ядрата, които ги захранват.
```
Channel Manager (MVP)
├─ Dashboard
│   ├─ Продукция по канал (ден / седмица / месец / тримесечие)
│   ├─ Резервации (последни)
│   ├─ Приходи по канал
│   ├─ Статус на синхронизациите
│   └─ Известия и предупреждения
├─ Products & Inventory
│   ├─ Типове/категории помещения
│   ├─ Капацитет (възрастни, деца, доп. легла)
│   ├─ Тарифни планове (произволни имена/тагове)
│   ├─ Политики за анулация и плащане
│   ├─ Хранене и включени услуги
│   └─ Свързване стаи ↔ тарифи
├─ Calendar
│   ├─ Наличности
│   ├─ Цени
│   ├─ Ограничения (Min/Max LOS, CTA, CTD, Stop-Sell, Advance Purchase)
│   └─ Масови редакции
├─ Channel Management
│   ├─ Активиране/деактивиране на канали
│   ├─ Връзки с OTA партньори
│   ├─ Статус на интеграциите
│   └─ Диагностика на връзките
├─ Channel Mapping            (self-service за хотела)
│   ├─ Мапинг на стаи
│   ├─ Мапинг на тарифни планове
│   └─ Проверка за липсващи/невалидни мапинги
├─ Reservations
│   ├─ Всички резервации от каналите
│   ├─ Филтри и търсене
│   └─ История на промените
├─ Sync & Activity Logs
│   ├─ История на синхронизациите (успех/неуспех)
│   └─ Одит лог на потребителските действия
├─ Reports
│   ├─ Резервации по канал
│   ├─ Приходи по канал
│   └─ Представяне на каналите
└─ Settings
    ├─ Настройки на хотела
    ├─ Потребители и роли
    ├─ OTA интеграции
    └─ API и системни настройки

   ── НЕВИДИМИ ЯДРА (захранват екраните) ──
   • Rate Derivation Engine — формули/зависимости между тарифи (±%, ±сума) и по настаняване
   • Restriction Engine — Min/Max LOS, CTA/CTD, Advance Purchase
   • Reservation Ingestion — приема резервации дори при 0 наличност, маркира конфликт
   • Overbooking Guard — транзакционна наличност + реконсилиация + аларми
```

## 3. Модел на наличност (гъвкавост по тип имот)
```
Property
├─ Хотел / Апартамент   → Room Category → N × Unit        (наличност на ниво категория помещение)
└─ Хостел               → Dorm/Room    → Bed inventory     (наличност на ниво легло)
        ↑ обща абстракция „Sellable Unit“ — хостелите не са bolt-on
```

## 4. Connectivity (адаптерен модел)
```
CM/Core  →  Connectivity Abstraction (единен модел: ARI push · reservation pull · mapping)
                 ├─ BookingAdapter
                 ├─ ExpediaAdapter
                 ├─ TripAdapter
                 ├─ AirbnbAdapter
                 ├─ HotelbedsAdapter
                 ├─ HRSAdapter
                 └─ WebBedsAdapter
   Демо: срещу sandbox/test акаунти. Продукция: след сертификация, канал по канал.
```

## 5. Reservation System / CRS — фаза 2
```
├─ Booking Engine (директни резервации, цени, наличности от ядрото)
├─ Плащания (Stripe / myPOS / SumUp / VivaWallet) — депозити, предплащане
├─ Folio (услуги, минибар, такси) → фактуриране
├─ Гост профили
├─ Отчети: заетост · RevPAR · Revenue · ADR · разходи · add-ons
├─ Импорт от стара система (onboarding)
└─ Конектор към ЧУЖДИ Channel Managers
```

## 6. PMS — фаза 3
```
├─ Front desk: check-in/out, профили, плащания, сметки
├─ Housekeeping: статуси (Clean/Dirty/Occupied/OOO), задачи, supervisor проверки, мобилен/PWA
├─ Минибар/доставки → начисления към фолио
├─ Поддръжка/задачи (базово)
└─ Интеграции с физически системи (брави) — по тип на хотела
```

## 7. Кодова база (предложен monorepo)
```
hotel-saas-platform/
├─ apps/
│   ├─ channel-manager-web/      (React + TS — десктоп + мобилен)
│   ├─ reservation-web/
│   └─ pms-web/                  (вкл. мобилен/PWA за хаускийпинг)
├─ services/
│   ├─ core/                     (domain: inventory, rates, reservations)
│   ├─ connectivity/             (OTA адаптери)
│   ├─ sync-engine/              (опашки, cron, реконсилиация)
│   ├─ identity/                 (auth, RBAC, tenancy)
│   └─ api-gateway/              (вътрешен API + webhooks)
├─ packages/                     (споделени типове, договор за интеграция, UI kit)
├─ db/                           (схема, миграции, RLS политики)
└─ docs/                         (този проект)
```

## 8. Роли (RBAC)
```
Super-admin (оператор)   достъп до много хотели, договори, billing, токени, мониторинг
Hotel owner              пълен достъп в рамките на своя хотел
Manager                  операции + персонал; чувствителни действия с лог
Receptionist             резервации, настаняване, плащания, сметки
Housekeeping             статуси на стаи, минибар (мобилен достъп)
Accountant               фактури, плащания, финансови отчети
```
Чувствителни действия (цени, refund, права) → ролево ограничени + одитен лог. Без многостепенен approval за v1.

## 9. Фазиране
```
Фаза 0  Основа: tenancy + RLS, auth, RBAC, core inventory скелет
Фаза 1  Inventory core: категории/units/легла, тарифи + Rate Derivation, ограничения
Фаза 2  CM: connectivity абстракция + 1–2 канала (sandbox), мапинг, push/pull
Фаза 3  Демо UI: Dashboard + Calendar + Mapping + Sync status  →  затваряне на клиенти
Фаза 4  Останали канали (продукция, канал по канал) + надеждност
Фаза 5  Reservation System / CRS (Booking Engine, плащания, фолио, отчети)
Фаза 6  PMS (front desk, housekeeping мобилен, минибар)
```
