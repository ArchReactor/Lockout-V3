FROM node:16
RUN apt-get update && apt-get install docker.io -y
WORKDIR /app
COPY . /app
RUN npm install
ENTRYPOINT ["node", "index.js"]
