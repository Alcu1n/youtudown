#!/bin/bash

echo "=== YouTuDown 修复验证测试 ==="
echo ""

echo "1. 检查yt-dlp版本和impersonate支持..."
yt-dlp --version
echo ""

echo "2. 验证impersonate目标可用性..."
yt-dlp --list-impersonate-targets | head -10
echo ""

echo "3. 测试YouTube视频信息获取（使用impersonate）..."
TEST_URL="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
echo "测试URL: $TEST_URL"

# 使用Chrome impersonate测试
RESULT=$(yt-dlp --impersonate Chrome-131 --cookies-from-browser chrome --dump-json --no-warnings "$TEST_URL" 2>/dev/null)

if [ $? -eq 0 ]; then
    echo "✅ 视频信息获取成功！"
    echo "标题: $(echo "$RESULT" | jq -r '.title' 2>/dev/null || echo '解析失败')"
    echo "时长: $(echo "$RESULT" | jq -r '.duration' 2>/dev/null | awk '{print int($1/60)"分"int($1%60)"秒"}' || echo '解析失败')"
    echo "可用格式数: $(echo "$RESULT" | jq '.formats | length' 2>/dev/null || echo '解析失败')"
else
    echo "❌ 视频信息获取失败"
fi

echo ""
echo "4. 检查curl_cffi依赖..."
python3.10 -c "import curl_cffi; print('✅ curl_cffi依赖正常')" 2>/dev/null || echo "❌ curl_cffi依赖异常"

echo ""
echo "=== 修复验证完成 ==="