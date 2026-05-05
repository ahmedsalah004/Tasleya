#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const MAP_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';
const DEFAULT_EXPORT_PATHS = [
  'data/map-game/questions-export.csv',
  'data/map-game/questions-export.json',
  'data/map-game/questions-export.xlsx'
];
const DEFAULT_MAP_EXPORT_PATHS = [
  'data/map-game/countries.geojson'
];

const REQUIRED_SMALL = [
  ['KI','Kiribati'],['TV','Tuvalu'],['PW','Palau'],['NR','Nauru'],['MH','Marshall Islands'],['FM','Micronesia'],
  ['TO','Tonga'],['WS','Samoa'],['VU','Vanuatu'],['MV','Maldives'],['SC','Seychelles'],['MU','Mauritius'],
  ['KM','Comoros'],['MT','Malta'],['BH','Bahrain'],['SG','Singapore'],['AG','Antigua and Barbuda'],
  ['KN','Saint Kitts and Nevis'],['LC','Saint Lucia'],['VC','Saint Vincent and the Grenadines'],['GD','Grenada']
];
const FEATURE_REMAPS = new Map([['IL', 'PS']]);

const ALPHA3_TO_ALPHA2 = new Map([
['USA','US'],['GBR','GB'],['RUS','RU'],['KOR','KR'],['PRK','KP'],['IRN','IR'],['SYR','SY'],['TZA','TZ'],['BOL','BO'],['VEN','VE'],['MDA','MD'],['LAO','LA'],['VNM','VN'],['CZE','CZ'],['SWZ','SZ'],['CPV','CV'],['CIV','CI'],['PSE','PS'],['FSM','FM'],['KNA','KN'],['VCT','VC'],['ATG','AG'],['LCA','LC'],['GRD','GD'],['MDV','MV'],['SYC','SC'],['MUS','MU'],['COM','KM'],['MLT','MT'],['BHR','BH'],['SGP','SG'],['KIR','KI'],['TUV','TV'],['PLW','PW'],['NRU','NR'],['MHL','MH'],['TON','TO'],['WSM','WS'],['VUT','VU'],['TLS','TL']
]);
const NAME_ALIASES = new Map([
['unitedstatesofamerica','US'],['usa','US'],['unitedstates','US'],['unitedkingdom','GB'],['uk','GB'],['britain','GB'],['russianfederation','RU'],['southkorea','KR'],['korearepublicof','KR'],['northkorea','KP'],['koreadpr','KP'],['iranislamicrepublicof','IR'],['syrianarabrepublic','SY'],['unitedrepublicoftanzania','TZ'],['boliviaplurinationalstateof','BO'],['venezuelabolivarianrepublicof','VE'],['republicofmoldova','MD'],['laopdr','LA'],['vietnam','VN'],['czechrepublic','CZ'],['czechia','CZ'],['swaziland','SZ'],['eswatini','SZ'],['caboverde','CV'],['capeverde','CV'],['cotedivoire','CI'],['ivorycoast','CI'],['stateofpalestine','PS'],['micronesiafederatedstatesof','FM'],['stkittsandnevis','KN'],['stvincentandthegrenadines','VC']
]);

const args = process.argv.slice(2);
const exportArg = args.find(a => a.startsWith('--export='))?.split('=')[1];
const mapArg = args.find(a => a.startsWith('--map='))?.split('=')[1];

function nName(v='') {return String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,'and').replace(/[^a-z0-9]+/g,'');}
function normCode(v='') {
  const raw = String(v).trim().toUpperCase();
  if (!raw) return '';
  if (/^[A-Z]{2}$/.test(raw)) return raw;
  if (ALPHA3_TO_ALPHA2.has(raw)) return ALPHA3_TO_ALPHA2.get(raw);
  return '';
}

function parseCsv(text){
  const rows=[]; let i=0, field='', row=[], q=false;
  while(i<text.length){const c=text[i];
    if(q){ if(c==='"' && text[i+1]==='"'){field+='"'; i+=2; continue;} if(c==='"'){q=false; i++; continue;} field+=c; i++; continue; }
    if(c==='"'){q=true; i++; continue;} if(c===','){row.push(field); field=''; i++; continue;} if(c==='\n'){row.push(field); rows.push(row); row=[]; field=''; i++; continue;} if(c==='\r'){i++; continue;} field+=c; i++; }
  if(field.length||row.length){row.push(field); rows.push(row);} return rows;
}

async function loadMap(){
  let j = null;
  const localMapPath = mapArg || DEFAULT_MAP_EXPORT_PATHS.find(p => fs.existsSync(p)) || '';
  if (localMapPath) {
    j = JSON.parse(fs.readFileSync(localMapPath, 'utf8'));
    console.log(`Loaded map GeoJSON from ${localMapPath}`);
  } else {
    const r = await fetch(MAP_URL);
    if(!r.ok) throw new Error(`Failed map fetch: ${r.status}`);
    j = await r.json();
    console.log(`Loaded map GeoJSON from ${MAP_URL}`);
  }
  return j.features.map(f=>{
    const p=f.properties||{};
    const cands=[p.country_code,p.countryCode,p.iso_a2,p.ISO_A2,p.iso2,p.ISO_A3,p.iso_a3,p.id].filter(Boolean);
    let code='';
    for(const c of cands){ code = normCode(c); if(code) break; }
    let alias=false;
    if(!code){ const mapped = NAME_ALIASES.get(nName(p.name||'')); if(mapped){ code=mapped; alias=true; }}
    return {name:p.name||'', code, alias};
  }).filter(x=>x.code);
}

function detectExportPath(){
  if(exportArg) return exportArg;
  return DEFAULT_EXPORT_PATHS.find(p=>fs.existsSync(p)) || '';
}

function loadQuestions(pth){
  if(!pth) return {rows:[], note:'No local export found.'};
  const ext = path.extname(pth).toLowerCase();
  if(ext==='.xlsx') return {rows:[], note:`XLSX file found at ${pth} but XLSX parsing is not bundled. Export as CSV and rerun.`};
  const raw = fs.readFileSync(pth,'utf8');
  if(ext==='.json'){
    const obj=JSON.parse(raw); const arr=Array.isArray(obj)?obj:(obj.questions||[]); return {rows:arr, note:`Loaded ${arr.length} rows from ${pth}`};
  }
  const rows=parseCsv(raw); const headers=rows.shift().map(h=>h.trim());
  const data=rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]||''])));
  return {rows:data, note:`Loaded ${data.length} rows from ${pth}`};
}

function qCode(row){
  const picks=['targetCountryCode','target_country_code','countryCode','country_code','iso2','iso_a2','ISO_A2','iso3','iso_a3','ISO_A3'];
  for(const k of picks){ const c=normCode(row[k]); if(c) return {code:c, by:k, alias:false}; }
  const name=row.targetCountryNameEn||row.target_country_name_en||row.countryNameEn||row.country_name_en||'';
  const alias=NAME_ALIASES.get(nName(name));
  return {code:alias||'', by:alias?'name-alias':'', alias:Boolean(alias)};
}

(async()=>{
  console.log('Map Country Coverage Audit');
  let map;
  try {
    map = await loadMap();
  } catch (error) {
    console.log(`Could not load map source automatically: ${error.message}`);
    console.log('Place a GeoJSON copy at data/map-game/countries.geojson or pass --map=/path/to/countries.geojson');
    process.exit(2);
  }
  const mapCodes=new Set(map.map(m=>m.code));
  const expPath=detectExportPath();
  const q=loadQuestions(expPath);
  console.log(q.note);
  if(!q.rows.length){
    console.log('\nPlace a CSV export at data/map-game/questions-export.csv then rerun:');
    console.log('  node tools/map-game-country-audit.mjs');
    process.exit(2);
  }
  const questionRows=q.rows.map((r,idx)=>({idx:idx+1,...qCode(r),name:r.targetCountryNameEn||r.target_country_name_en||r.countryNameEn||r.country_name_en||''}));
  const playable=questionRows.filter(r=>r.code);
  const qCodes=new Set(playable.map(r=>r.code));
  const matched=[...mapCodes].filter(c=>qCodes.has(c));
  const missingOnQuestions=[...mapCodes]
    .filter(c=>!qCodes.has(c))
    .filter(c=>!(FEATURE_REMAPS.has(c) && qCodes.has(FEATURE_REMAPS.get(c))));
  const missingOnMap=[...qCodes].filter(c=>!mapCodes.has(c));
  const dupCodes=Object.entries(playable.reduce((a,r)=>(a[r.code]=(a[r.code]||0)+1,a),{})).filter(([,n])=>n>1);
  const dupNames=Object.entries(playable.reduce((a,r)=>{const k=nName(r.name); if(k) a[k]=(a[k]||0)+1; return a;},{})).filter(([,n])=>n>1);
  const aliasOnly=questionRows.filter(r=>r.alias);

  console.log(`\nTotal map countries detected: ${mapCodes.size}`);
  console.log(`Total playable question countries detected: ${qCodes.size}`);
  console.log(`Countries on map with matching question data: ${matched.length}`);
  console.log(`Countries on map missing question data: ${missingOnQuestions.length}`);
  console.log(`Question-data countries not on map: ${missingOnMap.length}`);
  console.log(`Duplicate country codes in question data: ${dupCodes.length}`);
  console.log(`Duplicate country names in question data: ${dupNames.length}`);
  console.log(`Suspicious alias-only matches: ${aliasOnly.length}`);
  if (FEATURE_REMAPS.size) {
    console.log('\\nRemapped map features:');
    for (const [from,to] of FEATURE_REMAPS.entries()) {
      console.log(` - ${from} -> ${to}`);
    }
  }

  console.log('\nRequired small-country checks:');
  let reqMissing=[];
  for(const [code,name] of REQUIRED_SMALL){
    const ok=qCodes.has(code);
    console.log(` - ${name} (${code}): ${ok?'OK':'MISSING'}`);
    if(!ok) reqMissing.push(`${name} (${code})`);
  }

  if(missingOnQuestions.length){
    console.log('\nMap countries missing question data (first 60):');
    console.log(missingOnQuestions.slice(0,60).join(', '));
  }
  if(missingOnMap.length){
    console.log('\nQuestion countries not found on map:');
    console.log(missingOnMap.join(', '));
  }

  const fullCoverage = missingOnQuestions.length===0 && reqMissing.length===0;
  console.log(`\nFull all-country coverage: ${fullCoverage ? 'YES' : 'NO'}`);
  if(!fullCoverage){
    console.log('Audit failed: missing required playable coverage.');
    process.exit(1);
  }
})();
