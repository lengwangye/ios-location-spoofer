(function () {
  "use strict";

  var STORE_KEY = "location_spoofer_local_cfg";
  var DEFAULT = {
    enabled: true,
    latitude: 37.3349,
    longitude: -122.00902,
    altitude: 530,
    horizontalAccuracy: 39,
    verticalAccuracy: 1000
  };

  function readConfig() {
    try {
      var raw = $persistentStore.read(STORE_KEY);
      return raw ? Object.assign({}, DEFAULT, JSON.parse(raw)) : Object.assign({}, DEFAULT);
    } catch (error) {
      return Object.assign({}, DEFAULT);
    }
  }

  function response(status, type, body) {
    $done({
      response: {
        status: status,
        headers: {
          "Content-Type": type,
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
          "X-Content-Type-Options": "nosniff"
        },
        body: body
      }
    });
  }

  function json(status, value) {
    response(status, "application/json; charset=utf-8", JSON.stringify(value));
  }

  function saveConfig() {
    try {
      var input = JSON.parse(($request && $request.body) || "{}");
      var latitude = Number(input.latitude);
      var longitude = Number(input.longitude);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
          !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        json(400, { error: "经纬度无效" });
        return;
      }
      var cfg = {
        enabled: input.enabled !== false,
        latitude: latitude,
        longitude: longitude,
        altitude: Math.round(Number(input.altitude) || 0),
        horizontalAccuracy: Math.max(1, Math.round(Number(input.horizontalAccuracy) || 39)),
        verticalAccuracy: Math.max(1, Math.round(Number(input.verticalAccuracy) || 1000))
      };
      if (!$persistentStore.write(JSON.stringify(cfg), STORE_KEY)) {
        json(500, { error: "Loon 持久化存储写入失败" });
        return;
      }
      json(200, cfg);
    } catch (error) {
      json(400, { error: "请求格式错误" });
    }
  }

  var PAGE = String.raw`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>本地定位面板</title><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f5f5f7;color:#1d1d1f}.top{padding:12px;display:flex;gap:8px}.top input{flex:1}.top button,.save{border:0;border-radius:10px;background:#087cff;color:#fff;padding:11px 15px;font-size:15px}input{border:1px solid #d2d2d7;border-radius:10px;padding:11px;font-size:15px;background:#fff}#map{height:52vh}.card{margin:12px;padding:14px;background:#fff;border-radius:14px;box-shadow:0 2px 12px #0000000d}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.field{display:flex;flex-direction:column;gap:5px;font-size:12px;color:#666}.field input{width:100%}.row{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.save{width:100%;margin-top:12px}.msg{text-align:center;min-height:22px;margin-top:8px;font-size:13px;color:#16833b}</style></head>
<body><div class="top"><input id="search" placeholder="搜索地址"><button id="searchBtn">搜索</button></div><div id="map"></div>
<div class="card"><div class="row"><b>启用定位修改</b><input id="enabled" type="checkbox"></div><div class="grid">
<label class="field">纬度<input id="lat" type="number" step="any"></label><label class="field">经度<input id="lng" type="number" step="any"></label>
<label class="field">海拔（米）<input id="alt" type="number"></label><label class="field">水平精度<input id="hacc" type="number"></label>
<label class="field">垂直精度<input id="vacc" type="number"></label></div><button class="save" id="save">保存到 Loon</button><div class="msg" id="msg"></div></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
const $=id=>document.getElementById(id);let map,marker;
function move(lat,lng){$('lat').value=Number(lat).toFixed(7);$('lng').value=Number(lng).toFixed(7);marker.setLatLng([lat,lng]);map.setView([lat,lng],Math.max(map.getZoom(),15));fetch('https://api.open-meteo.com/v1/elevation?latitude='+lat+'&longitude='+lng).then(r=>r.json()).then(j=>{if(j.elevation&&j.elevation.length)$('alt').value=Math.round(j.elevation[0])}).catch(()=>{});}
fetch('/ios-location-spoofer/api/config').then(r=>r.json()).then(c=>{$('enabled').checked=c.enabled!==false;$('lat').value=c.latitude;$('lng').value=c.longitude;$('alt').value=c.altitude;$('hacc').value=c.horizontalAccuracy;$('vacc').value=c.verticalAccuracy;map=L.map('map').setView([c.latitude,c.longitude],15);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);marker=L.marker([c.latitude,c.longitude],{draggable:true}).addTo(map);map.on('click',e=>move(e.latlng.lat,e.latlng.lng));marker.on('dragend',()=>{const p=marker.getLatLng();move(p.lat,p.lng)});});
$('searchBtn').onclick=()=>{const q=$('search').value.trim();if(!q)return;fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(q)).then(r=>r.json()).then(a=>{if(a[0])move(Number(a[0].lat),Number(a[0].lon));else $('msg').textContent='没有找到地址'}).catch(()=>$('msg').textContent='搜索失败')};
$('save').onclick=()=>{const data={enabled:$('enabled').checked,latitude:Number($('lat').value),longitude:Number($('lng').value),altitude:Number($('alt').value),horizontalAccuracy:Number($('hacc').value),verticalAccuracy:Number($('vacc').value)};fetch('/ios-location-spoofer/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||'保存失败');$('msg').textContent='已保存，重新开关系统定位后生效'}).catch(e=>$('msg').textContent=e.message)};
</script></body></html>`;

  var url = new URL($request.url);
  if (url.pathname === "/ios-location-spoofer/api/config" && $request.method === "GET") {
    json(200, readConfig());
  } else if (url.pathname === "/ios-location-spoofer/api/config" && $request.method === "POST") {
    saveConfig();
  } else {
    response(200, "text/html; charset=utf-8", PAGE);
  }
}());
