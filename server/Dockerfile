FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json *.mjs ./
RUN rm -f reader.test.mjs && useradd --system --uid 10001 reader && mkdir -p /data && chown reader /data
USER reader
ENV HOST=0.0.0.0 PORT=8787 OCR_DB_PATH=/data/reader.db
EXPOSE 8787
CMD ["node", "--disable-warning=ExperimentalWarning", "index.mjs"]
