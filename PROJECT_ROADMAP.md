# Equality Chat Platform - Roadmap (IA-First)

## Objetivo
Transformar o sistema atual em plataforma completa de atendimento/monitoramento com operação 100% IA e widget gerado pelo próprio painel.

## Fase 1 (em execução)
- [x] Endpoint de widget dinâmico por bot (`/widget/:botId.js`)
- [x] Configurações de bot persistidas em `bot_settings`
- [x] Endpoint público de settings (`/settings?bot_id=`)
- [x] Endpoint admin para salvar settings (`/admin/bot-settings/:botId`)
- [x] Endpoint admin para gerar snippet (`/admin/widget-snippet/:botId`)
- [ ] Painel Mestre consumindo settings reais e botão "Gerar Script"

## Fase 2
- [ ] Mensageria IA unificada (`/chat/message`) com logs completos
- [ ] Histórico de conversa em tabelas dedicadas (`chat_sessions`, `chat_messages`)
- [ ] Fallback para ticket automático
- [ ] Relatórios básicos (volume, latência, resolução)

## Fase 3
- [ ] Base de conhecimento + busca
- [ ] Segmentação e automações de marketing
- [ ] API pública para integrações
- [ ] Hardening final (RBAC, auditoria, backups + restore test)

## Critério de sucesso
- Widget e comportamento configuráveis 100% pelo painel
- Atendimento em produção 100% IA com métricas e histórico confiáveis
- Deploy reproduzível e versionado
