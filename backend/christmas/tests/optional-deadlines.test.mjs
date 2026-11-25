import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { pendingTasks, taipeiDeliveryDeadline } from '../src/unit-operations.mjs';
import { unitFixture, units } from './unit-fixture.mjs';
import { generateClaimSecret } from '../src/crypto.mjs';

const folder = new URL('../migrations/', import.meta.url);
const migration = file => readFileSync(new URL(file, folder), 'utf8');

test('0022 preserves existing schema objects and supports new campaigns without deadlines', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('PRAGMA foreign_keys=ON');
    for (const file of readdirSync(folder).filter(name => /^00(?:0[1-9]|1\d|2[01])_/.test(name)).sort()) db.exec(migration(file));
    const objects = () => db.prepare("SELECT type,name FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all();
    const previous = objects();
    db.exec(`INSERT INTO Campaigns(id,slug,title,partner_label,status,privacy_version,opens_at,closes_at,claim_deadline_at,gift_due_at)
      VALUES('legacy-test','legacy-test','Legacy','Unit','closed','v1',1,2,3,4);
      INSERT INTO Organisations(id,campaign_id,label,unit_kind) VALUES('legacy-book','legacy-test','Unit','bookhouse');
      INSERT INTO CampaignOperatingRules(campaign_id,bookhouse_id) VALUES('legacy-test','legacy-book');
      BEGIN`);
    db.exec(migration('0022_optional_delivery_deadlines.sql'));
    db.exec('COMMIT');
    assert.deepEqual(objects(), previous);
    assert.equal(db.prepare('SELECT delivery_days FROM CampaignOperatingRules').get().delivery_days, 5);
    db.exec(`INSERT INTO Campaigns(id,slug,title,partner_label,status,privacy_version,opens_at,closes_at)
      VALUES('new-test','new-test','New','Unit','closed','pending',1793462400,1798732799);
      INSERT INTO Organisations(id,campaign_id,label,unit_kind) VALUES('new-book','new-test','Unit','bookhouse');
      INSERT INTO CampaignOperatingRules(campaign_id,bookhouse_id) VALUES('new-test','new-book');`);
    const row = db.prepare(`SELECT c.claim_deadline_at,c.gift_due_at,r.delivery_days,r.reminder_days
      FROM Campaigns c JOIN CampaignOperatingRules r ON r.campaign_id=c.id WHERE c.id='new-test'`).get();
    assert.deepEqual(Object.values(row), [null, null, null, null]);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    db.close();
  }
});

test('no delivery deadline stays pending across the Taipei year boundary', () => {
  const dec31 = Date.parse('2026-12-31T23:59:59+08:00') / 1000;
  assert.equal(taipeiDeliveryDeadline(dec31, null, null), null);
  assert.equal(taipeiDeliveryDeadline(dec31, 1, null), Date.parse('2027-01-01T23:59:59+08:00') / 1000);
  const rows = [
    { id: 'unset', status: 'claimed', gift_due_at: null },
    { id: 'tomorrow', status: 'claimed', gift_due_at: dec31 + 86400 },
    { id: 'past', status: 'claimed', gift_due_at: dec31 - 1 }
  ];
  assert.deepEqual(pendingTasks(rows, dec31 + 1, null).map(row => row.queue),
    ['overdue_pending_confirmation', 'pending', 'pending']);
});

test('closing a campaign blocks a new claim and preserves fulfillment of a claim without a deadline', async () => {
  const fixture = await unitFixture('SQLite', 2, { publicCodes: true });
  try {
    const { core, operations: ops } = fixture;
    const campaign = 'campaign1';
    fixture.db.db.exec('BEGIN');
    fixture.db.db.exec(migration('0022_optional_delivery_deadlines.sql'));
    fixture.db.db.exec('COMMIT');
    ops.caseMode = true;
    ops.manualMode = true;
    await core.statement('UPDATE Campaigns SET claim_deadline_at=NULL,gift_due_at=NULL WHERE id=?', campaign).run();
    await core.statement('UPDATE CampaignOperatingRules SET delivery_days=NULL,reminder_days=NULL WHERE campaign_id=?', campaign).run();
    async function adopt(number) {
      const claim = fixture.input(number);
      const challenge = await ops.emailChallenge(campaign,{purpose:'adopt',claim});
      return ops.online(campaign,{claim,challengeId:challenge.challengeId,code:fixture.email.codes.get(challenge.challengeId),portalSecret:generateClaimSecret()});
    }
    const claim = await adopt(1);
    assert.equal(claim.giftDueAt, null);
    const now = Math.floor(Date.now()/1000);
    await core.statement("UPDATE Campaigns SET status='closed',closes_at=? WHERE id=?",now-1,campaign).run();
    await assert.rejects(adopt(2));
    const key = () => crypto.randomUUID();
    await ops.fulfill(campaign,{kind:'receipt',payload:{claimId:claim.claimId,wishCode:'NX-001',expectedVersion:0,locationCode:'site_miller',quantity:1,note:'',manuallyConfirmed:true}},units.miller,key());
    await ops.fulfill(campaign,{kind:'batch',payload:{organisationId:'org00001',items:[{claimId:claim.claimId,expectedVersion:1}],locationCode:'site_miller',plannedAt:0,note:''}},units.miller,key());
    const batch = await core.statement('SELECT id,created_at FROM HandoffBatches').first();
    const handedAt=batch.created_at;
    await assert.rejects(ops.fulfill(campaign,{kind:'accept',payload:{batchId:batch.id,expectedVersion:0,handedAt:handedAt-1,receivedQuantity:1,checkedItems:[claim.claimId]}},units.bookhouse,key()),{code:'FULFILLMENT_CONFLICT'});
    await ops.fulfill(campaign,{kind:'accept',payload:{batchId:batch.id,expectedVersion:0,handedAt,receivedQuantity:1,checkedItems:[claim.claimId]}},units.bookhouse,key());
    await ops.fulfill(campaign,{kind:'delivery',payload:{claimId:claim.claimId,expectedVersion:2,handoffId:batch.id,deliveredAt:handedAt,manuallyConfirmed:true,note:'Synthetic delivery'}},units.bookhouse,key());
    const completed = await core.statement('SELECT status,gift_due_at FROM Claims WHERE id=?',claim.claimId).first();
    assert.equal(completed.status, 'delivered');
    assert.equal(completed.gift_due_at, null);
    assert.equal((await core.statement('SELECT delivered_at FROM DeliveryConfirmations WHERE claim_id=?',claim.claimId).first()).delivered_at,handedAt);
    assert.equal((await core.statement('SELECT count(*) AS n FROM AuditLogs WHERE resource_id=?',claim.claimId).first()).n>0,true);
  } finally {
    await fixture.close();
  }
});
