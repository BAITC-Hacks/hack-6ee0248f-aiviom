import type { Locale } from '../locale.js';

type Label = Record<Locale, string>;
type Text = Record<Locale, readonly [string, string]>;

export const roles: Record<string, Label> = {
  'Backend Engineer': { ru: 'Бэкенд-разработчик', kk: 'Серверлік әзірлеуші', en: 'Backend Engineer' },
  'Frontend Engineer': { ru: 'Фронтенд-разработчик', kk: 'Фронтенд әзірлеуші', en: 'Frontend Engineer' },
  'Data Analyst': { ru: 'Аналитик данных', kk: 'Деректер талдаушысы', en: 'Data Analyst' },
  'QA Engineer': { ru: 'Инженер по тестированию', kk: 'Тестілеу инженері', en: 'QA Engineer' },
  'Product Manager': { ru: 'Менеджер продукта', kk: 'Өнім менеджері', en: 'Product Manager' },
  'HR Business Partner': { ru: 'HR-бизнес-партнёр', kk: 'HR бизнес-серіктесі', en: 'HR Business Partner' },
  'Sales Manager': { ru: 'Менеджер по продажам', kk: 'Сату менеджері', en: 'Sales Manager' },
  'Customer Support Specialist': { ru: 'Специалист поддержки клиентов', kk: 'Клиенттерді қолдау маманы', en: 'Customer Support Specialist' },
};

export const departments: Record<string, Label> = {
  'Backend Development': { ru: 'Бэкенд-разработка', kk: 'Серверлік әзірлеу', en: 'Backend Development' },
  'Frontend Development': { ru: 'Фронтенд-разработка', kk: 'Фронтенд әзірлеу', en: 'Frontend Development' },
  'Data & Analytics': { ru: 'Данные и аналитика', kk: 'Деректер және талдау', en: 'Data & Analytics' },
  'Quality Assurance': { ru: 'Обеспечение качества', kk: 'Сапаны қамтамасыз ету', en: 'Quality Assurance' },
  'Product Management': { ru: 'Управление продуктом', kk: 'Өнімді басқару', en: 'Product Management' },
  'Human Resources': { ru: 'Управление персоналом', kk: 'Персоналды басқару', en: 'Human Resources' },
  Sales: { ru: 'Продажи', kk: 'Сату', en: 'Sales' },
  'Customer Support': { ru: 'Поддержка клиентов', kk: 'Клиенттерді қолдау', en: 'Customer Support' },
};

export const rewards: Record<string, { source: readonly [string, string]; text: Text }> = {
  mentor: {
    source: ['Сессия с наставником', 'Демо-политика: дополнительный разбор 30 минут.'],
    text: {
      ru: ['Сессия с наставником', 'Демо-политика: дополнительный разбор 30 минут.'],
      kk: ['Тәлімгермен кездесу', 'Демо ереже: қосымша 30 минуттық талқылау.'],
      en: ['Session with a mentor', 'Demo policy: an additional 30-minute review.'],
    },
  },
  project: {
    source: ['Время на личный проект', 'Демо-политика: запрос согласованного времени, не обещание банка.'],
    text: {
      ru: ['Время на личный проект', 'Демо-политика: запрос согласованного времени, не обещание банка.'],
      kk: ['Жеке жобаға уақыт', 'Демо ереже: келісілген уақытқа сұрау салу; банк уәдесі емес.'],
      en: ['Time for a personal project', 'Demo policy: request approved time; this is not a bank commitment.'],
    },
  },
};

export type DemoField = 'title' | 'description' | 'deliverables' | 'criteria' | 'reason' | 'evidence';
export const demo: Record<string, Partial<Record<DemoField, { source: string; text: Label }>>> = {
  DEMO_Q_REVIEW: { title: { source: 'Практический разбор: предложение', text: { ru: 'Практический разбор: предложение', kk: 'Тәжірибелік талдау: ұсыныс', en: 'Practical review: proposal' } } },
  DEMO_Q_EVIDENCE: {
    title: { source: 'Практический разбор: результат', text: { ru: 'Практический разбор: результат', kk: 'Тәжірибелік талдау: нәтиже', en: 'Practical review: result' } },
    evidence: {
      source: 'Демо-доказательство: подготовлен разбор решения и проверочный пример. Это синтетическая заявка для проверки workflow.',
      text: {
        ru: 'Демо-доказательство: подготовлен разбор решения и проверочный пример. Это синтетическая заявка для проверки процесса согласования.',
        kk: 'Демо-дәлел: шешім талдауы мен тексеруге болатын мысал дайындалды. Бұл жұмыс үдерісін тексеруге арналған жасанды өтінім.',
        en: 'Demo evidence: a solution review and a test example have been prepared. This is a synthetic request for workflow verification.',
      },
    },
  },
  DEMO_Q_RESOURCE: { title: { source: 'Время на практику с наставником', text: { ru: 'Время на практику с наставником', kk: 'Тәлімгермен тәжірибеге уақыт', en: 'Time to practice with a mentor' } } },
  DEMO_Q_POLICY: { title: { source: 'Новый способ подтверждения компетенции', text: { ru: 'Новый способ подтверждения компетенции', kk: 'Құзыреттілікті растаудың жаңа тәсілі', en: 'A new way to verify a competency' } } },
  DEMO_HELP: { reason: { source: 'Нужно согласовать 4 часа на развитие на этой неделе.', text: { ru: 'Нужно согласовать 4 часа на развитие на этой неделе.', kk: 'Осы аптада дамуға 4 сағат бөлуді келісу қажет.', en: 'Four hours for development need approval this week.' } } },
};

const sharedDemo: Partial<Record<DemoField, { source: string; text: Label }>> = {
  description: { source: 'Демо-расширение AIVIOM: практическая работа для подтверждения компетенции.', text: { ru: 'Демо-расширение AIVIOM: практическая работа для подтверждения компетенции.', kk: 'AIVIOM демо кеңейтімі: құзыреттілікті растауға арналған тәжірибелік жұмыс.', en: 'AIVIOM demo extension: practical work to verify a competency.' } },
  deliverables: { source: 'Краткий отчёт, воспроизводимый пример и разбор с наставником.', text: { ru: 'Краткий отчёт, воспроизводимый пример и разбор с наставником.', kk: 'Қысқаша есеп, қайта орындауға болатын мысал және тәлімгермен талдау.', en: 'A short report, a reproducible example and a review with the mentor.' } },
  criteria: { source: 'Наставник проверяет самостоятельность решения, воспроизводимость результата и объяснение принятых решений.', text: { ru: 'Наставник проверяет самостоятельность решения, воспроизводимость результата и объяснение принятых решений.', kk: 'Тәлімгер жұмыстың өз бетінше орындалуын, нәтиженің қайталануын және қабылданған шешімдердің түсіндірмесін тексереді.', en: 'The mentor checks independent work, reproducibility and the explanation of decisions.' } },
};

for (const id of ['DEMO_Q_REVIEW', 'DEMO_Q_EVIDENCE', 'DEMO_Q_RESOURCE', 'DEMO_Q_POLICY']) Object.assign(demo[id], sharedDemo);

export const enumLabels: Record<string, Record<string, Label>> = {
  proficiency: {
    '0': { ru: 'Нет знаний', kk: 'Білімі жоқ', en: 'No knowledge' },
    '1': { ru: 'Базовое знакомство: знает основные понятия, нужна помощь', kk: 'Бастапқы түсінік: негізгі ұғымдарды біледі, көмек қажет', en: 'Basic awareness: knows key concepts, needs guidance' },
    '2': { ru: 'Рабочие знания: решает типовые задачи с некоторой помощью', kk: 'Жұмыс деңгейі: қалыпты міндеттерді аздаған көмекпен орындайды', en: 'Working knowledge: handles routine tasks with some support' },
    '3': { ru: 'Уверенный уровень: решает типовые задачи самостоятельно', kk: 'Сенімді деңгей: қалыпты міндеттерді өз бетінше орындайды', en: 'Proficient: works independently on typical tasks' },
    '4': { ru: 'Продвинутый уровень: решает сложные задачи и помогает другим', kk: 'Жоғары деңгей: күрделі жағдайларды шешіп, басқаларға бағыт береді', en: 'Advanced: handles complex cases, guides others' },
    '5': { ru: 'Экспертный уровень: задаёт стандарты и развивает практику компании', kk: 'Сарапшы деңгейі: стандарттарды белгілеп, компания тәжірибесін дамытады', en: 'Expert: sets standards and shapes practice across the company' },
  },
  grade: {
    Junior: { ru: 'Начальный', kk: 'Бастапқы', en: 'Junior' },
    Middle: { ru: 'Средний', kk: 'Орта', en: 'Middle' },
    Senior: { ru: 'Старший', kk: 'Жоғары', en: 'Senior' },
    Lead: { ru: 'Ведущий', kk: 'Жетекші', en: 'Lead' },
  },
  format: {
    online: { ru: 'Онлайн', kk: 'Онлайн', en: 'Online' },
    offline: { ru: 'Очно', kk: 'Бетпе-бет', en: 'In person' },
    self_paced: { ru: 'В своём темпе', kk: 'Өз қарқынымен', en: 'Self-paced' },
    office: { ru: 'В офисе', kk: 'Кеңседе', en: 'Office' },
    hybrid: { ru: 'Гибридно', kk: 'Аралас', en: 'Hybrid' },
    remote: { ru: 'Удалённо', kk: 'Қашықтан', en: 'Remote' },
  },
  eventType: {
    compliance: { ru: 'Обязательное обучение', kk: 'Міндетті оқу', en: 'Compliance training' },
    onboarding: { ru: 'Адаптация', kk: 'Бейімдеу', en: 'Onboarding' },
    course: { ru: 'Курс', kk: 'Курс', en: 'Course' },
    workshop: { ru: 'Практикум', kk: 'Тәжірибелік сабақ', en: 'Workshop' },
    mentoring: { ru: 'Наставничество', kk: 'Тәлімгерлік', en: 'Mentoring' },
    certification: { ru: 'Сертификация', kk: 'Сертификаттау', en: 'Certification' },
    meetup: { ru: 'Встреча', kk: 'Кездесу', en: 'Meetup' },
  },
  skillType: {
    hard: { ru: 'Профессиональный навык', kk: 'Кәсіби дағды', en: 'Technical skill' },
    soft: { ru: 'Универсальный навык', kk: 'Әмбебап дағды', en: 'Transferable skill' },
  },
  skillCategory: {
    engineering: { ru: 'Инженерия', kk: 'Инженерия', en: 'Engineering' },
    frontend: { ru: 'Фронтенд', kk: 'Фронтенд', en: 'Frontend' },
    quality: { ru: 'Качество', kk: 'Сапа', en: 'Quality' },
    data: { ru: 'Данные', kk: 'Деректер', en: 'Data' },
    product: { ru: 'Продукт', kk: 'Өнім', en: 'Product' },
    hr: { ru: 'Персонал', kk: 'Персонал', en: 'People' },
    sales: { ru: 'Продажи', kk: 'Сату', en: 'Sales' },
    support: { ru: 'Поддержка', kk: 'Қолдау', en: 'Support' },
    communication: { ru: 'Коммуникация', kk: 'Қарым-қатынас', en: 'Communication' },
    leadership: { ru: 'Лидерство', kk: 'Көшбасшылық', en: 'Leadership' },
    collaboration: { ru: 'Сотрудничество', kk: 'Ынтымақтастық', en: 'Collaboration' },
    thinking: { ru: 'Мышление', kk: 'Ойлау', en: 'Thinking' },
    personal_effectiveness: { ru: 'Личная эффективность', kk: 'Жеке тиімділік', en: 'Personal effectiveness' },
  },
  status: {
    completed: { ru: 'Завершено', kk: 'Аяқталды', en: 'Completed' },
    in_progress: { ru: 'В работе', kk: 'Орындалуда', en: 'In progress' },
    dropped: { ru: 'Прервано', kk: 'Тоқтатылды', en: 'Stopped' },
    no_show: { ru: 'Не явился', kk: 'Қатыспады', en: 'Did not attend' },
    declined: { ru: 'Отказано', kk: 'Бас тартылды', en: 'Declined' },
    overdue: { ru: 'Просрочено', kk: 'Мерзімі өтті', en: 'Overdue' },
    submitted: { ru: 'На согласовании', kk: 'Келісілуде', en: 'Submitted for review' },
    advisor_review: { ru: 'У наставника', kk: 'Тәлімгер қарауында', en: 'Mentor review' },
    needs_revision: { ru: 'Нужна доработка', kk: 'Толықтыру қажет', en: 'Needs revision' },
    rejected: { ru: 'Отклонено', kk: 'Қабылданбады', en: 'Rejected' },
    approved: { ru: 'Согласовано', kk: 'Келісілді', en: 'Approved' },
    resource_review: { ru: 'Ресурсное решение', kk: 'Ресурстар қаралуда', en: 'Resource review' },
    policy_review: { ru: 'Проверка правил', kk: 'Ережелер тексерілуде', en: 'Policy review' },
    ready: { ru: 'Можно выполнять', kk: 'Орындауға болады', en: 'Ready to start' },
    evidence_submitted: { ru: 'Результат на проверке', kk: 'Нәтиже тексерілуде', en: 'Evidence under review' },
    accepted: { ru: 'Принято', kk: 'Қабылданды', en: 'Accepted' },
    planned: { ru: 'В плане', kk: 'Жоспарда', en: 'Planned' },
    available: { ru: 'Доступно', kk: 'Қолжетімді', en: 'Available' },
    blocked: { ru: 'Нужна подготовка', kk: 'Дайындық қажет', en: 'Preparation needed' },
    pending: { ru: 'Ожидает решения', kk: 'Шешімді күтуде', en: 'Pending' },
    open: { ru: 'Открыто', kk: 'Ашық', en: 'Open' },
    resolved: { ru: 'Решено', kk: 'Шешілді', en: 'Resolved' },
  },
};
