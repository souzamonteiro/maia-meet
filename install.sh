#!/bin/sh

echo "Run this script using sudo and into maia-meet directory."

echo "Installing  Maia Meet logo images and the default backgroung image..."
cp images/* /usr/share/jitsi-meet/images/
cp -rf static /usr/share/jitsi-meet/

echo "Installing MaiaRecorder..."
cp favicon.ico /usr/share/jitsi-meet/

echo "Changing app name in all files in root directory..."
find /usr/share/jitsi-meet -type f -exec sed -i 's/Jitsi Meet/Maia Meet/g' {} \;

echo "Changing app name in all files in each subdirectory..."
cd /usr/share/jitsi-meet
for FILE in *; do
    if [ -d "$FILE" ]; then
        cd "$FILE"
        find /usr/share/jitsi-meet -type f -exec sed -i 's/Jitsi Meet/Maia Meet/g' {} \;
        cd ..
    fi
done

echo "Installing MaiaRecorder in index file..."
index_file="index.html"

if grep -q '<!--#include virtual="static\/recorder.html" -->' ${index_file}; then
    echo "MaiaRecorder already installed!"
else
    sed -i '/<div id="react" role="main"><\/div>/a\    <!--#include virtual="static\/recorder.html" -->' ${index_file}
    echo "MaiaRecorder installed!"
fi
