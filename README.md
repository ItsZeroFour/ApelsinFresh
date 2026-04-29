# Ларкинс · Apelsin Fresh

Голосовой ассистент для Q&A на питче. Пользователь зажимает кнопку, говорит вопрос — Ларкинс отвечает голосом.

**Стек:**
- **Фронт:** React + Vite
- **Бэк:** Node.js Express (`type: module`)
- **STT:** Groq Whisper (whisper-large-v3-turbo)
- **LLM:** Groq Llama 3.3 70B
- **TTS:** ElevenLabs (eleven_flash_v2_5)

---

## Запуск

### 1. Сервер

```bash
cd server
cp .env.example .env
# открой .env и подставь свои ключи (Groq, ElevenLabs, voice_id)
npm install
npm run dev
```

Сервер слушает на `http://localhost:3001`.

### 2. Клиент (новый терминал)

```bash
cd client
npm install
npm run dev
```

Открой `http://localhost:5173` на телефоне или в DevTools Mobile View.

> ⚠️ Микрофон работает только в HTTPS или на `localhost`. Для теста на телефоне с другого устройства — поставь `mkcert` или используй `vite --host` + ngrok.

---

## Структура

```
larkins/
├─ server/
│  ├─ knowledge.json           ← база знаний — главное что тебе нужно отредактировать
│  ├─ .env                     ← ключи (gitignore!)
│  └─ src/
│     ├─ index.js              ← Express setup
│     ├─ prompt.js             ← system prompt Ларкинса (тон, ограничения)
│     ├─ services/
│     │  ├─ groq.js            ← LLM streaming + Whisper
│     │  ├─ elevenlabs.js      ← TTS
│     │  └─ knowledge.js       ← поиск по базе (логика из оригинального Flask)
│     └─ routes/
│        ├─ transcribe.js      ← POST /api/transcribe
│        └─ chat.js            ← POST /api/chat (SSE стрим текст+аудио)
└─ client/
   ├─ index.html               ← подключение шрифтов
   └─ src/
      ├─ App.jsx               ← логика hold-to-talk
      ├─ App.css               ← вся стилистика
      ├─ components/
      │  └─ VoiceOrb.jsx       ← морфирующий оранжевый блоб
      └─ lib/
         ├─ recorder.js        ← запись + замер уровня микрофона
         ├─ audioQueue.js      ← очередь mp3-чанков + замер уровня вывода
         └─ sse.js             ← SSE-клиент (POST + ReadableStream)
```

---

## Как редактировать знания

`server/knowledge.json` — массив объектов вида:

```json
{
  "id": 10,
  "title": "Что такое Apelsin Fresh",
  "category": "Рабочая",
  "importance": 5,
  "content": "Apelsin Fresh — это ..."
}
```

Категории взяты из оригинального Flask-проекта: **Характер / Рабочая / Клиентская**. Записи с `importance: 5` идут в начало контекста — пусть туда попадёт самое важное (что за продукт, тон голоса, бизнес-модель).

В файле есть записи с пометкой `[ЗАМЕНИ]` — это плейсхолдеры. Заполни их реальными данными про Apelsin Fresh, и Ларкинс начнёт отвечать осмысленно. Без этого он будет уходить в общие фразы и говорить «уточню у команды».

После правки `knowledge.json` — **перезапусти сервер** (база читается на старте).

---

## Что взято из оригинального Flask-проекта

| Из оригинала | Куда перенесено | Почему |
|---|---|---|
| Схема записи: `title / content / category / importance_level` | `knowledge.json` + `services/knowledge.js` | Удобная и понятная — не было смысла придумывать новую |
| Категории: «Характер / Рабочая / Клиентская» | те же | Хорошо ложатся на питч-сценарий |
| Логика `/api/v1/get-context`: substring-match + sort по importance | `getContext()` в `services/knowledge.js` | Это работающий лёгкий RAG, для маленькой базы — оптимум |
| Формат сборки контекста: `[Категория] Заголовок: содержимое` | `formatContext()` | Та же раскладка, что отдавал старый эндпоинт LLM-у |

**Что НЕ перенесено и почему:**
- Авторизация (login + extra_key + bcrypt+pepper, CSRF, IP-fingerprint) — это для админки старого проекта, в текущей задаче админки нет.
- API-ключи с sha256 и `allowed_knowledge` — это было нужно для внешних потребителей (n8n). У нас фронт+бэк свои, не нужно.
- Шифрование контента через Fernet — для голосового демо лишний слой.
- PostgreSQL — для одной таблицы знаний избыточно. JSON-файл проще править и деплоить.
- Rate limiting через БД, login/usage логи — для прототипа не нужно.

---

## Как это работает (кратко)

```
[Пользователь зажимает кнопку]
        │
        ▼
   MediaRecorder ─── webm/mp4 blob ──► POST /api/transcribe ──► Groq Whisper ──► text
        │
        ▼
[Отображаем «‹вопрос›»]
        │
        ▼
   POST /api/chat (SSE) ──► Groq Llama 3.3 stream
        │                          │
        │                          ▼
        │                    [Бэк режет токены на предложения]
        │                          │
        │                    Каждое предложение → ElevenLabs TTS
        │                          │
        ◄──── event: text (delta)  │
        ◄──── event: audio (mp3 base64) ◄──┘
        │
        ▼
[AudioQueue играет mp3 по очереди]
        │
        ▼
[Орб реагирует на громкость → пульсирует]
```

Latency до первого звука: **~0.8–1.5 сек** на коротком ответе.
