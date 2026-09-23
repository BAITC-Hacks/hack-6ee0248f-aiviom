import type { Locale } from "./locale.js";

export const importMessages = {
  "input": {
    "ru": "Передайте объект с сотрудниками и историей.",
    "kk": "Қызметкерлер мен тарихы бар нысанды жіберіңіз.",
    "en": "Expected {employees, history}"
  },
  "employees_shape": {
    "ru": "Сотрудники: нужен массив, объект employees или один профиль.",
    "kk": "Қызметкерлер үшін массив, employees нысаны немесе бір профиль қажет.",
    "en": "employees must be an array, wrapper, or employee object"
  },
  "history_shape": {
    "ru": "История: нужен CSV, массив или объект history.",
    "kk": "Тарих үшін CSV, массив немесе history нысаны қажет.",
    "en": "history must be CSV, array, or wrapper"
  },
  "object": {
    "ru": "Ожидается объект с полями.",
    "kk": "Өрістері бар нысан қажет.",
    "en": "Expected object"
  },
  "required": {
    "ru": "Заполните поле: от 1 до 300 символов.",
    "kk": "Өрісті толтырыңыз: 1–300 таңба.",
    "en": "Required non-empty string, at most 300 characters"
  },
  "employee_id": {
    "ru": "ID: 1–80 латинских букв, цифр, дефисов или подчёркиваний.",
    "kk": "ID: 1–80 латын әрпі, цифр, дефис немесе астын сызу белгісі.",
    "en": "Use a safe identifier of 1–80 letters, numbers, underscores or hyphens"
  },
  "record_id": {
    "ru": "ID записи: 1–100 латинских букв, цифр, дефисов или подчёркиваний.",
    "kk": "Жазба ID-і: 1–100 латын әрпі, цифр, дефис немесе астын сызу белгісі.",
    "en": "Use a safe identifier of 1–100 characters"
  },
  "duplicate": {
    "ru": "Этот ID повторяется в загружаемых данных.",
    "kk": "Бұл ID жүктелетін деректерде қайталанады.",
    "en": "Duplicate ID in import"
  },
  "grade": {
    "ru": "Укажите существующий грейд.",
    "kk": "Қолданыстағы кәсіби деңгейді көрсетіңіз.",
    "en": "Unknown grade"
  },
  "role": {
    "ru": "Не найден профиль для этой роли и грейда.",
    "kk": "Бұл рөл мен кәсіби деңгейге сәйкес профиль табылмады.",
    "en": "Unknown role/grade profile"
  },
  "work_format": {
    "ru": "Допустимые форматы работы: office, hybrid, remote.",
    "kk": "Рұқсат етілген жұмыс форматтары: office, hybrid, remote.",
    "en": "Unknown work format"
  },
  "language": {
    "ru": "Укажите код языка ru, kk или en.",
    "kk": "ru, kk немесе en тіл кодын көрсетіңіз.",
    "en": "Unknown language"
  },
  "date": {
    "ru": "Укажите действительную дату в формате ГГГГ-ММ-ДД.",
    "kk": "Жарамды күнді ЖЖЖЖ-АА-КК форматында көрсетіңіз.",
    "en": "Invalid ISO date"
  },
  "before_hire": {
    "ru": "Дата оценки не может быть раньше даты найма.",
    "kk": "Бағалау күні жұмысқа қабылдау күнінен бұрын болмауы керек.",
    "en": "Before hire date"
  },
  "nonnegative": {
    "ru": "Укажите целое число не меньше нуля.",
    "kk": "Нөлден кем емес бүтін санды көрсетіңіз.",
    "en": "Expected non-negative integer"
  },
  "nullable_id": {
    "ru": "Укажите ID или null, если значения нет.",
    "kk": "ID көрсетіңіз немесе мән болмаса null жазыңыз.",
    "en": "Expected ID or null"
  },
  "skills": {
    "ru": "Укажите объект с ID навыков и их уровнями.",
    "kk": "Дағдылардың ID-і мен деңгейлері бар нысанды көрсетіңіз.",
    "en": "Expected skill levels object"
  },
  "skill": {
    "ru": "Этот навык отсутствует в справочнике.",
    "kk": "Бұл дағды анықтамалықта жоқ.",
    "en": "Unknown skill"
  },
  "level": {
    "ru": "Укажите целый уровень от 0 до 5.",
    "kk": "0–5 аралығындағы бүтін деңгейді көрсетіңіз.",
    "en": "Expected integer 0–5"
  },
  "goal": {
    "ru": "Укажите существующую целевую роль и грейд.",
    "kk": "Қолданыстағы мақсатты рөл мен кәсіби деңгейді көрсетіңіз.",
    "en": "Unknown target role/grade"
  },
  "conflict": {
    "ru": "ID уже существует с другими данными. Используйте новый ID.",
    "kk": "Бұл ID басқа деректермен бар. Жаңа ID пайдаланыңыз.",
    "en": "Existing ID has conflicting content"
  },
  "self_manager": {
    "ru": "Сотрудник не может быть своим руководителем.",
    "kk": "Қызметкер өзіне басшы бола алмайды.",
    "en": "Cannot manage self"
  },
  "employee": {
    "ru": "Сотрудник не найден. Сначала добавьте его профиль.",
    "kk": "Қызметкер табылмады. Алдымен оның профилін қосыңыз.",
    "en": "Unknown employee"
  },
  "event": {
    "ru": "Активность не найдена в каталоге.",
    "kk": "Іс-шара каталогтан табылмады.",
    "en": "Unknown event"
  },
  "status": {
    "ru": "Укажите поддерживаемый статус истории.",
    "kk": "Тарихтың қолдау көрсетілетін күйін көрсетіңіз.",
    "en": "Unknown status"
  },
  "assigner": {
    "ru": "Укажите источник назначения: self, manager или hr.",
    "kk": "Тағайындау көзін көрсетіңіз: self, manager немесе hr.",
    "en": "Unknown assigner"
  },
  "percent": {
    "ru": "Укажите целое число от 0 до 100.",
    "kk": "0–100 аралығындағы бүтін санды көрсетіңіз.",
    "en": "Expected integer 0–100"
  },
  "completed": {
    "ru": "Для завершённой записи выполнение должно быть 100%.",
    "kk": "Аяқталған жазбаның орындалуы 100% болуы керек.",
    "en": "Completed requires 100"
  },
  "unfinished": {
    "ru": "Для незавершённой записи выполнение не должно превышать 95%.",
    "kk": "Аяқталмаған жазбаның орындалуы 95%-дан аспауы керек.",
    "en": "Unfinished status cannot exceed 95"
  },
  "dropped": {
    "ru": "Для прерванной активности укажите выполнение от 5 до 95%.",
    "kk": "Тоқтатылған іс-шара үшін орындалуды 5–95% аралығында көрсетіңіз.",
    "en": "Dropped requires 5–95"
  },
  "zero": {
    "ru": "Для этого статуса выполнение должно быть 0%.",
    "kk": "Бұл күй үшін орындалу 0% болуы керек.",
    "en": "Status requires 0"
  },
  "scheduled": {
    "ru": "Неявка применима только к активности с расписанием.",
    "kk": "Қатыспау күйі тек кестесі бар іс-шараға қолданылады.",
    "en": "No-show requires a scheduled event"
  },
  "score": {
    "ru": "Укажите целую оценку от 0 до 100 или оставьте поле пустым.",
    "kk": "0–100 аралығындағы бүтін бағаны көрсетіңіз немесе өрісті бос қалдырыңыз.",
    "en": "Expected integer 0–100 or blank"
  },
  "rating": {
    "ru": "Укажите оценку от 1 до 5 или оставьте поле пустым.",
    "kk": "1–5 аралығындағы бағаны көрсетіңіз немесе өрісті бос қалдырыңыз.",
    "en": "Expected integer 1–5 or blank"
  },
  "completion_date": {
    "ru": "Дата завершения допустима только для завершённой записи.",
    "kk": "Аяқталу күні тек аяқталған жазбада көрсетіледі.",
    "en": "Only completed records have completion date"
  },
  "chronology": {
    "ru": "Завершение не может предшествовать началу активности.",
    "kk": "Аяқталу күні іс-шараның басталуынан бұрын болмауы керек.",
    "en": "Completion before enrollment/session"
  },
  "session_repeat": {
    "ru": "Эта сессия уже зачтена. Повторный зачёт недоступен.",
    "kk": "Бұл сессия есепке алынған. Қайта есепке алу мүмкін емес.",
    "en": "Session already completed"
  },
  "event_repeat": {
    "ru": "Эта активность уже зачтена. Повторный зачёт недоступен.",
    "kk": "Бұл іс-шара есепке алынған. Қайта есепке алу мүмкін емес.",
    "en": "Event already completed"
  },
  "csv": {
    "ru": "Не удалось прочитать CSV. Проверьте разделители и кавычки.",
    "kk": "CSV файлын оқу мүмкін болмады. Бөлгіштер мен тырнақшаларды тексеріңіз.",
    "en": "Invalid CSV"
  },
  "employee_exists": {
    "ru": "Сотрудник {id} уже существует; изменений нет.",
    "kk": "{id} қызметкері бұрыннан бар; өзгеріс жоқ.",
    "en": "Employee {id} already exists; no-op"
  },
  "history_exists": {
    "ru": "Запись {id} уже существует; изменений нет.",
    "kk": "{id} жазбасы бұрыннан бар; өзгеріс жоқ.",
    "en": "History {id} already exists; no-op"
  },
  "manager_unresolved": {
    "ru": "Сотрудник {id}: руководитель {manager} пока не найден.",
    "kk": "{id} қызметкері: {manager} басшысы әзірге табылмады.",
    "en": "Employee {id}: manager {manager} is unresolved"
  }
} as const;
export type ImportCode = keyof typeof importMessages;
export interface ImportIssue { code: ImportCode; params?: Record<string,string|number> }
export function importMessage(code: ImportCode, locale: Locale, params: Record<string,string|number> = {}): string {
  return importMessages[code][locale].replace(/\{(\w+)\}/g, (_match, key: string) => String(params[key] ?? "—"));
}
export function localizeImportResult<T extends {errors: {code?: string;message: string}[];warnings: string[];warning_details?: ImportIssue[]}>(result: T, locale: Locale): T {
 return {...result, errors: result.errors.map(error => ({...error, message: error.code && error.code in importMessages ? importMessage(error.code as ImportCode, locale) : error.message, message_key: error.code ? `import.${error.code}` : undefined })), warnings: result.warning_details ? result.warning_details.map(issue => importMessage(issue.code, locale, issue.params)) : result.warnings };
}
