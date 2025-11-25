#!/bin/zsh
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

echo "Starting batch processing of extremist materials documents..."
echo ""

node scripts/batch_parse_docs.js

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Batch processing completed successfully"
else
    echo ""
    echo "✗ Batch processing failed"
    exit 1
fi
