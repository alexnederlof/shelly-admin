FROM node:lts-slim as builder
WORKDIR /app/
ADD tsconfig.json /app/
ADD package.json /app/
ADD yarn.lock /app/

RUN yarn

ADD src /app/src
ADD shellies.d.ts /app
RUN yarn build

RUN rm -rf node_modules
RUN yarn install --prod

FROM node:lts-slim as runner
USER 1000
WORKDIR /app/

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/dist/ /app/

CMD ["node", "index.js"]
