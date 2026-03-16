#!/bin/bash

# ============================================
# Проект Горизонт — Запуск игры с туннелем
# ============================================

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       🌅 ПРОЕКТ ГОРИЗОНТ — ЗАПУСК ИГРЫ        ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════╝${NC}"
echo ""

# Определяем какой туннель использовать
TUNNEL_TYPE=""

# Проверяем аргумент командной строки
if [ "$1" == "--cloudflare" ]; then
    TUNNEL_TYPE="cloudflare"
elif [ "$1" == "--ngrok" ]; then
    TUNNEL_TYPE="ngrok"
elif [ "$1" == "--localtunnel" ] || [ "$1" == "--lt" ]; then
    TUNNEL_TYPE="localtunnel"
elif [ "$1" == "--local" ]; then
    TUNNEL_TYPE="local"
else
    # По умолчанию ngrok (настроен)
    TUNNEL_TYPE="ngrok"
fi

echo -e "${BLUE}📡 Туннель: ${TUNNEL_TYPE}${NC}"

# Проверка сборки
if [ ! -d "client/dist" ] || [ ! -d "server/dist" ]; then
    echo -e "${YELLOW}📦 Сборка проекта...${NC}"
    npm run build
    echo ""
fi

# Остановка предыдущих процессов
echo -e "${BLUE}🧹 Очистка предыдущих процессов...${NC}"
pkill -f "node server/dist/index.js" 2>/dev/null || true
pkill -f "cloudflared tunnel" 2>/dev/null || true
pkill -f "ngrok" 2>/dev/null || true
sleep 1

# Запуск сервера
echo -e "${BLUE}🚀 Запуск сервера...${NC}"
NODE_ENV=production node server/dist/index.js > /tmp/horizon-server.log 2>&1 &
SERVER_PID=$!
sleep 2

# Проверка что сервер запустился
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${RED}❌ Ошибка запуска сервера!${NC}"
    cat /tmp/horizon-server.log
    exit 1
fi

echo -e "${GREEN}✅ Сервер запущен (PID: $SERVER_PID)${NC}"
echo ""

# Запуск туннеля
TUNNEL_LOG="/tmp/horizon-tunnel.log"
TUNNEL_URL=""

if [ "$TUNNEL_TYPE" == "cloudflare" ]; then
    echo -e "${BLUE}🌐 Запуск Cloudflare Tunnel...${NC}"
    cloudflared tunnel --url http://localhost:3000 > $TUNNEL_LOG 2>&1 &
    TUNNEL_PID=$!

    echo -e "${YELLOW}⏳ Ожидание публичного URL...${NC}"
    for i in {1..30}; do
        TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' $TUNNEL_LOG 2>/dev/null | head -1)
        if [ -n "$TUNNEL_URL" ]; then
            break
        fi
        sleep 1
    done
elif [ "$TUNNEL_TYPE" == "ngrok" ]; then
    echo -e "${BLUE}🌐 Запуск ngrok...${NC}"
    ngrok http 3000 --log=stdout > $TUNNEL_LOG 2>&1 &
    TUNNEL_PID=$!

    echo -e "${YELLOW}⏳ Ожидание публичного URL...${NC}"
    for i in {1..30}; do
        # Пробуем получить URL через API ngrok
        TUNNEL_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -oE 'https://[a-z0-9-]+\.ngrok[a-z.-]*' | head -1)
        if [ -n "$TUNNEL_URL" ]; then
            break
        fi
        sleep 1
    done
elif [ "$TUNNEL_TYPE" == "localtunnel" ]; then
    echo -e "${BLUE}🌐 Запуск localtunnel...${NC}"
    npx localtunnel --port 3000 > $TUNNEL_LOG 2>&1 &
    TUNNEL_PID=$!

    echo -e "${YELLOW}⏳ Ожидание публичного URL...${NC}"
    for i in {1..30}; do
        TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.loca\.lt' $TUNNEL_LOG 2>/dev/null | head -1)
        if [ -n "$TUNNEL_URL" ]; then
            break
        fi
        sleep 1
    done
else
    # Локальный режим - без туннеля
    TUNNEL_PID=""
    LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "localhost")
    TUNNEL_URL="http://${LOCAL_IP}:3000"
fi

if [ -z "$TUNNEL_URL" ] && [ "$TUNNEL_TYPE" != "local" ]; then
    echo -e "${RED}❌ Не удалось получить URL туннеля${NC}"
    echo ""
    echo "Логи туннеля:"
    cat $TUNNEL_LOG | tail -20
    echo ""
    echo -e "${YELLOW}Попробуйте запустить вручную в двух терминалах:${NC}"
    echo "  Терминал 1: npm run prod"
    echo "  Терминал 2: ngrok http 3000"
    exit 1
fi

# Проверяем доступность
echo -e "${YELLOW}⏳ Проверка доступности...${NC}"
sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$TUNNEL_URL/" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" != "200" ] && [ "$TUNNEL_TYPE" != "local" ]; then
    echo -e "${YELLOW}⚠️  Туннель отвечает кодом $HTTP_CODE, подождите несколько секунд${NC}"
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                       🎉 ИГРА ГОТОВА!                             ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}🌍 Публичный URL (для всех игроков):${NC}"
echo -e "${GREEN}   $TUNNEL_URL${NC}"
echo ""
echo -e "${CYAN}📱 Ссылки:${NC}"
echo -e "   Админка:     ${GREEN}$TUNNEL_URL/admin${NC}"
echo -e "   Карта:       ${GREEN}$TUNNEL_URL/map${NC}"
echo ""
echo -e "${YELLOW}📋 Что делать дальше:${NC}"
echo "   1. Откройте админку: $TUNNEL_URL/admin"
echo "   2. Пароль: horizon2024"
echo "   3. Перейдите «Участники» → «📱 QR-коды»"
echo "   4. Распечатайте или покажите QR-коды игрокам"
echo ""
echo -e "${BLUE}⌨️  Для остановки нажмите Ctrl+C${NC}"
echo ""

# Функция очистки при выходе
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Остановка игры...${NC}"
    kill $SERVER_PID 2>/dev/null || true
    kill $TUNNEL_PID 2>/dev/null || true
    pkill -f "cloudflared tunnel" 2>/dev/null || true
    pkill -f "ngrok" 2>/dev/null || true
    pkill -f "localtunnel" 2>/dev/null || true
    echo -e "${GREEN}✅ Игра остановлена${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Ждём завершения
if [ -n "$TUNNEL_PID" ]; then
    wait $TUNNEL_PID
else
    # Локальный режим - ждём сервер
    wait $SERVER_PID
fi
