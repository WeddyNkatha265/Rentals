FROM node:20-alpine

WORKDIR /usr/src/app

ENV VITE_API_URL=http://localhost:8000

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
