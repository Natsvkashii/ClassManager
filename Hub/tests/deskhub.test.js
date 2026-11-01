// node --test Hub/tests — DeskHub rules (Hub/HUB_FORMAT.md)
const test = require('node:test');
const assert = require('node:assert');
const H = require('../js/deskhub.js');

test('classdesk publishes, studydesk sees it as available, links it, and it stops being available', () => {
  let hub = H.empty();
  hub = H.publish(hub, 'classdesk', [{ localId: 'mod-1', classDeskRef: { courseId: 'crs-1', levelId: 'lvl-1', moduleId: 'mod-1' }, name: 'Sera › A1', level: 'A1',
    students: [{ localId: 'st-a', firstName: 'Mario', lastName: 'Rossi', email: 'mario@x.it' }] }]);
  assert.equal(hub.groups.length, 1);
  assert.equal(H.available(hub, 'studydesk').length, 1);
  assert.equal(H.available(hub, 'classdesk').length, 0);
  const g = hub.groups[0];
  hub = H.link(hub, 'studydesk', g.id, { localGroupId: 'grp-9', studentLocalIds: { [g.studentIds[0]]: 'stu-1' } });
  assert.equal(H.available(hub, 'studydesk').length, 0);
  assert.equal(H.linked(hub, 'studydesk').length, 1);
  assert.equal(hub.students[0].refs.studydesk, 'stu-1');
});

test('the same student in both apps is one hub record (matched by email)', () => {
  let hub = H.publish(H.empty(), 'classdesk', [{ localId: 'm', classDeskRef: { courseId: 'c', levelId: 'l', moduleId: 'm' }, name: 'G', level: 'A1',
    students: [{ localId: 'st-a', firstName: 'Anna', lastName: 'B', email: 'Anna@x.it' }] }]);
  hub = H.publish(hub, 'studydesk', [{ localId: 'grp-1', name: 'Mio', level: 'A2', students: [{ localId: 'stu-7', firstName: 'Anna', lastName: 'B', email: 'anna@x.it' }] }]);
  assert.equal(hub.students.length, 1);
  assert.deepEqual(hub.students[0].refs, { classdesk: 'st-a', studydesk: 'stu-7' });
  assert.equal(hub.groups.length, 2);
});

test('removing an owned group removes it from the hub, others are kept', () => {
  let hub = H.publish(H.empty(), 'studydesk', [{ localId: 'grp-1', name: 'A', level: 'A1', students: [] }]);
  hub = H.publish(hub, 'classdesk', [{ localId: 'm', classDeskRef: { courseId: 'c', levelId: 'l', moduleId: 'm' }, name: 'B', level: 'A1', students: [] }]);
  hub = H.publish(hub, 'studydesk', []);
  assert.deepEqual(hub.groups.map((g) => g.owner), ['classdesk']);
});

test('publishing the same data twice does not change updatedAt', () => {
  const groups = [{ localId: 'grp-1', name: 'A', level: 'A1', students: [{ localId: 's', firstName: 'X', lastName: 'Y', email: '' }] }];
  const h1 = H.publish(H.empty(), 'studydesk', groups);
  const h2 = H.publish(h1, 'studydesk', groups);
  assert.equal(h2.updatedAt, h1.updatedAt);
});
