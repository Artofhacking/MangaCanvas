#!/bin/bash
# 部署脚本 - 在服务器上运行

# 1. 构建项目
npm run build

# 2. 复制到 nginx 目录
sudo cp -r dist/* /var/www/jurilu/

# 3. 重启 nginx
sudo systemctl restart nginx

echo "部署完成！访问 http://124.156.186.82/"
