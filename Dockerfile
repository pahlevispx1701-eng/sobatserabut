FROM node:20-alpine

# Direktori kerja aplikasi
WORKDIR /app

# Copy dependency definition
COPY package*.json ./
RUN npm install --omit=dev

COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# Copy seluruh source code proyek
COPY . .

# Pastikan direktori database, upload, dan logs ada dan dapat ditulis oleh user non-root (HF UID 1000)
RUN mkdir -p /app/backend/data /app/backend/uploads /app/logs && \
    chown -R 1000:1000 /app

# Gunakan non-root user (keperluan Hugging Face Spaces & security best-practice)
USER 1000

# Port default: 7860 untuk Hugging Face Spaces (dapat di-override oleh platform lain)
ENV PORT=7860 \
    NODE_ENV=production

EXPOSE 7860

# Jalankan aplikasi terpadu
CMD ["node", "app.js"]
