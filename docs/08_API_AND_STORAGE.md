# 08. API-контракты и хранение

> Статус: проектные материалы. Фактический запуск и результаты текущей реализации см. в [README](../README.md), [ACCEPTANCE](ACCEPTANCE.md), [FORMULAS](FORMULAS.md) и [DEMO_API](DEMO_API.md). Непроверенные положения ниже не являются заявлением о готовности.

Основание: [S-FINAL §15, §§8–11, 13](SOURCES.md).

## 1. Статус контрактов

Маршруты S-FINAL **ориентировочные**, не список проверенных endpoints. Ниже — контракт для согласования до параллельной разработки. Фактические URL, payloads, auth и status codes должны быть сверены с router/types/schema конкретного commit. Не считать этот документ автоматически сгенерированным API reference.

Машиночитаемый schema ответа LLM: [recommendation.schema.json](contracts/recommendation.schema.json). HTTP-контракт приложения и контракт модели — разные уровни.

## 2. Endpoints

| Метод и маршрут | Scope | Назначение и обязательное поведение |
|---|---|---|
| `GET /api/session` | Текущая session | Identity, роли, разрешённый scope, demo workspace. |
| `GET /api/employees/:id/profile` | Свой/разрешённый профиль | Current role/grade, baseline/effective skills, provenance, история. |
| `PUT /api/employees/:id/goal` | Сотрудник в разрешённом scope | Новая версия цели/плана; история сохраняется. |
| `GET /api/employees/:id/roadmap` | Разрешённый профиль | Milestones, available/planned/blocked, остаточные gaps. |
| `POST /api/employees/:id/recommendations` | Разрешённый профиль | Версии, 1–3 рекомендации либо empty state; mode и evidence. |
| `POST /api/employees/:id/preview` | Разрешённый профиль | Before/after без мутации. |
| `POST /api/completions` | Допустимый сценарий подтверждения | Idempotency, participation/session identity, gain, audit. |
| `GET /api/side-quests` | Scope роли | Очередь/заявки, не чужие данные. |
| `POST /api/side-quests` | Автор | Создание предложения. |
| `POST /api/side-quests/:id/review` | Назначенный reviewer | Proposal decision и причина, без gain. |
| `POST /api/side-quests/:id/evidence` | Автор | Подача доказательств в допустимом состоянии. |
| `POST /api/side-quests/:id/accept` | Уполномоченный advisor | Accepted + один credit, не self-approval. |
| `GET/POST /api/manager/resource-requests` | Своя команда | Запрос и решение по ресурсу. |
| `GET/POST /api/supervisor/escalations` | Разрешённые кейсы | Новое правило/спор, решение и audit. |
| `POST /api/import/preview` | HR / demo evaluator | Проверки без записи. |
| `POST /api/import/commit` | HR / demo evaluator | Подтверждённый атомарный пакет, recompute/versioning. |
| `GET /api/hr/analytics` | HR scope | Метрики с периодом, датой, numerator/denominator. |
| `GET /api/rewards` | Разрешённый каталог/свой баланс | Политика, доступность и причины ограничений. |
| `POST /api/rewards/:id/redeem` | Свой счёт | Atomic debit при достаточном балансе. |
| `POST /api/demo/reset` | Только demo workspace | Безопасный scoped reset. |
| `GET /health` | По политике deployment | Состояние приложения без секретов. |

Операции планирования, помощи, назначения advisor и изменения каталога нужны UI/workflow, но полный список их маршрутов не задан в S-FINAL. Его обязан дополнить владелец actual API, а не клиент должен угадывать URL.

## 3. Общий envelope и версии

S-FINAL задаёт поля ошибки:

```json
{
  "code": "машиночитаемый код",
  "user_message": "безопасное объяснение",
  "retryable": false,
  "request_id": "идентификатор запроса"
}
```

Не включать ключи, credentials, stack traces и полные персональные payloads в пользовательскую ошибку. Для import preview ошибки дополнительно привязываются к строке, полю и записи.

Рекомендуемая схема уточнения S-DESIGN: успешная мутация возвращает object ID, новую state version и признак повторного запроса. Конкурентная модификация с устаревшей version получает явный conflict, а не скрытый overwrite. Конкретные имена полей/status codes фиксируются по реализации.

## 4. Пример completion-контракта — проектный

```text
POST /api/completions
Idempotency-Key: doc-example-request-001
```

```json
{
  "employee_id": "DOC_EMPLOYEE_001",
  "event_id": "ID_ИЗ_ФАКТИЧЕСКОГО_КАТАЛОГА",
  "participation_id": "ID_ТЕКУЩЕГО_УЧАСТИЯ",
  "completed_at": "ДОПУСТИМОЕ_ДОМЕННОЕ_ВРЕМЯ",
  "expected_version": "ТЕКУЩАЯ_ВЕРСИЯ"
}
```

Это поясняющий шаблон, **не готовый запрос к уже работающему API**. Название HTTP header, форма completed_at и expected_version — уточнение документации, требующее принятия в коде. Сервер не доверяет employee_id сверх session scope. Для EV_036 необходимо различать реальные session IDs/даты. Способ подтверждения выполнения в demo и production описывается отдельно.

Для idempotency связать ключ с workspace, типом операции и содержимым. Повтор того же действия возвращает старый результат; тот же ключ с другой операцией — конфликт. Исторический import no-op по record_id не равен новому пользовательскому completion.

## 5. Preview и recommendation не смешиваются

Preview возвращает simulated before/after, computed deltas, Coverage impact, новые/оставшиеся prerequisites и основание расчёта. Он не создаёт credit и не меняет effective skills.

Recommendation добавляет выбор модели, evidence, alternatives, mode и model/prompt version. Переданный клиентом projected state не становится источником eligibility: сервер пересчитывает факты из доверенных источников.

## 6. Минимальные группы сущностей

| Группа | Сущности S-FINAL | Назначение |
|---|---|---|
| Источники | source_manifest, import_batches, employee_review_baselines, skills, role_profiles, events, activity_history | Исходные версии и воспроизводимый seed. |
| Приложение | users/demo_identities, workspaces, role_assignments, advisor_assignments, goals, plans, plan_items | Identity, scope, версия цели и маршрут. |
| Согласования | side_quests, quest_rule_versions, approvals, evidence, escalation_cases | Состояния, проверяемые правила и человеческие решения. |
| Учёт | completions, skill_credits, reward_ledger, redemptions, audit_events | Однократность, отмены и provenance. |
| AI | recommendation_runs, cache, model/prompt_version, safe_usage_log | Режим, воспроизводимость контекста и техническая статистика. |

Это логические сущности, не утверждение о наличии именно таких SQL tables. ORM schema/migrations после реализации являются фактическим источником имён и типов.

## 7. Обязательные логические ограничения

| Объект | Инвариант |
|---|---|
| Source/import record | Уникальность стабильного source ID в разрешённой версии/workspace; конфликт содержимого не скрывается. |
| Review baseline | История версий не перезаписывается агрегированными skills. |
| Role profile | Однозначная пара role/grade внутри catalog version. |
| Completion | Уникальность учитываемого результата; EV_036 различает сессии. |
| Skill credit | Один источник зачёта → один активный credit по соответствующему правилу. |
| Quest rule | Gain/cap и criteria привязаны к утверждённой версии до принятия результата. |
| Reward ledger | Повтор credit/redemption не создаёт новые XP. |
| Session/scope | Workspace ограничивает чтение и мутации всех пользовательских объектов. |
| Recommendation cache | Ключ включает версии фактов, политики, даты и модели. |

Глобальный запрет нескольких historical completed для любых mandatory events нельзя вводить без сверки с исходным набором: исходная история и правило новых добровольных рекомендаций — разные проверки. Конкретная обработка исторических повторов фиксируется import policy.

## 8. Транзакционные границы

Completion и accepted: проверка → запись решения/завершения → skill/reward credits → audit → version increment. Ошибка в середине не оставляет принятый результат без связанных начислений либо наоборот.

Redemption: проверить текущий достаточный баланс и uniqueness в одной согласованной транзакции; два параллельных списания не расходуют одни и те же XP.

Import: commit подтверждённого пакета атомарен. Preview token/hash должен относиться к тем же файлам/пакету; точный механизм связи preview и commit — обязанность actual API.

Reversal: новая аудируемая запись и rebuild по активным credits. Не удалять прошлое решение и не вычитать cap-зависимый gain вручную.

## 9. Эксплуатационные контракты

Health должен позволять отличить доступность приложения от live AI. «HTTP сервер поднялся» не доказывает наличие schema, успешный seed или действующий provider.

Миграции, seed, stop/restart и reset команды неизвестны до просмотра кода. Они перечисляются в [deployment](11_DEPLOYMENT.md) и [паспорте релиза](RELEASE_MANIFEST.json), не выводятся из названия framework.
