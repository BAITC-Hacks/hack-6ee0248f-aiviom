/** Exact snapshot of the immutable English source catalog, used to guard imported text. */
export const enEvents: Record<string, readonly [string, string]> = {
  "EV_001": [
    "Information Security Awareness",
    "Annual training on phishing, passwords and safe handling of company data."
  ],
  "EV_002": [
    "Personal Data Protection",
    "Annual training on lawful processing and storage of personal data."
  ],
  "EV_003": [
    "Code of Conduct & Workplace Safety",
    "Annual training on business ethics, anti-corruption rules and workplace safety."
  ],
  "EV_004": [
    "New Employee Onboarding",
    "One-day introduction to the company, its products, tools and people. Completed in the first month."
  ],
  "EV_005": [
    "System Design Fundamentals",
    "Core building blocks of distributed systems: caching, queues, databases, APIs."
  ],
  "EV_006": [
    "Designing High-Load Systems",
    "Hands-on architecture workshop on scaling, resilience and monitoring of production services."
  ],
  "EV_007": [
    "Architecture Review Circle",
    "Small-group sessions where a senior architect reviews participants' real design decisions."
  ],
  "EV_008": [
    "Business Writing & Documentation",
    "Writing clear emails, documents and specs that people actually read."
  ],
  "EV_009": [
    "Cloud Certification Prep",
    "Preparation track for an associate-level cloud certification, with final exam."
  ],
  "EV_010": [
    "Kubernetes in Practice",
    "Deploying and operating services on Kubernetes with automated pipelines."
  ],
  "EV_011": [
    "Secure Coding Workshop",
    "Finding and fixing common vulnerabilities in real code samples."
  ],
  "EV_012": [
    "Advanced Python",
    "Idiomatic Python, typing, testing and performance."
  ],
  "EV_013": [
    "TypeScript in Depth",
    "Type system, generics and safe refactoring of large frontend codebases."
  ],
  "EV_014": [
    "Web Performance Deep Dive",
    "Profiling and optimizing a production TypeScript application end to end."
  ],
  "EV_015": [
    "Web Performance Fundamentals",
    "Core Web Vitals, loading strategies and rendering performance basics."
  ],
  "EV_016": [
    "Accessible Interfaces",
    "Designing and building interfaces that meet accessibility standards."
  ],
  "EV_017": [
    "React Patterns & State Management",
    "Component architecture, state management and testing in React."
  ],
  "EV_018": [
    "Test Automation Bootcamp",
    "Building a maintainable automated test framework from scratch."
  ],
  "EV_019": [
    "API & Performance Testing Workshop",
    "Contract testing of APIs and load testing of services under realistic traffic."
  ],
  "EV_020": [
    "Applied Statistics for Analysts",
    "Full course on probability, distributions, hypothesis testing and regression."
  ],
  "EV_021": [
    "A/B Testing Workshop",
    "Designing experiments, choosing metrics and reading results correctly."
  ],
  "EV_022": [
    "SQL & BI for Analytics",
    "Analytical SQL and building self-service dashboards."
  ],
  "EV_023": [
    "Data Storytelling & Visualization",
    "Turning analysis into clear charts and presenting findings to decision makers."
  ],
  "EV_024": [
    "Machine Learning for Analysts",
    "Supervised learning, model evaluation and practical use cases in analytics."
  ],
  "EV_025": [
    "Dimensional Data Modeling",
    "Designing star schemas and analytical data marts."
  ],
  "EV_026": [
    "Product Discovery Lab",
    "Running customer interviews and validating problems before building."
  ],
  "EV_027": [
    "Roadmapping & Agile Planning",
    "Prioritization frameworks, roadmap communication and iterative delivery planning."
  ],
  "EV_028": [
    "Labor Law & Employee Relations",
    "Recent changes in labor legislation and handling of typical employee cases."
  ],
  "EV_029": [
    "People Analytics & Total Rewards",
    "Workforce metrics, pay benchmarking and benefit design."
  ],
  "EV_030": [
    "Structured Interviewing",
    "Competency-based interviews and unbiased candidate evaluation."
  ],
  "EV_031": [
    "Designing Learning Programs",
    "Building learning paths and facilitating training sessions."
  ],
  "EV_032": [
    "Negotiation Masterclass",
    "Negotiation strategy and practice on real deal scenarios."
  ],
  "EV_033": [
    "Consultative Selling & Prospecting",
    "Qualifying leads, discovery calls and pipeline hygiene in CRM."
  ],
  "EV_034": [
    "Handling Difficult Conversations",
    "De-escalation techniques for tense conversations with customers and colleagues."
  ],
  "EV_035": [
    "Technical Troubleshooting Academy",
    "Systematic diagnosis of product issues, logs and escalation paths."
  ],
  "EV_036": [
    "Public Speaking Club",
    "Recurring club where members give short talks and get feedback. Can be attended repeatedly."
  ],
  "EV_037": [
    "Mentor Track",
    "Training and supervised practice for new mentors."
  ],
  "EV_038": [
    "Leadership Foundations",
    "Core skills for new and aspiring team leads."
  ],
  "EV_039": [
    "Time & Priority Management",
    "Planning your week, managing interruptions and adapting to shifting priorities."
  ],
  "EV_040": [
    "Structured Problem Solving",
    "Team exercises on framing problems, testing hypotheses and deciding together."
  ]
};

export const enSkills: Record<string, readonly [string, string]> = {
  "SK_PYTHON": [
    "Python",
    "Writing, testing and maintaining Python code."
  ],
  "SK_JAVA": [
    "Java",
    "Writing, testing and maintaining Java code."
  ],
  "SK_SQL": [
    "SQL",
    "Querying and transforming relational data."
  ],
  "SK_API_DESIGN": [
    "API Design",
    "Designing clear, versioned and secure service interfaces."
  ],
  "SK_SYSTEM_DESIGN": [
    "System Design",
    "Designing scalable, reliable distributed systems."
  ],
  "SK_CLOUD": [
    "Cloud Platforms",
    "Building and running services on cloud infrastructure."
  ],
  "SK_CONTAINERS": [
    "Containers & Orchestration",
    "Packaging and running services with containers and orchestrators."
  ],
  "SK_CICD": [
    "CI/CD",
    "Automating build, test and deployment pipelines."
  ],
  "SK_APP_SECURITY": [
    "Application Security",
    "Preventing common vulnerabilities in application code."
  ],
  "SK_OBSERVABILITY": [
    "Observability",
    "Monitoring systems with metrics, logs and traces."
  ],
  "SK_JAVASCRIPT": [
    "JavaScript",
    "Writing modern JavaScript for web applications."
  ],
  "SK_TYPESCRIPT": [
    "TypeScript",
    "Writing type-safe TypeScript code."
  ],
  "SK_REACT": [
    "React",
    "Building UI with React components and state management."
  ],
  "SK_HTML_CSS": [
    "HTML & CSS",
    "Building semantic, responsive page layouts."
  ],
  "SK_WEB_PERFORMANCE": [
    "Web Performance",
    "Measuring and improving page load and runtime performance."
  ],
  "SK_ACCESSIBILITY": [
    "Web Accessibility",
    "Building interfaces usable by people with disabilities."
  ],
  "SK_TEST_DESIGN": [
    "Test Design",
    "Deriving test cases from requirements and risks."
  ],
  "SK_TEST_AUTOMATION": [
    "Test Automation",
    "Building and maintaining automated test suites."
  ],
  "SK_API_TESTING": [
    "API Testing",
    "Testing service interfaces for correctness and contracts."
  ],
  "SK_LOAD_TESTING": [
    "Load Testing",
    "Testing system behaviour under load."
  ],
  "SK_STATISTICS": [
    "Statistics",
    "Applying descriptive and inferential statistics."
  ],
  "SK_AB_TESTING": [
    "A/B Testing",
    "Designing and analysing controlled experiments."
  ],
  "SK_DATA_VIZ": [
    "Data Visualization",
    "Presenting data clearly with charts and dashboards."
  ],
  "SK_BI_TOOLS": [
    "BI Tools",
    "Building reports in business intelligence tools."
  ],
  "SK_DATA_MODELING": [
    "Data Modeling",
    "Designing analytical data structures."
  ],
  "SK_ML_BASICS": [
    "Machine Learning Fundamentals",
    "Training and evaluating basic ML models."
  ],
  "SK_PRODUCT_DISCOVERY": [
    "Product Discovery",
    "Finding and validating user problems worth solving."
  ],
  "SK_ROADMAPPING": [
    "Roadmapping & Prioritization",
    "Prioritizing work and building product roadmaps."
  ],
  "SK_PRODUCT_ANALYTICS": [
    "Product Analytics",
    "Using product metrics to guide decisions."
  ],
  "SK_UX_RESEARCH": [
    "UX Research",
    "Running interviews and usability studies."
  ],
  "SK_REQUIREMENTS": [
    "Requirements Writing",
    "Writing clear, testable requirements."
  ],
  "SK_AGILE": [
    "Agile Practices",
    "Working in iterative delivery frameworks."
  ],
  "SK_PROJECT_MGMT": [
    "Project Management",
    "Planning scope, timelines and risks."
  ],
  "SK_TALENT_ACQUISITION": [
    "Talent Acquisition",
    "Sourcing, interviewing and hiring candidates."
  ],
  "SK_EMPLOYEE_RELATIONS": [
    "Employee Relations",
    "Handling employee cases and workplace issues."
  ],
  "SK_LABOR_LAW": [
    "Labor Law",
    "Applying employment legislation in HR practice."
  ],
  "SK_HR_ANALYTICS": [
    "HR Analytics",
    "Analysing workforce data for decisions."
  ],
  "SK_LEARNING_DESIGN": [
    "Learning Program Design",
    "Designing training programs and learning paths."
  ],
  "SK_COMPENSATION": [
    "Compensation & Benefits",
    "Designing pay structures and benefit packages."
  ],
  "SK_PROSPECTING": [
    "Prospecting",
    "Finding and qualifying new customers."
  ],
  "SK_NEGOTIATION": [
    "Negotiation",
    "Reaching agreements that work for both sides."
  ],
  "SK_CRM": [
    "CRM Systems",
    "Managing customer data and pipelines in CRM."
  ],
  "SK_ACCOUNT_MGMT": [
    "Account Management",
    "Growing and retaining existing customer accounts."
  ],
  "SK_PRODUCT_KNOWLEDGE": [
    "Product Knowledge",
    "Knowing the company's products and how customers use them."
  ],
  "SK_CUSTOMER_SERVICE": [
    "Customer Service",
    "Resolving customer requests with quality and empathy."
  ],
  "SK_TROUBLESHOOTING": [
    "Technical Troubleshooting",
    "Diagnosing and resolving technical issues."
  ],
  "SK_COMMUNICATION": [
    "Communication",
    "Expressing ideas clearly and listening actively."
  ],
  "SK_PUBLIC_SPEAKING": [
    "Public Speaking",
    "Presenting confidently to groups."
  ],
  "SK_WRITTEN_COMMUNICATION": [
    "Written Communication",
    "Writing clear emails, documents and reports."
  ],
  "SK_STAKEHOLDER_MGMT": [
    "Stakeholder Management",
    "Aligning expectations with stakeholders."
  ],
  "SK_LEADERSHIP": [
    "Leadership",
    "Setting direction and motivating a team."
  ],
  "SK_MENTORING": [
    "Mentoring",
    "Helping colleagues grow through guidance."
  ],
  "SK_FEEDBACK": [
    "Feedback",
    "Giving and receiving constructive feedback."
  ],
  "SK_CONFLICT_RESOLUTION": [
    "Conflict Resolution",
    "Resolving disagreements constructively."
  ],
  "SK_TEAMWORK": [
    "Teamwork",
    "Working effectively toward shared goals."
  ],
  "SK_EMOTIONAL_INTELLIGENCE": [
    "Emotional Intelligence",
    "Recognising and managing emotions in yourself and others."
  ],
  "SK_PROBLEM_SOLVING": [
    "Problem Solving",
    "Breaking down problems and finding solutions."
  ],
  "SK_CRITICAL_THINKING": [
    "Critical Thinking",
    "Evaluating information and arguments objectively."
  ],
  "SK_TIME_MANAGEMENT": [
    "Time Management",
    "Planning and prioritizing own work."
  ],
  "SK_ADAPTABILITY": [
    "Adaptability",
    "Adjusting quickly to change."
  ]
};
