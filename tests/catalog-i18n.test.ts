import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSourceDataset } from '../src/domain/source.js';
import { seed } from '../src/server/store.js';
import { catalogText, enumText } from '../src/shared/catalog-i18n.js';
import { enEvents, enSkills } from '../src/shared/catalog-translations/en.js';
import { ruEvents, ruSkills } from '../src/shared/catalog-translations/ru.js';
import { kkEvents, kkSkills } from '../src/shared/catalog-translations/kk.js';
import { departments, demo, enumLabels, rewards, roles } from '../src/shared/catalog-translations/labels.js';

const source = loadSourceDataset();
const locales = ['ru', 'kk', 'en'] as const;

test('every immutable source event and skill has both fields in all three locales', () => {
  assert.equal(source.events.length, 40);
  assert.equal(source.skills.length, 60);
  for (const [kind, rows, dictionaries] of [
    ['event', source.events.map(e => [e.event_id, e.title, e.description]), [ruEvents, kkEvents, enEvents]],
    ['skill', source.skills.map(s => [s.skill_id, s.name, s.description]), [ruSkills, kkSkills, enSkills]],
  ] as const) {
    const sourceIds = rows.map(row => row[0]);
    for (const dictionary of dictionaries) assert.deepEqual(Object.keys(dictionary).sort(), [...sourceIds].sort());
    for (const [id, title, description] of rows) {
      const english = dictionaries[2][id];
      assert.deepEqual(english, [title, description], `${kind} ${id} English source snapshot`);
      for (const locale of locales) {
        const translatedTitle = catalogText(locale, kind, id, title);
        const translatedDescription = catalogText(locale, kind, id, description, 'description');
        assert.ok(translatedTitle.trim(), `${locale} ${kind} ${id} title`);
        assert.ok(translatedDescription.trim(), `${locale} ${kind} ${id} description`);
        assert.equal(translatedTitle, dictionaries[locales.indexOf(locale)][id]?.[0]);
        assert.equal(translatedDescription, dictionaries[locales.indexOf(locale)][id]?.[1]);
      }
    }
  }
});

test('source roles, departments and controlled values have RU, KK and EN labels', () => {
  const roleValues = [...new Set(source.role_profiles.map(p => p.role))];
  const departmentValues = [...new Set(source.employees.map(e => e.department))];
  assert.deepEqual(Object.keys(roles).sort(), roleValues.sort());
  assert.deepEqual(Object.keys(departments).sort(), departmentValues.sort());
  for (const [kind, values] of [['role', roleValues], ['department', departmentValues]] as const) {
    for (const value of values) for (const locale of locales)
      assert.ok(catalogText(locale, kind, value, value).trim());
  }
  const enums = [
    ['grade', source.role_profiles.map(p => p.grade)],
    ['format', [...source.events.map(e => e.format), ...source.employees.map(e => e.work_format)]],
    ['eventType', source.events.map(e => e.type)],
    ['skillType', source.skills.map(s => s.type)],
    ['skillCategory', source.skills.map(s => s.category)],
    ['proficiency', ['0', '1', '2', '3', '4', '5']],
    ['status', ['completed', 'in_progress', 'dropped', 'no_show', 'declined', 'overdue', 'submitted', 'advisor_review', 'needs_revision', 'rejected', 'approved', 'resource_review', 'policy_review', 'ready', 'evidence_submitted', 'accepted', 'planned', 'available', 'blocked', 'pending', 'open', 'resolved']],
  ] as const;
  for (const [kind, values] of enums) for (const value of new Set(values)) {
    assert.ok(enumLabels[kind][value], `${kind} ${value}`);
    for (const locale of locales) {
      assert.ok(enumLabels[kind][value][locale]?.trim(), `${locale} ${kind} ${value}`);
      assert.equal(enumText(locale, kind, value), enumLabels[kind][value][locale]);
    }
  }
});

test('seed reward and demo copy is translated only while unchanged', () => {
  for (const [id, reward] of Object.entries(rewards)) for (const locale of locales) {
    assert.equal(catalogText(locale, 'reward', id, reward.source[0]), reward.text[locale][0]);
    assert.equal(catalogText(locale, 'reward', id, reward.source[1], 'description'), reward.text[locale][1]);
  }
  for (const [id, fields] of Object.entries(demo)) for (const [field, entry] of Object.entries(fields)) {
    assert.ok(entry);
    for (const locale of locales) assert.equal(catalogText(locale, 'demo', id, entry.source, field as 'title'), entry.text[locale]);
  }
  const seededEvidence = seed().quests.find(q => q.id === 'DEMO_Q_EVIDENCE')?.evidence;
  assert.equal(seededEvidence, demo.DEMO_Q_EVIDENCE.evidence?.source);
  assert.equal(catalogText('kk', 'demo', 'DEMO_Q_EVIDENCE', seededEvidence!, 'evidence'), demo.DEMO_Q_EVIDENCE.evidence?.text.kk);
});

test('unknown and edited/imported content remains original', () => {
  assert.equal(catalogText('kk', 'event', 'IMPORTED_42', 'My own course'), 'My own course');
  assert.equal(catalogText('ru', 'event', 'EV_001', 'Edited title'), 'Edited title');
  assert.equal(catalogText('kk', 'skill', 'SK_SQL', 'Custom SQL description', 'description'), 'Custom SQL description');
  assert.equal(catalogText('en', 'demo', 'DEMO_Q_REVIEW', 'Edited user project'), 'Edited user project');
  assert.equal(catalogText('kk', 'demo', 'DEMO_Q_EVIDENCE', 'Edited user evidence', 'evidence'), 'Edited user evidence');
  assert.equal(catalogText('en', 'role', 'Backend Engineer', 'Custom role name'), 'Custom role name');
  assert.equal(enumText('ru', 'status', 'new_status'), 'new_status');
});
