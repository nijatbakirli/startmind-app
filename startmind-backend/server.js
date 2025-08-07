// server.js

// 1. Импортируем необходимые пакеты
const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Загружает переменные из файла .env

// 2. Настраиваем Express-приложение
const app = express();
const PORT = process.env.PORT || 3001; // Сервер будет работать на порту 3001

// 3. Подключаем middleware
app.use(cors()); // Разрешаем кросс-доменные запросы (чтобы фронтенд мог общаться с бэкендом)
app.use(express.json()); // Позволяем серверу принимать и отправлять данные в формате JSON

// 4. Создаем основной эндпоинт (адрес, куда будет обращаться фронтенд)
app.post('/api/generate', async (req, res) => {
    // Получаем историю сообщений и новый промпт от фронтенда
    const { history, prompt } = req.body;

    // Проверяем, есть ли у нас API-ключ в .env файле
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        // Если ключа нет, отправляем ошибку
        return res.status(500).json({ error: 'API-ключ для Gemini не найден на сервере.' });
    }

    // --- ИСПРАВЛЕНИЕ: Убрали роль "system". Инструкция будет добавлена к первому сообщению. ---
    const systemPromptText = "Ты — StartMind, опытный бизнес-аналитик и стратег. Твоя задача — помогать пользователям развивать их идеи в конкретные бизнес-документы. Когда пользователь дает тебе идею, твой первый шаг — предложить основной документ для создания (например, 'отчет по анализу рынка', 'структура бизнес-плана', 'финансовый прогноз'). Затем задавай уточняющие вопросы, чтобы шаг за шагом составить документ. Отвечай в четких, структурированных форматах, таких как списки или планы, когда это уместно. Твои ответы должны быть лаконичными и по делу. Общайся на русском языке.";

    // Конвертируем историю с фронтенда в формат, понятный для Gemini
    const mappedHistory = history.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
    }));

    // Формируем текущее сообщение от пользователя
    const currentUserMessage = { role: 'user', parts: [{ text: prompt }] };

    // Если это самый первый запрос в диалоге, добавляем системную инструкцию к нему
    if (mappedHistory.length === 0) {
        currentUserMessage.parts[0].text = `${systemPromptText}\n\nЗАДАЧА ПОЛЬЗОВАТЕЛЯ: ${prompt}`;
    }

    // Собираем финальную историю для отправки
    const chatHistory = [
        ...mappedHistory,
        currentUserMessage
    ];

    try {
        // --- Вызов Gemini API ---
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: chatHistory })
        });

        if (!response.ok) {
            const errorData = await response.json();
            // Выводим в консоль сервера подробную ошибку от Gemini
            console.error('Ошибка от Gemini API:', errorData);
            // Отправляем на фронтенд общее сообщение об ошибке
            throw new Error(`API запрос завершился с ошибкой: ${response.status}`);
        }

        const data = await response.json();

        // Извлекаем сгенерированный текст из ответа
        const generatedText = data.candidates[0].content.parts[0].text;

        // Отправляем успешный ответ обратно нашему фронтенду
        res.json({ reply: generatedText });

    } catch (error) {
        console.error('Ошибка при вызове Gemini API:', error);
        res.status(500).json({ error: 'Не удалось сгенерировать ответ от ИИ.' });
    }
});

// 5. Запускаем сервер
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});
