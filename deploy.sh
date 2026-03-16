#!/bin/bash

# Проект Горизонт - скрипт деплоя
# Использование: curl -sSL https://raw.githubusercontent.com/sanekvery/horizon-game/master/deploy.sh | bash

set -e

REPO="https://github.com/sanekvery/horizon-game.git"
DIR="horizon-game"

echo "🌆 Проект Горизонт — Деплой"
echo "=========================="

# Клонируем или обновляем
if [ -d "$DIR" ]; then
    echo "📥 Обновление..."
    cd "$DIR"
    git pull
else
    echo "📥 Клонирование..."
    git clone "$REPO"
    cd "$DIR"
fi

# Останавливаем старый контейнер
echo "🛑 Остановка старого контейнера..."
docker compose down 2>/dev/null || true

# Собираем и запускаем
echo "🔨 Сборка и запуск..."
docker compose up -d --build

# Ждём запуска
sleep 3

# Проверяем
if curl -s http://localhost:3000/api/state > /dev/null; then
    echo ""
    echo "✅ Игра запущена!"
    echo ""
    echo "📍 Локально:     http://localhost:3000"
    echo "📍 Админка:      http://localhost:3000/admin"
    echo "📍 QR-коды:      http://localhost:3000/qr"
    echo ""
    echo "🔑 Пароль админа: horizon2024"
    echo ""
else
    echo "❌ Ошибка запуска. Проверьте логи: docker compose logs"
fi
