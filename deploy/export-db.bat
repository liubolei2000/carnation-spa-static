@echo off
:: ============================================================
:: export-db.bat — 在 Windows 上导出本地 PostgreSQL 数据库
:: 运行前确保本地 PostgreSQL 正在运行
:: ============================================================

set PGPASSWORD=carnation123
set PGHOST=localhost
set PGPORT=5432
set PGUSER=carnation
set PGDATABASE=carnation_spa

echo 正在导出数据库...

:: 优先用 Docker 内的 pg_dump（如果本地 PG 是 Docker 跑的）
docker exec carnation-postgres pg_dump -U carnation carnation_spa > "%~dp0db-backup.sql" 2>nul

if %ERRORLEVEL% NEQ 0 (
  echo Docker 方式失败，尝试本地 pg_dump...
  pg_dump -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f "%~dp0db-backup.sql"
)

if %ERRORLEVEL% EQU 0 (
  echo 导出成功：deploy\db-backup.sql
) else (
  echo 导出失败，请检查 PostgreSQL 是否运行
  pause
  exit /b 1
)

echo 完成，现在可以把整个项目文件夹复制到 Raspberry Pi。
pause
