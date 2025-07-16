#The base image
FROM node:22.17.0-bullseye AS base
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml .swcrc /usr/src/app/
COPY src /usr/src/app/src

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

#The prod image
FROM node:22.17.0-bullseye-slim
USER node
WORKDIR /usr/src/app
COPY --chown=node:node --from=base /usr/bin/dumb-init /usr/bin/dumb-init
COPY --chown=node:node --from=prod-deps /usr/src/app/node_modules /usr/src/app/node_modules
COPY --chown=node:node --from=build /usr/src/app/dist /usr/src/app/dist
CMD ["dumb-init", "node", "dist/server.js"]