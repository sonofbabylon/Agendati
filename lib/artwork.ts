import {CalendarEvent,Design,PALETTES,MONTH_PALETTES,daysInMonth,dayOffset,monthName} from './calendar-data';
export type Artwork={svg:string;width:number;height:number;page:number;pages:number;eventIds:string[];layout:string};
const esc=(s:unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
function wrap(s:string,max:number):string[]{const out:string[]=[];let line='';for(const word of s.split(/\s+/)){for(const part of (word.length>max?word.match(new RegExp(`.{1,${max}}`,'g'))||[]:[word])){if((line+' '+part).trim().length>max){out.push(line);line=part;}else line=(line+' '+part).trim();}}if(line)out.push(line);return out.length?out:[''];}
export function createArtwork(events:CalendarEvent[],year:number,month:number,design:Design):Artwork[]{
 const phone=design.device==='phone',w=phone?1080:1920,h=phone?1920:1080,pad=phone?76:88,rtl=design.language==='ar',bg=design.customBg||PALETTES[design.monthPalette?MONTH_PALETTES[month]:design.palette].bg,fg=design.customFg||PALETTES[design.monthPalette?MONTH_PALETTES[month]:design.palette].fg;
 const useGrid=design.layout==='calendar'&&!phone;
 const scale=design.fontSize/100,fs=(useGrid?18:phone?30:27)*scale,titleFs=(phone?41:33)*scale;
 const headY=useGrid?200:phone?(design.safeArea?480:265):285,contentY=headY+(useGrid?125:phone?125:155),bottom=h-110;
 const name=monthName(year,month,design.language),number=String(month+1).padStart(2,'0');
 const listX=phone?pad:(design.showMini?600:pad),listW=w-pad-listX,chars=Math.floor((listW-(phone?140:190))/(titleFs*.60));
 const rowHeight=(e:CalendarEvent)=>Math.max(phone?142:101,wrap(e.title,chars).length*titleFs*1.22+(design.showLocation&&e.location?wrap(e.location,Math.floor((listW-190)/(fs*.59))).length*fs*1.2:0)+(design.showTime?fs*1.2:0)+30);
 let groups:CalendarEvent[][]=[];
 if(useGrid){const slots=new Map<number,CalendarEvent[]>();events.forEach(e=>{const d=Number(e.date.slice(-2));slots.set(d,[...(slots.get(d)||[]),e]);});const rows=Math.ceil((dayOffset(year,month)+daysInMonth(year,month))/7);const cellH=(bottom-contentY-42)/rows;const cellW=(w-pad*2)/7;const layers:CalendarEvent[][]=[[]];const used:number[][]=[[]];for(const e of events){const day=Number(e.date.slice(-2));const lines=wrap(e.title,Math.floor((cellW-24)/(fs*.60)));const cost=lines.length*fs*1.15+(design.showTime?fs*.95:0)+(design.showLocation?wrap(e.location,Math.floor((cellW-24)/(fs*.50))).length*fs*.85:0)+10;if(cost>cellH-32){return createArtwork(events,year,month,{...design,layout:'programme'});}let layer=0;while((used[layer]?.[day]||0)+cost>cellH-32)layer++;if(!layers[layer]){layers[layer]=[];used[layer]=[];}layers[layer].push(e);used[layer][day]=(used[layer][day]||0)+cost;}groups=layers;
 }else{let page:CalendarEvent[]=[],used=0;const avail=bottom-contentY;for(const e of events){const height=rowHeight(e);if(page.length&&used+height>avail){groups.push(page);page=[];used=0;}page.push(e);used+=height;}if(page.length||!groups.length)groups.push(page);}
 return groups.map((group,page)=>{
 const parts:string[]=[];
 const text=(x:number,y:number,s:string,size:number,weight=400,opacity=1,anchor='start')=>{const arabic=/[\u0600-\u06ff]/.test(s);const align=arabic?(anchor==='end'?'start':anchor==='start'?'end':anchor):anchor;parts.push(`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fg}" opacity="${opacity}" text-anchor="${align}"${arabic?' direction="rtl"':''}>${esc(s)}</text>`)};
 const line=(x1:number,y1:number,x2:number,y2:number,opacity=.2)=>parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${fg}" stroke-opacity="${opacity}"/>`);
 parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/><g font-family="Arial, sans-serif">`);
 const top=phone&&design.safeArea?300:64;
 text(pad,top,design.showBrand?design.brand:(rtl?'برنامج أجندتي':'AGENDATI PROGRAMME'),phone?23:21,500);
 text(w-pad,top,String(year),phone?26:24,400,1,'end');line(pad,top+24,w-pad,top+24);
 const headingMax=phone?620:1390,headingSize=Math.min((useGrid?115:phone?112:192)*design.heading/100,headingMax/(Math.max(name.length,3)*(phone?.72:.56)));
 text(rtl?w-pad:pad,headY,name,headingSize,400,1,rtl?'end':'start');
 if(!rtl)text(w-pad,headY+25,number,(useGrid?152:phone?170:258)*design.heading/100,400,.95,'end');
 else text(pad,headY+8,number,phone?130:useGrid?130:200,400,.75);
 line(pad,headY+54,w-pad,headY+54);line(pad,headY+61,w-pad,headY+61,.10);
 text(pad,headY+100,rtl?`${events.length} فعالية · التوقيت المحلي`:`${events.length} EVENTS  /  LOCAL TIME`,phone?22:20,500,.78);
 const mini=(x:number,y:number,width:number)=>{const cw=width/7,ch=phone?45:42;const labels=rtl?['ن','ث','ر','خ','ج','س','ح']:['M','T','W','T','F','S','S'];labels.forEach((d,i)=>text(x+i*cw+cw/2,y,d,20,500,.6,'middle'));const off=dayOffset(year,month);for(let d=1;d<=daysInMonth(year,month);d++){const i=d-1+off,xx=x+(i%7)*cw+cw/2,yy=y+ch+Math.floor(i/7)*ch,marked=events.some(e=>Number(e.date.slice(-2))===d);if(marked)parts.push(`<circle cx="${xx}" cy="${yy-8}" r="17" fill="${fg}" fill-opacity=".14"/>`);text(xx,yy,String(d),22,marked?600:400,marked?1:.65,'middle');}};
 if(useGrid){const cols=(w-pad*2)/7,rows=Math.ceil((dayOffset(year,month)+daysInMonth(year,month))/7),cellH=(bottom-contentY-42)/rows;const weekdays=rtl?['الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت','الأحد']:['MON','TUE','WED','THU','FRI','SAT','SUN'];weekdays.forEach((d,i)=>text(pad+i*cols+12,contentY,d,21,500,.7));for(let r=0;r<=rows;r++)line(pad,contentY+20+r*cellH,w-pad,contentY+20+r*cellH);for(let c=0;c<=7;c++)line(pad+c*cols,contentY+20,pad+c*cols,bottom-22,.12);
 for(let day=1;day<=daysInMonth(year,month);day++){const idx=dayOffset(year,month)+day-1,x=pad+(idx%7)*cols+12,y=contentY+46+Math.floor(idx/7)*cellH;text(x,y,String(day),22,500);let yy=y+32;group.filter(e=>Number(e.date.slice(-2))===day).forEach(e=>{const lines=wrap(e.title,Math.floor((cols-24)/(fs*.60)));lines.forEach(t=>{text(x,yy,t,fs,500);yy+=fs*1.15;});if(design.showTime){text(x,yy,`${e.time} – ${e.end}`,fs*.83,400,.76);yy+=fs*.95;}if(design.showLocation){wrap(e.location,Math.floor((cols-24)/(fs*.5))).forEach(t=>{text(x,yy,t,fs*.72,400,.7);yy+=fs*.85;});}yy+=10;});}
 }else{
 if(!phone&&design.showMini){mini(pad,contentY+12,405);text(pad,contentY+365,rtl?'أيام الفعاليات محددة':'Event days are highlighted',20,400,.6);}
 let y=contentY+10;
 if(!group.length)text(listX,y+65,rtl?'لا توجد فعاليات مجدولة':'A little space for what’s next.',phone?35:37,400,.8);
 group.forEach(e=>{const day=Number(e.date.slice(-2)),weekday=new Intl.DateTimeFormat(rtl?'ar-AE':'en-GB',{weekday:'short',timeZone:'UTC'}).format(new Date(e.date+'T12:00:00Z'));line(listX,y-13,w-pad,y-13);text(listX,y+36,String(day).padStart(2,'0'),phone?55:48,400);text(listX+(phone?80:85),y+7,weekday.toUpperCase(),phone?22:20,400,.65);const tx=listX+(phone?145:190),anchor=rtl?'end':'start',actualX=rtl?w-pad:tx;let yy=y+25;wrap(e.title,chars).forEach(t=>{text(actualX,yy,t,titleFs,500,1,anchor);yy+=titleFs*1.22;});if(design.showTime){text(actualX,yy,`${e.time} – ${e.end}`,fs,400,.75,anchor);yy+=fs*1.2;}if(design.showLocation&&e.location){wrap(e.location,Math.floor((listW-190)/(fs*.59))).forEach(t=>{text(actualX,yy,t,fs,400,.70,anchor);yy+=fs*1.2;});}y+=rowHeight(e);});
 }
 line(pad,h-76,w-pad,h-76);text(pad,h-39,rtl?'التقويم الشهري':`${name.toUpperCase()} / ${year}`,20,400,.65);text(w-pad,h-39,`${String(page+1).padStart(2,'0')} / ${String(groups.length).padStart(2,'0')}`,20,400,.65,'end');parts.push('</g></svg>');return {svg:parts.join(''),width:w,height:h,page:page+1,pages:groups.length,eventIds:group.map(e=>e.id),layout:useGrid?'calendar':'programme'};
 });
}
export const svgUrl=(svg:string)=>`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
export async function artworkPng(art:Artwork,multiplier=1):Promise<Blob>{await document.fonts.ready;return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=art.width*multiplier;canvas.height=art.height*multiplier;const ctx=canvas.getContext('2d');if(!ctx)return reject(new Error('Canvas unavailable'));ctx.drawImage(image,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Image export failed')),'image/png');};image.onerror=()=>reject(new Error('Artwork could not be rendered'));image.src=svgUrl(art.svg);});}
export function downloadFile(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
