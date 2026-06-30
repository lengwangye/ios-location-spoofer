# iOS Location Spoofer

iOS 定位欺骗工具，不需越狱。附带代理模块可直接在 Shadowrocket / Surge / Loon / Quantumult X / Stash 上使用。

## 原理

iPhone 扫描附近 Wi-Fi 热点和基站信息，把 BSSID 列表发给 Apple 定位服务器（`gs-loc.apple.com/clls/wloc`），Apple 回传这些设备对应的 GPS 坐标，iOS 根据这些坐标算出当前位置。

这套工具做的事情就是在这条通信路径上做手脚：
- **iOS App 版**：自建本地 VPN，跑 Go 写的 MITM 代理，拦截并改写定位回应
- **代理模块版**：利用 Shadowrocket、Surge 等软件的 HTTPS 解密功能，在流量经过时直接替换坐标数据

两种方式都在本机完成，不经过第三方服务器。

## 方案对比

| | iOS App 版 | 代理模块版 |
|---|---|---|
| 需要什么 | Apple 开发者账号 + Xcode | 代理软件（小火箭/Surge 等） |
| 难度 | 需要自己编译签名 | 一键导入 |
| MITM 方式 | 自建 VPN + Go 代理 | 软件内置 MITM |
| 适用人群 | 开发者 | 普通用户 |
| 文件位置 | `GoSpoofer/` `Tunnel/` `App/` | `Shadowrocket/` |

## 代理模块用法

五个平台全部支持一键导入：

| 平台 | 导入链接 |
|------|---------|
| Shadowrocket / Surge | [ios-location-spoofer.sgmodule](https://raw.githubusercontent.com/mekos2772/ios-location-spoofer/main/Shadowrocket/ios-location-spoofer.sgmodule) |
| Loon | [ios-location-spoofer.lnplugin](https://raw.githubusercontent.com/mekos2772/ios-location-spoofer/main/Shadowrocket/ios-location-spoofer.lnplugin) |
| Quantumult X | [ios-location-spoofer.snippet](https://raw.githubusercontent.com/mekos2772/ios-location-spoofer/main/Shadowrocket/ios-location-spoofer.snippet) |
| Stash | [ios-location-spoofer.stoverride](https://raw.githubusercontent.com/mekos2772/ios-location-spoofer/main/Shadowrocket/ios-location-spoofer.stoverride) |

导入步骤：
1. 开启代理软件的 HTTPS 解密功能，安装并信任 CA 证书
2. 导入模块并启用
3. 断开重连 VPN，开关一下定位服务

详情见 `Shadowrocket/README.md`。

## iOS App 自行编译

如果你有 Apple 开发者账号，也可以自己编译这个 app：

```
cd GoSpoofer && ./make.sh
open location-spoofer.xcodeproj
```

在 Xcode 里选自己的开发者账号，跑手机上即可。

## 拦截的域名

- `gs-loc.apple.com`
- `gs-loc-cn.apple.com`
- `bluedot.is.autonavi.com`
- `bluedot.is.autonavi.com.gds.alibabadns.com`

## License

AGPL-3.0
