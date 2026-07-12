(function () {
  "use strict";

  var VERSION = "1.5.0";
  var CONFIG_KEY = "location_spoofer_local_cfg";
  var FAVORITES_KEY = "location_spoofer_favorites";
  var LAST_READ_KEY = "location_spoofer_last_read";
  var RUNTIME_STATUS_KEY = "location_spoofer_runtime_status";
  var DEFAULT = { enabled: true, latitude: 37.3349, longitude: -122.00902, altitude: 530, horizontalAccuracy: 39, verticalAccuracy: 1000 };

  function storeRead(key, fallback) {
    try {
      var raw = $persistentStore.read(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function storeWrite(key, value) {
    return $persistentStore.write(value == null ? "" : JSON.stringify(value), key);
  }

  function readConfig() {
    var saved = storeRead(CONFIG_KEY, null);
    return saved ? Object.assign({}, DEFAULT, saved, { source: "local" }) : Object.assign({}, DEFAULT, { source: "plugin-default" });
  }

  function headers() {
    return { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
  }

  function send(status, type, body) {
    var h = headers();
    h["Content-Type"] = type;
    $done({ response: { status: status, headers: h, body: body } });
  }

  function json(status, value) { send(status, "application/json; charset=utf-8", JSON.stringify(value)); }
  function requestHeader(name) {
    var hs = ($request && $request.headers) || {};
    for (var key in hs) if (key.toLowerCase() === name.toLowerCase()) return String(hs[key]);
    return "";
  }
  function validOrigin() {
    var origin = requestHeader("Origin");
    var referer = requestHeader("Referer");
    return (!origin || origin === "https://gps.apple") && (!referer || referer.indexOf("https://gps.apple/") === 0);
  }
  function bodyJson() {
    var body = ($request && $request.body) || "";
    if (body.length > 10000) throw new Error("请求内容过大");
    return JSON.parse(body || "{}");
  }
  function normalizedConfig(input) {
    var lat = Number(input.latitude), lng = Number(input.longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error("经纬度无效");
    return { enabled: input.enabled !== false, latitude: lat, longitude: lng, altitude: Math.round(Number(input.altitude) || 0), horizontalAccuracy: Math.max(1, Math.round(Number(input.horizontalAccuracy) || 39)), verticalAccuracy: Math.max(1, Math.round(Number(input.verticalAccuracy) || 1000)), updatedAt: Date.now() };
  }

  function statusPayload() {
    return { version: VERSION, config: readConfig(), lastRead: storeRead(LAST_READ_KEY, null), runtime: storeRead(RUNTIME_STATUS_KEY, null), favorites: storeRead(FAVORITES_KEY, []) };
  }

  var PAGE = String.raw`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><title>本地定位面板</title><style>/*__LEAFLET_CSS__*/</style><style>
*{box-sizing:border-box}body{margin:0;background:#f3f4f6;color:#171719;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding-bottom:calc(90px + env(safe-area-inset-bottom))}.searchWrap{position:relative;background:#fff}.bar{padding:10px;display:flex;gap:8px}.bar input{flex:1}.results{display:none;position:absolute;left:10px;right:10px;top:54px;z-index:1200;background:#fff;border-radius:12px;box-shadow:0 8px 28px #0003;max-height:260px;overflow:auto}.results.show{display:block}.result{padding:11px 12px;border-bottom:1px solid #eee;font-size:13px;line-height:1.35}.result:last-child{border-bottom:0}.bar button,.btn{border:0;border-radius:11px;padding:11px 14px;font-size:15px;font-weight:600}.primary{background:#087cff;color:#fff}.danger{background:#ff3b30;color:#fff}.muted{background:#e9e9ee;color:#222}input,select{border:1px solid #d1d1d6;border-radius:10px;padding:10px;font-size:15px;background:#fff;width:100%}#map{height:42vh;min-height:260px;background:#ddd}.card{margin:10px;padding:13px;background:#fff;border-radius:15px;box-shadow:0 2px 10px #0000000a}.status{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px}.status div{background:#f6f6f8;padding:9px;border-radius:9px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.field{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#666}.row{display:flex;gap:8px;align-items:center}.row>*{flex:1}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:11px}.actions .wide{grid-column:1/-1}.msg{min-height:20px;margin-top:8px;text-align:center;font-size:13px;color:#147d37}.bottom{position:fixed;left:0;right:0;bottom:0;padding:10px 10px calc(10px + env(safe-area-inset-bottom));background:#ffffffed;backdrop-filter:blur(12px);z-index:999}.bottom button{width:100%}.small{font-size:12px;color:#777;text-align:center;margin-top:6px}@media(prefers-color-scheme:dark){body{background:#111;color:#f5f5f7}.card,.bar,.bottom,.results{background:#1c1c1eee}.status div{background:#2c2c2e}input,select{background:#2c2c2e;color:#fff;border-color:#48484a}.muted{background:#3a3a3c;color:#fff}.result{border-color:#333}}
</style></head><body><div class="searchWrap"><div class="bar"><input id="search" placeholder="搜索具体地点" autocomplete="off"><button class="btn primary" id="searchBtn">搜索</button></div><div class="results" id="results"></div></div><div id="map"></div>
<section class="card"><b>运行状态</b><div class="status" style="margin-top:9px"><div>配置来源<br><b id="source">读取中</b></div><div>修改状态<br><b id="state">读取中</b></div><div>最后保存<br><b id="updated">—</b></div><div>脚本最后读取<br><b id="lastRead">—</b></div><div>最后生效<br><b id="effective">—</b></div><div>响应格式<br><b id="format">—</b></div><div>Wi-Fi 修改<br><b id="wifiCount">0</b></div><div>基站修改<br><b id="cellCount">0</b></div><div style="grid-column:1/-1">🔵 系统当前位置<br><b id="current">正在自动获取…</b><small style="display:block;color:#888;margin-top:3px">开启定位修改后，此位置也可能已被伪装</small></div><div style="grid-column:1/-1">🔴 伪装位置<br><b id="spoofPlace">正在解析…</b></div></div><button class="btn muted" id="getCurrent" style="width:100%;margin-top:9px">重新获取系统位置</button></section>
<section class="card"><div class="grid"><label class="field">纬度<input id="lat" inputmode="decimal"></label><label class="field">经度<input id="lng" inputmode="decimal"></label><label class="field">海拔（米）<input id="alt" inputmode="numeric"></label><label class="field">水平精度<input id="hacc" inputmode="numeric"></label><label class="field">垂直精度<input id="vacc" inputmode="numeric"></label></div><div class="msg" id="msg"></div></section>
<section class="card"><b>常用地点</b><div class="small" id="placeName" style="text-align:left;margin:5px 0 9px">当前选点：尚未识别地点</div><div class="row"><select id="favorites"><option value="">暂无收藏</option></select><button class="btn muted" id="useFavorite">使用</button></div><div class="row" style="margin-top:8px"><button class="btn muted" id="addFavorite">收藏当前地点</button><button class="btn danger" id="deleteFavorite">删除收藏</button></div><div class="actions"><button class="btn muted" id="copy">复制坐标</button><button class="btn muted" id="disable">恢复真实定位</button><button class="btn danger wide" id="clear">清除本地配置</button></div></section>
<div class="bottom"><button class="btn primary" id="save">保存并启用</button><div class="small">Local Panel v<span id="version">-</span> · 数据保存在 Loon 本机</div></div>
<script>/*__LEAFLET_JS__*/</script><script>
const $=id=>document.getElementById(id),api='/api';let map,marker,realMarker,currentStatus,selectedPlaceName='',suggestTimer;const placeCache=new Map();
function note(s,bad=false){$('msg').textContent=s;$('msg').style.color=bad?'#ff3b30':'#147d37'}function fmt(t){return t?new Date(t).toLocaleString():'—'}function fields(c){$('lat').value=c.latitude;$('lng').value=c.longitude;$('alt').value=c.altitude;$('hacc').value=c.horizontalAccuracy;$('vacc').value=c.verticalAccuracy;if(marker)marker.setLatLng([c.latitude,c.longitude]);if(map)map.setView([c.latitude,c.longitude],15)}function payload(enabled=true){return{enabled,latitude:Number($('lat').value),longitude:Number($('lng').value),altitude:Number($('alt').value),horizontalAccuracy:Number($('hacc').value),verticalAccuracy:Number($('vacc').value)}}
async function call(path,opt={}){const r=await fetch(api+path,opt),j=await r.json();if(!r.ok)throw Error(j.error||'请求失败');return j}function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}function render(s){currentStatus=s;const c=s.config,r=s.runtime;$('version').textContent=s.version;$('source').textContent=c.source==='local'?'本地面板':'插件默认值';$('state').textContent=c.enabled!==false?'已启用':'真实定位';$('updated').textContent=fmt(c.updatedAt);$('lastRead').textContent=fmt(s.lastRead&&s.lastRead.ts);$('effective').textContent=fmt(r&&r.ts);$('format').textContent=r?(r.success?r.kind:'失败'):'—';$('wifiCount').textContent=r&&r.success?r.wifiCount:0;$('cellCount').textContent=r&&r.success?r.cellCount:0;fields(c);$('favorites').innerHTML='<option value="">选择收藏</option>'+s.favorites.map((f,i)=>'<option value="'+i+'">'+esc(f.name)+'</option>').join('')}
async function refresh(){try{const s=await call('/status');render(s);return s}catch(e){note(e.message,true)}}function placeLabel(p){return[p.name,p.street,p.district,p.city,p.county,p.state,p.country].filter((v,i,a)=>v&&a.indexOf(v)===i).join(' · ')}function setPlace(name){selectedPlaceName=name||'';$('placeName').textContent='当前选点：'+(selectedPlaceName||'尚未识别地点');$('spoofPlace').textContent=selectedPlaceName||'尚未识别'}async function lookupPlace(lat,lng){const key=Number(lat).toFixed(5)+','+Number(lng).toFixed(5);if(placeCache.has(key))return placeCache.get(key);let name='';try{const j=await fetch('https://photon.komoot.io/reverse?lang=zh&lat='+lat+'&lon='+lng).then(r=>r.json()),p=j.features&&j.features[0]&&j.features[0].properties;if(p)name=placeLabel(p)}catch(e){}if(!name){const n=await fetch('https://nominatim.openstreetmap.org/reverse?format=json&accept-language=zh-CN&lat='+lat+'&lon='+lng).then(r=>r.json());name=n.display_name||'未知地点'}placeCache.set(key,name);return name}async function reversePlace(lat,lng){try{setPlace(await lookupPlace(lat,lng))}catch(e){setPlace('坐标 '+Number(lat).toFixed(5)+', '+Number(lng).toFixed(5))}}function move(lat,lng,name){$('lat').value=Number(lat).toFixed(7);$('lng').value=Number(lng).toFixed(7);marker&&marker.setLatLng([lat,lng]);map&&map.setView([lat,lng],Math.max(map.getZoom(),15));name?setPlace(name):reversePlace(lat,lng);fetch('https://api.open-meteo.com/v1/elevation?latitude='+lat+'&longitude='+lng).then(r=>r.json()).then(j=>{if(j.elevation&&j.elevation.length)$('alt').value=Math.round(j.elevation[0])}).catch(()=>note('已选点，但自动海拔查询失败',true))}
function dotIcon(color){return L.divIcon({className:'',html:'<div style="width:18px;height:18px;border-radius:50%;background:'+color+';border:3px solid white;box-shadow:0 1px 6px #0008"></div>',iconSize:[18,18],iconAnchor:[9,9]})}function initMap(){if(!window.L){note('地图组件加载失败，可直接输入经纬度保存',true);return}const c=currentStatus.config;map=L.map('map').setView([c.latitude,c.longitude],15);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);marker=L.marker([c.latitude,c.longitude],{draggable:true,icon:dotIcon('#ff3b30')}).addTo(map);map.on('click',e=>move(e.latlng.lat,e.latlng.lng));marker.on('dragend',()=>{const p=marker.getLatLng();move(p.lat,p.lng)});reversePlace(c.latitude,c.longitude)}
function showSuggestions(features){const box=$('results');box.innerHTML='';features.forEach(f=>{const p=f.properties||{},coords=f.geometry.coordinates,name=placeLabel(p);if(!name)return;const row=document.createElement('div');row.className='result';row.textContent=name;row.onclick=()=>{box.classList.remove('show');$('search').value=name;move(coords[1],coords[0],name)};box.appendChild(row)});box.classList.toggle('show',box.children.length>0)}async function searchPlaces(q,limit=5){if(!q||q.length<2)return[];const j=await fetch('https://photon.komoot.io/api/?lang=zh&limit='+limit+'&q='+encodeURIComponent(q)).then(r=>r.json());return j.features||[]}$('search').oninput=()=>{clearTimeout(suggestTimer);const q=$('search').value.trim();if(q.length<2){$('results').classList.remove('show');return}note('正在搜索…');suggestTimer=setTimeout(()=>searchPlaces(q).then(a=>{showSuggestions(a);note(a.length?'请选择具体地点':'没有找到地点',!a.length)}).catch(()=>{$('results').classList.remove('show');note('候选地点加载失败',true)}),650)};$('searchBtn').onclick=async()=>{try{let a=await searchPlaces($('search').value.trim(),1);if(a[0]){const p=a[0].properties||{},c=a[0].geometry.coordinates,name=placeLabel(p);$('results').classList.remove('show');move(c[1],c[0],name)}else{const n=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=zh-CN&q='+encodeURIComponent($('search').value.trim())).then(r=>r.json());n[0]?move(+n[0].lat,+n[0].lon,n[0].display_name):note('没有找到地址',true)}}catch(e){note('地址搜索失败',true)}};function locateCurrent(){if(!navigator.geolocation){$('current').textContent='浏览器不支持定位';return}$('current').textContent='正在获取…';navigator.geolocation.getCurrentPosition(async p=>{try{$('current').textContent=await lookupPlace(p.coords.latitude,p.coords.longitude);if(map){realMarker?realMarker.setLatLng([p.coords.latitude,p.coords.longitude]):realMarker=L.marker([p.coords.latitude,p.coords.longitude],{icon:dotIcon('#087cff')}).addTo(map)}}catch(e){$('current').textContent='地点名称解析失败'}},e=>$('current').textContent='获取失败：'+e.message,{enableHighAccuracy:true,timeout:10000,maximumAge:30000})}$('getCurrent').onclick=locateCurrent;
async function checkRead(savedAt){setTimeout(async()=>{const s=await refresh();if(s&&s.runtime&&s.runtime.success&&s.runtime.ts>=savedAt)note('✓ 已保存并成功修改 Apple 定位响应');else note('已保存；尚未检测到实际生效，请重新开关系统定位')},3000)}$('save').onclick=async()=>{try{const savedAt=Date.now();await call('/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload(true))});note('已保存，正在等待定位请求实际生效…');await refresh();checkRead(savedAt)}catch(e){note(e.message,true)}};$('disable').onclick=async()=>{if(!confirm('确定恢复真实定位吗？'))return;try{await call('/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload(false))});note('已恢复真实定位');await refresh()}catch(e){note(e.message,true)}};$('clear').onclick=async()=>{if(!confirm('确定清除全部本地定位配置吗？'))return;try{await call('/config',{method:'DELETE'});note('本地配置已清除');await refresh()}catch(e){note(e.message,true)}};$('copy').onclick=()=>navigator.clipboard.writeText($('lat').value+', '+$('lng').value).then(()=>note('坐标已复制')).catch(()=>note('复制失败',true));$('addFavorite').onclick=async()=>{try{const name=selectedPlaceName||('地点 '+Number($('lat').value).toFixed(5)+', '+Number($('lng').value).toFixed(5));await call('/favorites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'add',name,...payload(true)})});await refresh();note('已收藏：'+name)}catch(e){note(e.message,true)}};$('deleteFavorite').onclick=async()=>{if(!confirm('确定删除这个收藏地点吗？'))return;try{await call('/favorites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',index:Number($('favorites').value)})});await refresh();note('已删除收藏')}catch(e){note(e.message,true)}};$('useFavorite').onclick=()=>{const i=Number($('favorites').value);if(currentStatus.favorites[i]){const f=currentStatus.favorites[i];fields(f);setPlace(f.name);note('已载入收藏，点击保存后生效')}};
refresh().then(()=>{initMap();locateCurrent()});</script></body></html>`;

  var url = new URL($request.url), path = url.pathname, method = String($request.method || "GET").toUpperCase();
  if (path === "/" && method === "GET") send(200, "text/html; charset=utf-8", PAGE);
  else if (path === "/api/status" && method === "GET") json(200, statusPayload());
  else if (path === "/api/config" && method === "POST") {
    if (!validOrigin()) json(403, { error: "请求来源无效" });
    else try { var cfg = normalizedConfig(bodyJson()); if (!storeWrite(CONFIG_KEY, cfg)) throw new Error("Loon 存储写入失败"); json(200, cfg); } catch (error) { json(400, { error: error.message }); }
  } else if (path === "/api/config" && method === "DELETE") {
    if (!validOrigin()) json(403, { error: "请求来源无效" }); else { storeWrite(CONFIG_KEY, null); json(200, { ok: true }); }
  } else if (path === "/api/favorites" && method === "POST") {
    if (!validOrigin()) json(403, { error: "请求来源无效" });
    else try { var input = bodyJson(), list = storeRead(FAVORITES_KEY, []); if (input.action === "add") { var item = normalizedConfig(input); item.name = String(input.name || "未命名地点").trim().slice(0, 30); var duplicate = list.some(function (saved) { return saved.name === item.name || (Math.abs(Number(saved.latitude) - item.latitude) < 0.000001 && Math.abs(Number(saved.longitude) - item.longitude) < 0.000001); }); if (duplicate) throw new Error("该地点已经收藏"); list.push(item); if (list.length > 30) list.shift(); } else if (input.action === "delete" && list[input.index]) list.splice(input.index, 1); else throw new Error("收藏操作无效"); if (!storeWrite(FAVORITES_KEY, list)) throw new Error("收藏写入失败"); json(200, list); } catch (error) { json(400, { error: error.message }); }
  } else if (method !== "GET" && method !== "POST" && method !== "DELETE") json(405, { error: "Method Not Allowed" });
  else json(404, { error: "Not Found" });
}());
