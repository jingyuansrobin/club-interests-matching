# 方块搭子正式生产部署

正式域名：

```text
https://match.ecnumc.cn/
```

管理员入口：

```text
https://match.ecnumc.cn/admin/
```

此前 FRP 端口转发仅用于内测，正式迁移后不再作为生产入口。

## 1. 部署模型

方块搭子使用 Next.js 静态导出：

```ts
output: "export"
trailingSlash: true
```

因为生产环境采用独立子域名 `match.ecnumc.cn`，应用运行在该 Host 的根路径 `/`，因此不需要 `basePath` 或 `assetPrefix`。

执行：

```bash
npm install
npm run build
```

得到：

```text
out/
├── index.html
├── admin/
│   └── index.html
├── _next/
│   └── static/...
└── ...
```

部署时必须发布整个 `out/` 目录。

## 2. 环境变量

生产构建前应存在：

```env
NEXT_PUBLIC_SITE_URL=https://match.ecnumc.cn
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

不要将 Supabase `service_role` key 放入前端环境变量。

## 3. DNS

在 `ecnumc.cn` 的 DNS 管理中创建：

```text
主机记录: match
记录类型: A 或 AAAA
记录值: 社团 Web 服务器公网地址
```

如果前方使用 CDN / 反向代理，则按该平台要求设置 CNAME。

DNS 生效后确认：

```bash
nslookup match.ecnumc.cn
# 或
dig match.ecnumc.cn
```

## 4. Nginx

推荐将仓库放在例如：

```text
/var/www/club-interests-matching/
```

并以：

```text
/var/www/club-interests-matching/out/
```

作为站点根目录。

HTTP 配置示例：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name match.ecnumc.cn;

    root /var/www/club-interests-matching/out;
    index index.html;

    location / {
        try_files $uri $uri/ $uri/index.html =404;
    }
}
```

验证：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 5. HTTPS

正式站必须使用 HTTPS。可以使用服务器现有证书体系或 Certbot。

证书就绪后建议：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name match.ecnumc.cn;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name match.ecnumc.cn;

    ssl_certificate     /PATH/TO/fullchain.pem;
    ssl_certificate_key /PATH/TO/privkey.pem;

    root /var/www/club-interests-matching/out;
    index index.html;

    location / {
        try_files $uri $uri/ $uri/index.html =404;
    }
}
```

证书路径应以社团服务器的实际配置为准。

## 6. Supabase Auth

生产迁移后，应在 Supabase Authentication URL Configuration 中同步正式域名：

```text
Site URL
https://match.ecnumc.cn/

Redirect URLs
https://match.ecnumc.cn/**
```

当前产品主要使用页面内 6 位 OTP 验证，但 Auth 的正式站点 URL 仍应与生产域名保持一致，避免未来登录链接、邮件模板或恢复流程回到旧环境。

不要再将 FRP 域名作为生产 Site URL。

## 7. 发布流程

每次发布建议：

```bash
cd /var/www/club-interests-matching

git status
git fetch origin
git pull --ff-only origin main

npm install
npm run build

 test -f out/index.html
 test -f out/admin/index.html

sudo nginx -t
sudo systemctl reload nginx
```

如果 Nginx 直接读取仓库中的 `out/`，构建成功后通常不需要复制文件。

## 8. 上线验证

先验证服务器：

```bash
curl -I http://127.0.0.1 -H 'Host: match.ecnumc.cn'
```

然后验证公网：

```bash
curl -I https://match.ecnumc.cn/
curl -I https://match.ecnumc.cn/admin/
```

预期均返回 `200`。

浏览器还应人工验证：

- 首页样式和 Minecraft 背景资源正常；
- V2 三核心模块可完成；
- Top 3 可以正常刷新；
- “让推荐再准一点”可以保存；
- QQ 复制正常；
- 邮箱验证码发送和恢复正常；
- `/admin/` 管理员 OTP 登录正常；
- 管理员搜索、筛选和 Excel 导出正常。

## 9. FRP 下线

确认 `https://match.ecnumc.cn/` 已稳定运行后，再停止旧 FRP 映射。

FRP 下线不需要修改 Supabase 数据库或 `match-v2` Edge Function。前端生产域名变化与服务端匹配数据是解耦的。
