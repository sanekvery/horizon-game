FROM node:20-alpine

WORKDIR /app

# Копируем package.json
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Устанавливаем зависимости
RUN npm install
RUN npm install --prefix client
RUN npm install --prefix server

# Копируем исходники
COPY . .

# Собираем клиент и сервер
RUN npm run build

# Порт
EXPOSE 3000

# Запуск
CMD ["npm", "run", "start"]
