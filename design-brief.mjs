const words={네이비:'#142b49',남색:'#142b49',흰색:'#ffffff',화이트:'#ffffff',하얀색:'#ffffff',검정:'#171a1c',검은색:'#171a1c',블랙:'#171a1c',빨간색:'#c83436',빨강:'#c83436',레드:'#c83436',파란색:'#2466b5',파랑:'#2466b5',블루:'#2466b5',초록색:'#287154',초록:'#287154',녹색:'#287154',그린:'#287154',민트:'#62bba5',베이지:'#eee1c8',크림:'#f7f1e5',아이보리:'#f7f1e5',분홍색:'#d879a0',분홍:'#d879a0',핑크:'#d879a0',보라색:'#7952a0',보라:'#7952a0',퍼플:'#7952a0',주황색:'#da752c',주황:'#da752c',오렌지:'#da752c',노란색:'#f0ca4c',노랑:'#f0ca4c',옐로:'#f0ca4c',회색:'#69747d',그레이:'#69747d',브라운:'#725440',갈색:'#725440'};
const pattern='#(?:[a-f0-9]{6}|[a-f0-9]{3})(?![a-f0-9])|'+Object.keys(words).sort((a,b)=>b.length-a.length).join('|');
export function colorValue(value){if(!value)return null;value=value.toLowerCase();if(words[value])return words[value];if(/^#[a-f0-9]{3}$/.test(value))return '#'+value.slice(1).split('').map(s=>s+s).join('');return /^#[a-f0-9]{6}$/.test(value)?value:null;}
const firstColor=s=>{const m=s.match(new RegExp(pattern,'i'));return m?colorValue(m[0]):null;};
const after=(text,noun)=>{const m=text.match(new RegExp('(?:'+noun+')[^,;\\n.]{0,12}?('+pattern+')','i'));return m?colorValue(m[1]):null;};
export function parseBrief(text,elementText=''){
 const out={labels:[],warnings:[],background:after(text,'배경|바탕'),foreground:after(text,'글씨|글자|텍스트|본문'),primary:after(text,'포인트|주조색|대표색'),titleColor:after(text,'제목|타이틀'),shapeColor:after(text,'도형|장식'),titleScale:1,imageSide:null,hideShapes:false,elementColor:firstColor(elementText),elementHide:/(숨기|숨겨|제거|없애|빼)/.test(elementText)};
 if(/(?:제목|타이틀)[^,;\n.]{0,12}(?:크게|키워|강조)/.test(text)){out.titleScale=1.3;out.labels.push('제목 강조');}
 if(/(?:제목|타이틀)[^,;\n.]{0,12}(?:작게|줄여)/.test(text)){out.titleScale=.85;out.labels.push('제목 축소');}
 if(/(?:이미지|그림|사진|비주얼)[^,;\n.]{0,12}왼쪽/.test(text)){out.imageSide='left';out.labels.push('이미지 왼쪽');}
 if(/(?:이미지|그림|사진|비주얼)[^,;\n.]{0,12}오른쪽/.test(text)){out.imageSide='right';out.labels.push('이미지 오른쪽');}
 if(/(?:도형|장식)[^,;\n.]{0,12}(?:숨기|숨겨|제거|없애|빼)/.test(text)){out.hideShapes=true;out.labels.push('도형 숨김');}
 for(const [key,label]of [['background','배경색'],['foreground','글자색'],['primary','포인트색'],['titleColor','제목색'],['shapeColor','도형색']])if(out[key])out.labels.push(label+' '+out[key]);
 for(const clause of text.split(/[,;\n.]+/).map(s=>s.trim()).filter(Boolean))if(!firstColor(clause)&&!/(제목|타이틀).*(크게|키워|강조|작게|줄여)|(?:이미지|그림|사진|비주얼).*(왼쪽|오른쪽)|(?:도형|장식).*(숨기|숨겨|제거|없애|빼)/.test(clause))out.warnings.push('직접 편집이 필요한 요청: '+clause.slice(0,80));
 if(elementText.trim()&&!out.elementColor&&!out.elementHide)out.warnings.push('선택 요소 요청은 색상 변경·숨기기를 지원합니다. 나머지는 적용 후 직접 편집해 주세요.');
 return out;
}
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
export function mix(a,b,t){const x=rgb(a),y=rgb(b);return '#'+x.map((v,i)=>Math.round(v*(1-t)+y[i]*t).toString(16).padStart(2,'0')).join('');}
const luminance=h=>rgb(h).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
export const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
export const readable=bg=>contrast('#171a1c',bg)>=contrast('#ffffff',bg)?'#171a1c':'#ffffff';
export function accessible(color,bg){if(contrast(color,bg)>=4.5)return color;const target=readable(bg);for(let i=1;i<=20;i++){const c=mix(color,target,i/20);if(contrast(c,bg)>=4.5)return c;}return target;}
export function palette(index,settings,brief){
 const presets={navy:'#142b49',warm:'#a65c36',mint:'#287154',mono:'#343b40'},primary=brief.primary||presets[settings.theme]||settings.primary;
 const background=brief.background||(settings.useBackground?settings.background:null)||[mix(primary,'#ffffff',.95),'#faf8f1',mix(primary,'#171a1c',.65),'#ffffff'][index];
 const foreground=brief.foreground||(settings.useForeground?settings.foreground:null)||readable(background);
 return{primary,background,foreground:accessible(foreground,background),title:accessible(brief.titleColor||brief.foreground||(settings.useForeground?foreground:null)||primary,background),shape:brief.shapeColor||primary,adjusted:contrast(foreground,background)<4.5};
}
