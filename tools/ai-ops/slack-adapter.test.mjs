import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {normalizeCleaningEvent} from './slack-adapter.mjs';

const sign=(payload,opts={})=>{
  const rawBody=JSON.stringify(payload),signingSecret='test-only-secret';
  const timestamp=String(Math.floor(Date.now()/1000));
  const signature='v0='+createHmac('sha256',signingSecret).update('v0:'+timestamp+':'+rawBody).digest('hex');
  return {headers:{'x-slack-request-timestamp':timestamp,'x-slack-signature':signature},rawBody,signingSecret,allowedTeamId:'T111111',allowedChannelIds:['C222222'],allowedUserIds:['U333333'],...opts};
};
const base=(msg='수유 201호 청소완료')=>({
  type:'event_callback',team_id:'T111111',event_id:'Ev123456',
  event:{type:'message',channel:'C222222',user:'U333333',text:msg}
});
test('request signature mandatory',()=>{
  const x=sign(base());x.headers['x-slack-signature']='v0='+'0'.repeat(64);
  assert.equal(normalizeCleaningEvent(x).reason,'invalid_slack_signature');
});
test('url verification with signed payload',()=>{
  const x=normalizeCleaningEvent(sign({type:'url_verification',team_id:'T111111',challenge:'testchallenge'}));
  assert.equal(x.status,'challenge');assert.equal(x.challenge,'testchallenge');
});
test('only mapped Slack team can issue events',()=>{
  const x=normalizeCleaningEvent(sign({...base(),team_id:'T999999'}));
  assert.equal(x.reason,'workspace_not_allowed');
});
test('only allowed channel',()=>{
  const p=base();p.event.channel='C999999';
  assert.equal(normalizeCleaningEvent(sign(p)).reason,'channel_not_allowed');
});
test('only approved cleaner',()=>{
  const p=base();p.event.user='U999999';
  assert.equal(normalizeCleaningEvent(sign(p)).reason,'user_not_allowed');
});
test('ignore bot event',()=>{
  const p=base();p.event.bot_id='B111111';
  assert.equal(normalizeCleaningEvent(sign(p)).reason,'not_user_message');
});
test('cleaning message is draft, never executed',()=>{
  const x=normalizeCleaningEvent(sign(base()));
  assert.equal(x.status,'draft_requires_task_link_and_inspection');
  assert.equal(x.room,'201');assert.equal(x.reportedCompleted,true);
  assert.equal(x.inspectionStatus,'not_verified');assert.equal(x.externalActionTaken,false);
});
test('issues flagged for human review',()=>{
  const x=normalizeCleaningEvent(sign(base('201호 청소완료 누수 발생')));
  assert.equal(x.potentialIssue,true);assert.equal(x.externalActionTaken,false);
});
test('image references are IDs not private download URLs',()=>{
  const p=base();p.event.subtype='file_share';
  p.event.files=[{id:'F123456',mimetype:'image/jpeg',url_private:'https://files.slack.com/SECRET'},{id:'F234567',mimetype:'application/pdf'},{id:'F123456',mimetype:'image/jpeg'}];
  const x=normalizeCleaningEvent(sign(p));
  assert.deepEqual(x.photoFileIds,['F123456']);
  assert.equal(JSON.stringify(x).includes('SECRET'),false);
});
test('message without supported room requires linking',()=>{
  const x=normalizeCleaningEvent(sign(base('청소완료')));
  assert.equal(x.status,'needs_manual_link');
});
test('aborted or edited message ignored',()=>{
  const p=base();p.event.subtype='message_changed';
  assert.equal(normalizeCleaningEvent(sign(p)).reason,'not_user_message');
});
