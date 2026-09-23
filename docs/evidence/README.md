# Доказательства проверки

Эта папка содержит **пустые шаблоны**, а не протокол успешного запуска приложения. Оригинальные/jury данные и секреты сюда не копируются.

Для каждой выполненной проверки сохранить краткий отчёт на основе [TEST_RUN_TEMPLATE](TEST_RUN_TEMPLATE.md). Для latency использовать [performance_template.csv](performance_template.csv). В [ACCEPTANCE](../ACCEPTANCE.md) указывать только существующий отчёт и фактический статус.

Минимальный evidence: tested commit, окружение, dataset/policy/model версии, точные команды или UI steps, expected/actual, exit code, PASS/FAIL/NOT_RUN. Допустимы несколько разрешённых screenshots, но не вместо tests/logs.

Отдельно отличать проверку самого комплекта Markdown от приложения. Report о корректных ссылках/JSON здесь не переводит T01–T20 в PASS.
