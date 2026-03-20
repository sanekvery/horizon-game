FROM node:20-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Копируем package.json
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Копируем Prisma схему для генерации клиента
COPY server/prisma ./server/prisma/

# Устанавливаем зависимости
RUN npm install
RUN npm install --prefix client
RUN npm install --prefix server

# Копируем исходники
COPY . .

# Собираем клиент и сервер (включая Prisma generate)
RUN npm run build

# Порт
EXPOSE 3000

# Запуск с миграциями
CMD ["sh", "-c", "cd server && npx prisma migrate deploy && cd .. && npm run start"]
