# King Detailing — Admin setup (Supabase)

Бэкенд: **Supabase** (бесплатно, без карты).
Админ: **ludmilgutsull@gmail.com**

---

## 1. Создать Supabase проект

1. Идите на https://supabase.com → Start your project → войдите через GitHub (или email)
2. **New project**:
   - Name: `king-detailing`
   - Database password: придумайте крепкий, **сохраните** (пригодится)
   - Region: **West EU (Ireland)** или **Central EU (Frankfurt)**
   - Plan: Free
3. Подождите ~2 минуты, пока поднимется

## 2. Получить ключи

Project Settings (шестерёнка слева внизу) → **API**

Скопируйте:
- **Project URL** (вид: `https://xxxxxxxx.supabase.co`)
- **anon public** key (длинный JWT, начинается с `eyJ...`)

Откройте [assets/js/supabase-init.js](assets/js/supabase-init.js) и вставьте их:

```js
export const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
export const SUPABASE_ANON_KEY = "eyJ...весь_ключ...";
```

> `anon` ключ публичный — его можно коммитить в git, безопасность держится на RLS-политиках.

## 3. Создать таблицы и политики

Dashboard → **SQL Editor** → **New query** → вставьте всё содержимое [supabase-schema.sql](supabase-schema.sql) → **Run**.

Должно написать "Success. No rows returned".

## 4. Создать Storage bucket

Dashboard → **Storage** → **New bucket**
- Name: `gallery`
- **Public bucket: ON** (чекбокс включить)
- Создать

> Политики на bucket уже созданы SQL-скриптом из шага 3.

## 5. Создать админ-пользователя

Dashboard → **Authentication** → **Users** → **Add user** → **Create new user**
- Email: `ludmilgutsull@gmail.com`
- Password: придумайте
- **Auto Confirm User: ON**
- Create

## 6. Настроить домены (Auth)

Dashboard → **Authentication** → **URL Configuration** → **Site URL**:
- `https://king-detailing.it.com`

В **Redirect URLs** добавьте:
- `https://king-detailing.it.com/**`
- `http://localhost:*/**` (на время разработки)

## 7. Готово

1. Запушьте репо в GitHub Pages
2. Откройте `https://king-detailing.it.com/admin.html`
3. Войдите → добавьте первое фото в Gallery → проверьте на главной

---

## Что в админке

- **Gallery** — добавить/удалить/переименовать работы. Фото грузятся в Supabase Storage
- **Comments** — модерация. Pending → Approve → коммент виден на сайте
- **Services** — редактор тарифов (живёт в БД, на главной пока хардкод; скажите мне — подключу)
- **Requests** — все заявки с формы бронирования. Статусы: new → contacted → done

## Если что-то не работает

- **Не пускает в админку** → проверьте email юзера в Supabase Auth, должен быть ровно `ludmilgutsull@gmail.com`
- **Галерея пустая, фото не грузится** → проверьте, что bucket `gallery` создан как **Public**
- **"row-level security policy violation"** → SQL-скрипт не прогнан или прогнан с ошибкой; запустите ещё раз

---

## Файлы проекта

- `admin.html` — админка
- `assets/js/supabase-init.js` — инициализация (вставьте сюда URL+key)
- `assets/js/site-supabase.js` — публичная часть (галерея, комменты, заявки)
- `assets/js/admin.js` — логика админки
- `assets/css/admin.css` — стили админки
- `supabase-schema.sql` — схема БД и RLS
