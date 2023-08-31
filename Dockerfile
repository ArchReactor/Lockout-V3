FROM node:20-bookworm
RUN apt-get update && apt-get -y install pipx && pipx ensurepath && pipx install esphome
WORKDIR /app
COPY . /app
RUN npm install
ENTRYPOINT ["node", "index.js"]
