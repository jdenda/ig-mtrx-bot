FROM node:latest
LABEL org.opencontainers.image.source="https://github.com/jdenda/ig-mtrx-bot"

RUN mkdir /home/node/ig-mtrx-bot
COPY . /home/node/ig-mtrx-bot
WORKDIR /home/node/ig-mtrx-bot

RUN npm install 
RUN mkdir -p /home/node/ig-mtrx-bot/images
RUN chown -R node:node /home/node/ig-mtrx-bot/

CMD [ "npm","run","start" ]