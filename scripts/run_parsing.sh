#!/bin/zsh
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

DOC_FILE="r0cgbemn4oriwhjmjepofzez1dxq9ci0.doc"
TEMP_TXT="converted_temp.txt"

echo "Converting $DOC_FILE to $TEMP_TXT..."
# Pipe textutil output to cat to ensure correct text encoding/buffering behavior
/usr/bin/textutil -convert txt -stdout "$DOC_FILE" | cat > "$TEMP_TXT"

if [ $? -eq 0 ]; then
    echo "Conversion successful. Running parser..."
    node scripts/parse_doc_v2.js "$TEMP_TXT"
    rm "$TEMP_TXT"
else
    echo "Conversion failed."
    exit 1
fi
