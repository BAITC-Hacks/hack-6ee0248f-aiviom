# 12. Тестирование и доказательства

Основание: [S-FINAL §20](SOURCES.md). Все application tests при подготовке комплекта имеют статус **NOT_RUN**. Таблицы ниже задают проверки и ожидаемый результат, а не протокол успешного запуска.

## 1. Уровни проверки

Domain/unit: чистые функции skills, gaps, eligibility, preview, метрик. Integration: DB, import, transactions, access, provider validation. UI/E2E: реальные role views и main flow. Live smoke: небольшой отдельный вызов реальной модели, включая новый профиль. Clean-room: полный путь из чистого clone без скрытых зависимостей.

Основные тесты используют контролируемый provider для воспроизводимых ошибок. Это не заменяет live smoke. Дорогие live calls не запускаются автоматически на каждом сохранении файла.

Фактические команды неизвестны до выбора стека и реализации. Их записывают в `commands.tests` [паспорта релиза](RELEASE_MANIFEST.json). Ни один выдуманный `npm run ...` или другой script не считается проверенной командой.

## 2. Набор T01–T20

| ID | Подготовка и действие | Ожидаемый результат |
|---|---|---|
| T01 | Запустить фактический seed разрешённого архива в пустой DB | Original counts 200/40/60/32/2743; schema/reference validation; originals неизменны; extensions отдельно. Повтор не дублирует данные. |
| T02 | Открыть не только заранее выбранный demo-профиль | Роль, grade, history, effective skills, goal/траектория, доступные шаги согласованы с domain state. |
| T03 | Импортировать новый профиль и CSV, повторить; затем изменить содержимое существующего record_id | Успешный атомарный import; identical no-op; conflict не скрывается; неизвестный ID работает тем же кодом. |
| T04 | Подготовить конфликт слабейшего некритичного skill с критическим gap и релевантной историей; вызвать live AI | Допустимый многокритериальный выбор, минимум три фактора, реальные evidence и честное сравнение. Не hard-code под ID. |
| T05 | Проверить отсутствие history, goal=null, Lead без цели, cross-role goal | Нет выдуманных фактов/следующего grade; цель и текущая аудитория разделены. |
| T06 | Табличные случаи gain/cap, x>cap, cap=5, incomplete, completion_pct<100 | Навык не падает и не превышает 5; только фактический gain; незавершённое не начисляет. |
| T07 | Записи до, на и после last_review_date; self-paced без completed_at | До/на review не учитываются повторно; после — по документированному proxy; provenance отмечен. |
| T08 | Mandatory, wrong role/grade, missing prerequisite, отсутствие сессии, completed event | Hard-ineligible не выбирается; mandatory отдельны; in_progress продолжение не дублируется. |
| T09 | Два разных допустимых участия EV_036 и повтор одного session completion | Разные реальные сессии допустимы; повтор одной не создаёт credit/XP. |
| T10 | Completion дважды и конкурентно; затем stop/start | Один completion/skill/reward credit в соответствии с policy; persistence; состояние не размножается. |
| T11 | Полный side quest flow, включая self-approval попытку | Approval без gain; accepted после evidence с одним credit; self-approval запрещён; milestone/roadmap обновлён. |
| T12 | Snapshot DB/state → preview → сравнение state и ожидаемого before/after | Точный simulated эффект; никаких реальных skills/history/XP mutations. |
| T13 | Прямые API-вызовы без достаточных прав, чужие employee/workspace IDs, self-review | Серверный отказ, без утечки/мутации; не только скрытая кнопка. |
| T14 | Малый контролируемый набор для каждой HR-формулы; denominator=0 и future session | Агрегаты совпадают с ручным расчётом, null вместо NaN, correct cohorts/scope. |
| T15 | Timeout/provider error; несуществующий event ID; prompt injection в evidence/учебном источнике | Явный fallback/error; недопустимые выборы отклонены; политика/skills не меняются. |
| T16 | Получить cache, выполнить completion/import/goal change/accepted или отмену | Старый ответ не выдаётся как актуальный; версии и UI согласованы. |
| T17 | Повтор начисления, два одновременных redemption, недостаточный баланс | Нет дубликатов/двойного расхода/отрицательного баланса; трата не уменьшает PersonalLevel; отмена аудируема. |
| T18 | Несколько новых synthetic profiles, cold и cache-hit; измерить UI и готовый recommendation | Честные n/min/median/max и сравнение с 2s/10s; modes разделены. |
| T19 | Свежий clone tested commit, отдельная DB, только README и разрешённый judge access | Install/seed/start/roles/import/live AI воспроизводятся без dev cookies/untracked файлов капитана. |
| T20 | Проверить release commit, remote, материалы, secrets и evidence | Нужная версия опубликована; доступы работают; ключи не попали в repo/bundle/logs; ограничения раскрыты. |

Различать отказ приложения и политику UI: для запрета важен отсутствие эффекта и утечки на сервере. HTTP code должен соответствовать задокументированному actual API contract.

## 3. Детерминированные fixtures

[Документационные JSON/CSV](examples/README.md) дают новый профиль и completed после review. Их можно использовать для T03/T07; они не заменяют весь набор edge cases.

Создать дополнительные маркированные fixtures: lowest non-critical vs critical gap, no history, missing goal, cap below current, unavailable prerequisite, repeated completion, zero denominator, conflicting record ID. Фикстуры не называют секретными профилями жюри.

Для графа добавить unreachable по данным и limit-exceeded по поиску как разные ситуации. Для отмены — пример нелинейного cap replay из [расчётов](04_DOMAIN_CALCULATIONS.md).

## 4. Проверка качества рекомендаций

В исходном наборе нет эталонных правильных рекомендаций. Нельзя объявлять «accuracy 95%» без отдельно размеченного evaluation set и определения метрики.

Проверяемые свойства: hard-constraint violations, валидность evidence, отсутствие придуманных events/gains, полезность шага относительно target/достижимой цепочки, корректность рассмотренной альтернативы, новая рекомендация на импортированном ID.

Можно сравнить с простыми baselines «минимальный skill» и «наибольший gap», но результат эксперимента фиксировать только после выполнения. Воспроизводимость LLM означает версии входных данных/prompt/model, режим и проверяемые свойства; побайтово одинаковый текст не обещается.

## 5. Live smoke

Проверяющий использует предусмотренный judge path в чистой browser session. Выбирает новый synthetic профиль, запускает рекомендацию, получает `live_ai`, разрешённые IDs и evidence, сверяет before/after с domain module.

В evidence сохранить model ID, время, prompt/config version, selected event IDs, mode, validation outcome, token counts при наличии. Отсутствующие usage данные обозначать unknown, не нулём. Не записывать секрет или весь профиль жюри в публичный log.

Контролируемый test double подтверждает обработку ошибок, но не доступность внешнего сервиса. Cache hit подтверждает кэш, но не новый inference.

## 6. Производительность

Измерение UI: от начала соответствующего действия до готовых отображённых данных основного экрана. Измерение AI: от запроса рекомендации до полного пригодного к проверке ответа; streaming skeleton/первый token не конец.

Раздельные серии: cold live, cached live и fallback. Не включать быстрый fallback в статистику live как будто это успешная модель. Указать размер данных, n, окружение, сеть, model/prompt version и ошибки. При нескольких прогонах достаточно min/median/max; малый n не обосновывает надёжный p95.

Шаблон [performance_template.csv](evidence/performance_template.csv) не содержит измерений. Значение `success=false` и timeout должны остаться в отчёте, а не удаляться ради красивой медианы.

## 7. Clean-room

Отдельная папка/DB, свежий clone выбранного SHA и только опубликованные инструкции. Не использовать случайно унаследованный provider key, dev cookies, untracked файл либо непубличную подсказку из чата.

Проверить startup, seed, пять ролей, ordinary completion, side quest при заявленной готовности, HR, новый import и live recommendation. После исправления инструкций — новый commit и повтор нужных проверок; не переносить PASS автоматически на изменённую версию.

## 8. Протокол

Каждый запуск оформляется по [TEST_RUN_TEMPLATE](evidence/TEST_RUN_TEMPLATE.md): requirement/test ID, commit, environment, data version, command/steps, expected, actual, exit code, PASS/FAIL/NOT_RUN, evidence path, ограничения.

Путь evidence указывается только для реально созданного файла. Screenshot интерфейса не доказывает unit tests, идемпотентность или latency. App tests не считаются выполненными из-за успешной проверки Markdown-ссылок.
