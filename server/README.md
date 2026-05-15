# 绿城知境轻量后端

后端用于保护高德 Web 服务 Key、AI API Key，并提供最小 MySQL 留痕能力。没有 MySQL 时服务仍可启动，前端会继续使用规则式解释和本地 HTML 导出。

## 启动

```bash
cd server
npm install
copy .env.example .env
npm run start
```

本机开发时，如果 `server/.env` 未配置 `AMAP_WEB_SERVICE_KEY`，后端会自动尝试读取以下未纳入 Git 的本地文件：

- `server/高德key.txt`
- 仓库根目录 `高德key.txt`
- 仓库上一级目录 `高德key.txt`

常用接口：

- `GET /health`
- `GET /api/amap/regeocode?lon=108.3669&lat=22.8170`
- `POST /api/explain`
- `POST /api/reports`

## MySQL

MySQL 是可选增强。需要落库时先执行：

```bash
mysql -u root -p < db/schema.sql
```

再在 `.env` 中配置 `MYSQL_HOST`、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_DATABASE`。如果没有安装 `mysql2` 或数据库不可用，服务会降级为只提供 API 转发与规则式解释。
