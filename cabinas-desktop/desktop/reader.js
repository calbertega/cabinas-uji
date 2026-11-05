async function readUjiCalendar(day, knownRooms, targetRoomId) {
  // Read-only public Alma availability calendar client. No credentials or dependencies.
// Verified against UJI's shipped 898A559C8671CE75A54120BE046E912A GWT permutation.
const MODULE = 'https://cataleg.uji.es/view/calendar/';
const POLICY = 'EFE8250E3F9D3C7EA06131F4299E56F2';
const PERMUTATION = '898A559C8671CE75A54120BE046E912A';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789$_';
const LONG = 'java.lang.Long/4227064769';
const STRING = 'java.lang.String/2004016611';

function encodeGwtLong(value) {
  let n = BigInt(value);
  if (n < 0n || n > 9223372036854775807n) throw new Error('Invalid Alma identifier');
  let result = '';
  do { result = ALPHABET[Number(n & 63n)] + result; n >>= 6n; } while (n);
  return result;
}

function decodeGwtLong(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9$_]{1,11}$/.test(value)) throw new Error('Invalid GWT date');
  let n = 0n;
  for (const character of value) n = (n << 6n) | BigInt(ALPHABET.indexOf(character));
  n = BigInt.asIntN(64, n);
  const number = Number(n);
  if (!Number.isSafeInteger(number)) throw new Error('Unsafe GWT date');
  return number;
}

function availabilityRequest(room, userId) {
  const mmsId = String(room.mmsId);
  const itemId = String(room.itemId);
  const libraryId = String(room.libraryId || '188250260006336');
  if (![mmsId, itemId, libraryId].every(id => /^\d{1,19}$/.test(id))) throw new Error('Missing Alma room identifiers');
  const strings = [MODULE, POLICY, 'com.exlibris.core.infra.calendar.client.api.CalendarService',
    'getAvailabilityCalendar', LONG, STRING, itemId, '', '34CVA_UJI'];
  const tokens = [1,2,3,4,7,5,6,6,5,5,6,6,
    5, encodeGwtLong(mmsId), 7, 8,
    5, encodeGwtLong(userId), // Context stays only inside this UJI tab.
    5, encodeGwtLong(libraryId), 8, 9];
  return {
    url: MODULE + 'calendarService',
    options: {
      method: 'POST',
      headers: {'Content-Type': 'text/x-gwt-rpc; charset=utf-8',
        'X-GWT-Module-Base': MODULE, 'X-GWT-Permutation': PERMUTATION},
      body: `7|0|${strings.length}|${strings.join('|')}|${tokens.join('|')}|`,
    },
  };
}

function textFromAlma(html) {
  return String(html ?? '').replace(/<[^>]*>/g, '').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();
}

function parseAvailability(responseText) {
  if (typeof responseText !== 'string' || responseText.length > 2_000_000) throw new Error('Invalid calendar response');
  if (!responseText.startsWith('//OK')) throw new Error('The official calendar did not return availability');
  // GWT's response for these types is a JSON array. Never execute the response.
  const values = JSON.parse(responseText.slice(4));
  if (!Array.isArray(values) || values.pop() !== 7 || values.pop() !== 0) throw new Error('Unsupported calendar protocol');
  const strings = values.pop();
  if (!Array.isArray(strings) || !strings.every(s => typeof s === 'string')) throw new Error('Invalid calendar string table');
  const references = [];
  const pop = () => { if (!values.length) throw new Error('Truncated calendar'); return values.pop(); };
  const readString = () => {
    const index = pop();
    if (index === 0) return null;
    if (!Number.isInteger(index) || index < 1 || index > strings.length) throw new Error('Invalid calendar string');
    return strings[index - 1];
  };
  const readObject = (depth = 0) => {
    if (depth > 20) throw new Error('Calendar nesting too deep');
    const index = pop();
    if (!Number.isInteger(index)) throw new Error('Invalid calendar object');
    if (index === 0) return null;
    if (index < 0) {
      const reference = references[-index - 1];
      if (reference === undefined) throw new Error('Invalid calendar reference');
      return reference;
    }
    const signature = strings[index - 1];
    const slot = references.length;
    references.push(null);
    let result;
    if (signature === 'java.util.ArrayList/4159755760' || signature === 'java.util.Arrays$ArrayList/2507071751'
        || signature === '[Lcom.exlibris.core.infra.calendar.shared.CalendarBean;/3324894770') {
      const count = pop();
      if (!Number.isInteger(count) || count < 0 || count > 10000) throw new Error('Invalid calendar count');
      result = [];
      references[slot] = result;
      for (let i = 0; i < count; i++) result.push(readObject(depth + 1));
    } else if (signature === 'com.exlibris.core.infra.calendar.shared.CalendarBean/2372987674') {
      result = {};
      references[slot] = result;
      result.reason = textFromAlma(readString());
      result.end = readObject(depth + 1);
      result.sourceType = readObject(depth + 1);
      result.start = readObject(depth + 1);
    } else if (signature === 'java.util.Date/3385151746') {
      result = decodeGwtLong(pop());
    } else if (signature === 'com.exlibris.core.infra.calendar.shared.Type/1460554459') {
      result = ['WEEK', 'EXCEPTION', 'EVENT'][pop()];
      if (!result) throw new Error('Unknown calendar event type');
    } else if (signature === 'java.util.Collections$EmptyList/4157118744') {
      result = [];
    } else {
      throw new Error('Unsupported calendar type: ' + signature);
    }
    references[slot] = result;
    return result;
  };
  const events = readObject();
  if (values.length || !Array.isArray(events) || !events.length) throw new Error('Incomplete official calendar');
  return events.map(event => {
    if (!event || !Number.isSafeInteger(event.start) || !Number.isSafeInteger(event.end) || event.end < event.start)
      throw new Error('Invalid official calendar interval');
    // Every CalendarBean is drawn as unavailable in BookingAvailabilityPanel (sm).
    // WEEK means recurring library hours; EXCEPTION/EVENT are unavailable exceptions/bookings.
    const closed = /library is closed|biblioteca.*cerrad|biblioteca.*tancad|sense servei de préstec|sin servicio de préstamo/i.test(event.reason);
    return {start: new Date(event.start).toISOString(), end: new Date(event.end).toISOString(),
      type: closed ? 'closed' : 'unavailable', reason: event.reason, sourceType: event.sourceType};
  }).sort((a,b) => a.start.localeCompare(b.start));
}


  const fail=code=>({ok:false,code});
  if(location.origin!=='https://cataleg.uji.es')return fail('wrong_origin');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+'T12:00:00Z'))||new Date(day+'T12:00:00Z').toISOString().slice(0,10)!==day)return fail('invalid_date');
  let context=new URL(location.href);
  const isCalendar=u=>u.origin==='https://cataleg.uji.es'&&(u.pathname==='/view/calendar/Calendar.html'||u.pathname==='/view/uresolver/34CVA_UJI/bookingAvailability');
  if(!isCalendar(context)){
    const candidates=[...document.querySelectorAll('iframe[src],a[href]')].map(e=>{try{return new URL(e.getAttribute('src')||e.getAttribute('href'),location.href)}catch{return null}}).filter(u=>u&&isCalendar(u));
    if(candidates.length!==1)return fail('open_calendar');
    context=candidates[0];
  }
  const param=name=>context.searchParams.get('pageBean.'+name)||context.searchParams.get(name);
  const mms=param('mmsId'),item=param('itemId'),userId=param('userId'),libraryId=param('pickUpLibraryId');
  const currentRoom=knownRooms.find(r=>r.mms===mms&&r.item===item);
  const room=targetRoomId?knownRooms.find(r=>r.id===targetRoomId):currentRoom;
  if(!currentRoom||!room)return fail('unknown_room');
  if(!userId||!/^\d{1,19}$/.test(userId)||!/^\d{1,19}$/.test(libraryId||''))return fail('open_calendar');
  try{
    const request=availabilityRequest({mmsId:room.mms,itemId:room.item,libraryId},userId);
    const response=await fetch(request.url,{...request.options,credentials:'same-origin',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok)return fail('connection');
    const events=parseAvailability(await response.text());
    const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
    const parts=t=>Object.fromEntries(fmt.formatToParts(new Date(t)).map(p=>[p.type,p.value]));
    const midnight=s=>{const [y,m,d]=s.split('-').map(Number),wall=Date.UTC(y,m-1,d);let guess=wall;for(let i=0;i<3;i++){const p=parts(guess);guess+=wall-Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)}return guess};
    const today=parts(Date.now()),todayString=today.year+'-'+today.month+'-'+today.day;
    const maxDay=new Date(Date.parse(todayString+'T12:00:00Z')+30*86400000).toISOString().slice(0,10);
    if(day<todayString||day>maxDay)return fail('invalid_date');
    const from=midnight(day),to=midnight(new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10));
    // Alma includes historical blocks. Only a generic block overlapping the
    // requested Madrid day prevents that day's availability being verified.
    if(events.some(e=>e.type==='unavailable'&&e.sourceType===null&&Date.parse(e.start)<to&&Date.parse(e.end)>from&&Date.parse(e.end)-Date.parse(e.start)>86400000))return fail('unverified');
    if(Math.min(...events.map(e=>Date.parse(e.start)))>from||Math.max(...events.map(e=>Date.parse(e.end)))<to-60000)return fail('incomplete');
    const intervals=events.filter(e=>Date.parse(e.start)<to&&Date.parse(e.end)>from).map(e=>{const a=Date.parse(e.start),b=Date.parse(e.end),pa=parts(a),pb=parts(b);return {start:a<=from?0:+pa.hour+(+pa.minute)/60,end:b>=to?24:+pb.hour+(+pb.minute)/60,type:e.type}});
    return {ok:true,version:1,room:room.id,date:day,fetchedAt:new Date().toISOString(),events:intervals};
  }catch{return fail('connection')}
}
