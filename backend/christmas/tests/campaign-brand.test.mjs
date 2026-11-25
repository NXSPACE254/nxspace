import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {initialBrand,publicCampaignBrand,validateCampaignBrand} from '../src/campaign-brand.mjs';
import {brandImageIds,readBrandImage,uploadBrandImage} from '../src/campaign-brand-media.mjs';
import {contentEditor} from '../src/case-workspace.mjs';
import {unitFixture,admin,units} from './unit-fixture.mjs';
import {seedDirectPreview} from './direct-preview.mjs';
import {migrationStatements} from './migration-loader.mjs';
import {information,campaignTitleMarkup,campaignDateRange} from '../../../js/pages/christmas.js';
import {christmasContent} from '../../../js/data/christmas-content.js';

test('campaign heading supports semantic and editor-defined line breaks', () => {
  assert.equal(campaignTitleMarkup('台東的聖誕願望樹'),'台東的<br>聖誕願望樹');
  assert.equal(campaignTitleMarkup('第一行\n<script>'),'第一行<br>&lt;script&gt;');
  assert.equal(campaignDateRange('2026-11-01','2027-01-01'),'2026/11/01 – 2027/01/01');
});

test('brand settings accept scoped, ordered organization content', () => {
  const brand=structuredClone(initialBrand);
  brand.organizations.reverse();
  brand.organizations[0].enabled=false;
  brand.organizations[1].description='<b>Escaped text</b>';
  assert.doesNotThrow(()=>validateCampaignBrand(brand));
  const published=publicCampaignBrand(brand);
  assert.equal(published.organizations.length,6);
  assert.equal(published.organizations[0].name,brand.organizations[1].name);
  const markup=information({...christmasContent,brand:published},{seasonal:true});
  assert.match(markup,/主辦單位/);
  assert.match(markup,/協辦單位/);
  assert.match(markup,/活動協力廠商/);
  assert.match(markup,/&lt;b&gt;Escaped text&lt;\/b&gt;/);
  assert.ok(!markup.includes(brand.organizations[0].name));
});

test('brand settings reject unsafe URLs and operational fields', () => {
  for(const website of ['javascript:alert(1)','data:text/html,example','//example.invalid','https://user@example.invalid','https://example.invalid\\path']){
    const brand=structuredClone(initialBrand);
    brand.organizations[0].website=website;
    assert.throws(()=>validateCampaignBrand(brand),{code:'INVALID_CAMPAIGN_BRAND'});
  }
  assert.throws(()=>validateCampaignBrand({...initialBrand,claimDeadline:123}),{code:'INVALID_CAMPAIGN_BRAND'});
});

test('isolated D1 schema and R2 enforce image scope and publish only brand settings', {skip:!process.env.NXSPACE_MINIFLARE_MODULE}, async()=>{
  const {Miniflare,convertV4MiniflareOptions}=createRequire(import.meta.url)(process.env.NXSPACE_MINIFLARE_MODULE);
  const options={script:'export default {fetch(){return new Response(null,{status:403})}}',modules:true,r2Buckets:['BRAND'],host:'127.0.0.1',port:0,cf:false};
  const runtime=new Miniflare(convertV4MiniflareOptions?.(options)??options);
  const fixture=await unitFixture('D1',1);
  const {core,operations:ops}=fixture,campaign='campaign1';
  try{
    const migration=await readFile(new URL('../migrations/0027_campaign_brand_media.sql',import.meta.url),'utf8');
    await fixture.db.batch(migrationStatements(migration).map(sql=>fixture.db.prepare(sql)));
    ops.directMode=true;
    await seedDirectPreview(fixture);
    const bucket=await runtime.getR2Bucket('BRAND'),principal=await ops.context(campaign,admin,'staff.manage');
    const webp=Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAA=','base64');
    const request=(body,type='image/webp')=>new Request('https://example.invalid/upload',{method:'POST',headers:{'Content-Type':type},body});
    await assert.rejects(uploadBrandImage(core,campaign,principal,bucket,request('other')),{code:'BRAND_IMAGE_FORMAT'});
    await assert.rejects(uploadBrandImage(core,campaign,principal,bucket,request(webp),1),{code:'BRAND_MEDIA_LIMIT'});
    const image=await uploadBrandImage(core,campaign,principal,bucket,request(webp));
    assert.deepEqual([image.width,image.height],[1,1]);
    const preview=await readBrandImage(core,campaign,bucket,image.id,false);
    assert.equal(preview.headers.get('Cache-Control'),'private, no-store');
    assert.deepEqual(Buffer.from(await preview.arrayBuffer()),webp);
    await assert.rejects(readBrandImage(core,'other-campaign',bucket,image.id,false),{code:'NOT_FOUND'});
    const record=await contentEditor(ops,campaign,null,admin);
    const brand=structuredClone(initialBrand);
    brand.organizations[1].enabled=false;
    brand.organizations[1].logo={...image,alt:'未公開的圖片'};
    assert.deepEqual(brandImageIds(brand,{publicOnly:true}),[]);
    brand.hero={...image,alt:'測試的主視覺'};
    const save={action:'save',expectedVersion:record.draft.version,content:{...record.published.content,headline:'草稿未發布文字',brand}};
    const opts={websiteOnly:true,brandMediaBucket:bucket};
    await assert.rejects(contentEditor(ops,campaign,save,units.bookhouse,opts),{status:403});
    const draft=await contentEditor(ops,campaign,save,admin,opts);
    const publish={action:'publishBrand',expectedVersion:draft.draft.version,expectedPublishedVersion:record.published.version};
    const updated=await contentEditor(ops,campaign,publish,admin,opts);
    assert.equal(updated.published.content.headline,record.published.content.headline);
    assert.deepEqual(updated.published.content.faq,record.published.content.faq);
    assert.deepEqual(updated.published.content.brand,brand);
    assert.equal(updated.draft.status,'draft');
    await assert.rejects(contentEditor(ops,campaign,publish,admin,opts),{code:'CONTENT_CONFLICT'});
  }finally{
    await fixture.close();
    await runtime.dispose();
  }
});
