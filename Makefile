COMPOSE := docker compose -f docker-compose.dev.yml

.PHONY: dev dev-down dev-logs dev-ps \
        dev-db-push dev-db-seed dev-db-reset dev-db-studio \
        dev-shell-next dev-shell-socket dev-clean

dev:
	$(COMPOSE) up --build -d

dev-down:
	$(COMPOSE) down

dev-logs:
	$(COMPOSE) logs -f

dev-ps:
	$(COMPOSE) ps

dev-db-push:
	$(COMPOSE) exec nextjs npx prisma db push

dev-db-seed:
	$(COMPOSE) exec nextjs npx tsx prisma/seed.ts

dev-db-reset:
	$(COMPOSE) exec nextjs npx prisma db push --force-reset
	$(COMPOSE) exec nextjs npx tsx prisma/seed.ts

dev-db-studio:
	$(COMPOSE) exec nextjs npx prisma studio

dev-shell-next:
	$(COMPOSE) exec nextjs sh

dev-shell-socket:
	$(COMPOSE) exec socket-server sh

dev-clean:
	$(COMPOSE) down -v
	docker rmi $$(docker images -q 'nw-rust-based*') 2>/dev/null || true
