# Инспекция доступной копии датасета

Проверены исходные файлы, а не приложение. Результат не переводит T01/импорт/clean-room в PASS.

## Архив

| Параметр | Значение |
|---|---|
| Файл | `career_quest_dataset.zip` |
| Размер | 64298 bytes |
| SHA-256 доступной копии | `58bb943b1d81f25cb5ba1be2142ac216abf7b6d0d63a1668b3b45fd65c67929f` |
| SHA-256, записанный в S-FINAL §9 | `e7a6ee9c2746bf946df32587debf757a59ad572c70acb45ce5842e9a12f01eb6` |
| CRC всех ZIP entries | Ошибок не обнаружено методом `ZipFile.testzip()` |
| Содержимое | JSON/CSV и README в `case_1/career_quest_dataset/` |

**Вывод:** checksum не совпадает. Совпадение размера, CRC и заявленных количеств не доказывает тождество версии с указанной в спецификации. Причина различия не установлена. По правилу S-FINAL другую копию нельзя считать автоматически неверной. Требуется зафиксировать разрешённый релизный архив и его фактический hash.

## Файлы полезного набора

| Файл | Bytes | SHA-256 |
|---|---:|---|
| `employees.json` | 232522 | `bcf366fc3cecde04401200e7ea192ae5b008fa5de8b13b246ef98b1ba65945de` |
| `events.json` | 33747 | `e82f08dfd947b0f4bfda2d984d7e2adcdb1e2b96f239223cf4ad14dd05c1b14b` |
| `skills.json` | 31082 | `12d99e52b5ed7e95d9d817380b774145e53d65a2b6c961f3c57e9f09a021edee` |
| `activity_history.csv` | 160921 | `daaec3190b7d3d37f6a820a4c2926fd3a94a4e7dc22ea8f00b350a008d11993b` |
| `README.md` | 5108 | `cd4a190009c6bb40c8f339b48da251af63adb2a50329b3ec77e8711315d8d96f` |
| `README.ru.md` | 7883 | `4baffc7b705d9b0801415ea5e2a6199174fbf59868fce3d3634786938e53657c` |
| `README.kz.md` | 8080 | `8fac05c63cbe65089f406c19b22213e063f2f8daf63401bb4c3e8c058166d6f0` |

## Подтверждённая структура

200 employees; 40 events; 60 skills; 32 role_profiles; 2 743 CSV rows. Wrappers: `{meta, employees}`, `{meta, events}`, `{meta, proficiency_scale, skills, role_profiles}`. Snapshot в meta: `2026-10-01`, version `1.0`.

CSV header:

```csv
record_id,employee_id,event_id,date,due_date,status,completion_pct,score,feedback_rating,assigned_by
```

Это инвентаризация и чтение схемы. Здесь не заявлены проверка всех cross-references, авторизация, обработка импорта или прохождение приложения end-to-end.

## Воспроизведение checksum

На машине с `sha256sum` выполнить для фактического пути:

```bash
sha256sum /path/to/career_quest_dataset.zip
```

Для другого архивного файла результат может закономерно отличаться. Не менять ожидаемый hash только ради зелёного теста без фиксации версии/происхождения.
