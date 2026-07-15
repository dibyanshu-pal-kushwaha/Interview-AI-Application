# Development stage
FROM node:20-alpine AS development

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate

CMD ["npm", "run", "dev"]

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY --from=development /app/prisma ./prisma
COPY --from=development /app/src ./src
COPY --from=development /app/tsconfig.json ./

RUN npm install typescript -g
RUN npm run build
RUN npx prisma generate

ENV NODE_ENV=production

EXPOSE 4000

CMD ["npm", "start"]
