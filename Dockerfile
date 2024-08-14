FROM node:20-bookworm
WORKDIR /app
RUN apt-get update \
  && apt-get -y install pipx \
  && pipx ensurepath \
  && pipx install esphome \
  && pipx inject esphome pillow==10.2.0
ENV PATH="${PATH}:/root/.local/bin"
COPY . /app
RUN npm install
ENTRYPOINT ["node", "index.js"]
