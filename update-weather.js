import { browser, storage } from 'hatchable';

export const access = 'scheduler';
export const methods = ['GET', 'POST'];

const locations = {
  'Jammu & Kashmir':'srinagar','Punjab':'chandigarh','Himachal Pradesh':'shimla','Uttarakhand':'dehradun','Rajasthan':'jaipur','Haryana':'chandigarh','Delhi':'delhi','Uttar Pradesh':'lucknow','Bihar':'patna','Sikkim':'gangtok','Assam':'guwahati','Arunachal Pradesh':'itanagar','Gujarat':'ahmedabad','Madhya Pradesh':'bhopal','Jharkhand':'ranchi','West Bengal':'kolkata','Maharashtra':'mumbai','Chhattisgarh':'raipur','Odisha':'bhubaneswar','Telangana':'hyderabad','Andhra Pradesh':'kurnool','Karnataka':'bengaluru','Tamil Nadu':'chennai','Kerala':'thiruvananthapuram','Goa':'panaji','Manipur':'imphal','Mizoram':'aizawl','Tripura':'agartala','Meghalaya':'shillong','Nagaland':'kohima'
};

function clean(s){return String(s||'').replace(/\s+/g,' ').trim();}
function strip(html){return html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();}
function inchToMm(v){const n=parseFloat(String(v).replace(/[^0-9.]/g,''));return Number.isFinite(n)?n*25.4:null;}
function normState(s){return String(s||'').toUpperCase().replace(/&/g,'AND').replace(/[^A-Z0-9]/g,'').replace(/JAMMUKASHMIR/,'JAMMUKASHMIR').replace(/NCTOFDELHI/,'DELHI').replace(/ODISSA/,'ODISHA').replace(/UTTARANCHAL/,'UTTARAKHAND');}
async function fetchImdRainfall(){
  try{
    // The public IMD JSON endpoint can reject cloud/egress IPs. Scrape the same
    // official statewise rainfall page that powers the public IMD map instead.
    const result=await browser.session(async page=>{
      await page.goto('https://mausam.imd.gov.in/imd_latest/contents/index_rainfall_state_new.php',{waitUntil:'domcontentloaded',timeout:20000});
      return await page.evaluate(()=>document.documentElement.outerHTML);
    });
    const html=String(result||'');
    const out={};
    // IMD embeds the state records as escaped JSON-like markup. Normalize the
    // escaped quotes first, then parse title + balloonText pairs. This prevents
    // an empty parser result from silently restoring stale blue map data.
    const normalized=html.replace(/\\\"/g,'\"').replace(/\\n/g,' ');
    const recordRe=/\"title\"\s*:\s*\"([^\"]+)\"[\s\S]*?\"balloonText\"\s*:\s*\"([^\"]*Actual\s*:\s*[0-9.]+\s*mm[^\"]*)\"/gi;
    let m;
    while((m=recordRe.exec(html))){
      const state=clean(m[1]);
      const raw=m[2].replace(/\\\\\\//g,'/').replace(/<[^>]+>/g,' ');
      const actualMatch=raw.match(/Actual\\s*:\\s*([0-9.]+)\\s*mm/i);
      const normalMatch=raw.match(/Normal\\s*:\\s*([0-9.]+)\\s*mm/i);
      const departureMatch=raw.match(/Departure\\s*:\\s*([-+0-9]+)%/i);
      if(!state||!actualMatch)continue;
      const key=normState(state);
      if(!key||out[key])continue;
      const actual=+actualMatch[1], normal=normalMatch?+normalMatch[1]:null;
      out[key]={state, date:new Date().toISOString().slice(0,10), dailyActual:actual, dailyNormal:normal,
        dailyDeparture:departureMatch?departureMatch[1]+'%':null,
        dailyCategory:actual>=204.5?'Extremely Heavy':actual>=115.6?'Very Heavy':actual>=64.5?'Heavy':actual>=15.6?'Moderate':actual>=2.5?'Light':'Very Light'};
    }
    if(Object.keys(out).length<20)throw new Error('IMD statewise page returned incomplete rainfall data');
    return {ok:true,data:out,checkedAt:new Date().toISOString(),source:'IMD official statewise rainfall page'};
  }catch(e){return {ok:false,data:{},error:String(e),checkedAt:new Date().toISOString(),source:'IMD official statewise rainfall page'};}
}
function parseWeather(html, city){
  const text=strip(html);
  const rainPos=text.indexOf('Amount of Rain');
  const rainChunk=rainPos>=0?text.slice(rainPos,rainPos+1800):'';
  const amounts=[...rainChunk.matchAll(/(\d+(?:\.\d+)?)\s*"/g)].map(m=>inchToMm(m[1])).filter(v=>v!==null);
  const popPos=text.indexOf('Probability of Precipitation');
  const popChunk=popPos>=0?text.slice(popPos,popPos+1100):'';
  const pops=[...popChunk.matchAll(/(\d{1,3})%/g)].map(m=>+m[1]).filter(n=>n>=0&&n<=100);
  const humidity=text.match(/Humidity:\s*(\d{1,3})%/i);
  const temp=text.match(/Now\s+([0-9]+)\s*°F/i);
  const now=text.match(/Now\s+([^.]{1,100})\s+[0-9]+\s*°F/i);
  if(rainPos<0 || (!amounts.length && !temp && !humidity && !pops.length)) throw new Error('Timeanddate page did not expose a parseable weather snapshot');
  const rain48=amounts.slice(0,7).reduce((a,b)=>a+b,0);
  return {city,rain48:Number(rain48.toFixed(2)),pop:pops.length?Math.max(...pops):null,humidity:humidity?+humidity[1]:null,temp:temp?temp[1]+'°F':'—',condition:clean(now?.[1]||'Current conditions available'),fetchedAt:new Date().toISOString()};
}

async function fetchImd7DayForecast(){
  try{
    const days={};
    const pages=await Promise.all(Array.from({length:7},(_,i)=>i+1).map(async day=>{
      const html=await (await fetch(`https://mausam.imd.gov.in/responsive/7d_subdivisional_rf.php?msg=Day_${day}`)).text();
      const normalized=html.replace(/\\\\/g,'\\').replace(/\\"/g,'"');
      const re=/"title"\s*:\s*"([^"]+)"[\s\S]*?"color"\s*:\s*"(#[0-9A-Fa-f]+)"[\s\S]*?"balloonText"\s*:\s*"([^"]*)"/g;
      const areas=[]; let m;
      while((m=re.exec(normalized))&&areas.length<40){
        const txt=m[3].replace(/<[^>]+>/g,' ').replace(/\\\\\//g,'/').replace(/\s+/g,' ').trim();
        const dist=/\b(Widespread|Fairly Widespread|Scattered|Isolated|Dry)\b/i.exec(txt)?.[1]||'Unknown';
        const pct=txt.match(/Stations\s*\[([^\]]+)\]%/i)?.[1]||'0-0';
        const nums=pct.match(/(\d+)\s*-\s*(\d+)/); const coverage=nums?(+nums[1]+ +nums[2])/2:dist==='Widespread'?88:dist==='Fairly Widespread'?63:dist==='Scattered'?38:dist==='Isolated'?13:0;
        const severity=dist==='Widespread'?4:dist==='Fairly Widespread'?3:dist==='Scattered'?2:dist==='Isolated'?1:0;
        areas.push({name:m[1].trim(),color:m[2],distribution:dist,coverage,severity});
      }
      return [day,areas];
    }));
    pages.forEach(([day,areas])=>days[day]=areas);
    if(Object.values(days).some(a=>a.length<20))throw new Error('IMD 7-day rainfall forecast returned incomplete subdivision data');
    return {ok:true,days,checkedAt:new Date().toISOString(),source:'IMD official 7-day subdivision rainfall forecast'};
  }catch(e){return {ok:false,days:{},checkedAt:new Date().toISOString(),error:String(e),source:'IMD official 7-day subdivision rainfall forecast'};}
}

const forecastStateMap={
'Jammu & Kashmir':['Jammu and Kashmir and Ladakh'],'Punjab':['Punjab'],'Himachal Pradesh':['Himachal Pradesh'],'Uttarakhand':['Uttarakhand'],'Rajasthan':['West Rajasthan','East Rajasthan'],'Haryana':['Haryana, Chd & Delhi'],'Delhi':['Haryana, Chd & Delhi'],'Uttar Pradesh':['East Uttar Pradesh','West Uttar Pradesh'],'Bihar':['Bihar'],'Sikkim':['S.H. West Bengal & Sikkim'],'Assam':['Assam & Mehghalaya'],'Arunachal Pradesh':['Arunachal Pradesh'],'Gujarat':['Gujrat Region','Saurashtra & Kutch'],'Madhya Pradesh':['West Madhya Pradesh','East Madhya Pradesh'],'Jharkhand':['Jharkhand'],'West Bengal':['Gangetic West Bengal','S.H. West Bengal & Sikkim'],'Maharashtra':['Konkan & Goa','Madhya Maharashtra','Marathwada','Vidarbha'],'Chhattisgarh':['Chattisgarh'],'Odisha':['Odisha'],'Telangana':['Telangana'],'Andhra Pradesh':['Coastal Andhra Pradesh','Rayalaseema'],'Karnataka':['Costal Karnataka','North Interior Karnataka','South Interior Karnataka'],'Tamil Nadu':['Tamilnadu & Puducherry'],'Kerala':['Kerala'],'Goa':['Konkan & Goa'],'Manipur':['N. M. M. & T.'],'Mizoram':['N. M. M. & T.'],'Tripura':['N. M. M. & T.'],'Meghalaya':['Assam & Mehghalaya'],'Nagaland':['N. M. M. & T.']
};
function buildStateForecast(imd){
  const out={};
  Object.entries(forecastStateMap).forEach(([state,subs])=>{
    out[state]={};
    for(let d=1;d<=7;d++){
      const areas=imd.days[d]||[]; const matches=areas.filter(a=>subs.includes(a.name));
      const best=matches.reduce((b,a)=>!b||a.severity>b.severity?a:b,null);
      out[state][d]=best?{severity:best.severity,distribution:best.distribution,coverage:best.coverage,color:best.color,subdivisions:matches.map(x=>x.name),source:imd.source}:null;
    }
  });
  return out;
}

export default async function(req,res){
  const entries=await Promise.all(Object.entries(locations).map(async ([state,city])=>{
    try{
      const result=await browser.session(async page=>{
        await page.goto(`https://www.timeanddate.com/weather/india/${city}`,{waitUntil:'domcontentloaded'});
        return await page.evaluate(()=>({html:document.documentElement.outerHTML}));
      });
      return [state,parseWeather(result.html,city)];
    }catch(e){
      return [state,{city,rain48:null,pop:null,humidity:null,temp:'—',condition:'Source unavailable',error:String(e),fetchedAt:new Date().toISOString()}];
    }
  }));
  const imd=await fetchImdRainfall();
  const imdForecast=await fetchImd7DayForecast();
  const stateForecast=imdForecast.ok?buildStateForecast(imdForecast):{};
  let previous={stateWeather:{},stateForecast:{}};
  try{const prev=await storage.get('weather/timeanddate-india-latest.json');if(prev?.buffer)previous=JSON.parse(Buffer.from(prev.buffer).toString('utf8'));}catch(e){}
  const stateData=Object.fromEntries(entries);
  Object.entries(stateData).forEach(([state,w])=>{const key=normState(state),ir=imd.data[key],old=previous.stateWeather?.[state]||{},live=Number.isFinite(w.rain48);stateData[state]={...old,...w,rain48:live?w.rain48:(old.rain48??null),pop:live?w.pop:(old.pop??null),humidity:live?w.humidity:(old.humidity??null),temp:live?w.temp:(old.temp??'—'),condition:live?w.condition:(old.condition??'Timeanddate unavailable'),timeanddateLive:live||old.timeanddateLive===true,timeanddateFetchedAt:live?w.fetchedAt:(old.timeanddateFetchedAt??null),imdDailyActual:Number.isFinite(ir?.dailyActual)?ir.dailyActual:(Number.isFinite(old.imdDailyActual)?old.imdDailyActual:null),imdDailyNormal:Number.isFinite(ir?.dailyNormal)?ir.dailyNormal:(Number.isFinite(old.imdDailyNormal)?old.imdDailyNormal:null),imdDailyDeparture:ir?.dailyDeparture??old.imdDailyDeparture??null,imdDailyCategory:ir?.dailyCategory??old.imdDailyCategory??null,imdDate:ir?.date??old.imdDate??null};});
  const snapshot={source:'Live IMD statewise rainfall + IMD 7-day forecast + Timeanddate India Weather where reachable',stateWeather:stateData,stateForecast,imdRainfall:imd.data,imdCheckedAt:imd.checkedAt,imdForecast:imdForecast.days,imdForecastCheckedAt:imdForecast.checkedAt,imdForecastAvailable:imdForecast.ok,timeanddateLiveStates:Object.values(stateData).filter(x=>x.timeanddateLive).length,checkedAt:new Date().toISOString(),note:'Current observed rainfall comes from official IMD statewise rainfall. Future Day +1 to +7 rainfall activity comes from IMD 7-day subdivision rainfall forecast and is represented as forecast station-coverage/activity, not invented millimetres. Timeanddate remains a secondary location-level current-weather signal when reachable. Historical days are only shown when an observed historical snapshot is available; the dashboard does not fabricate past rainfall.'};
  await storage.put('weather/timeanddate-india-latest.json',Buffer.from(JSON.stringify(snapshot)),'application/json');
  res.json({ok:true,checkedAt:snapshot.checkedAt,states:Object.keys(snapshot.stateWeather).length});
}