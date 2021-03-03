#!/bin/sh

echo "Run this script using sudo and into maia-meet directory."

echo "Install Maia Meet logo images and the default backgroung image."
cp images/* /usr/share/jitsi-meet/images/
cp favicon.ico /usr/share/jitsi-meet/

echo "Change app name in all files in root directory."
find /usr/share/jitsi-meet -type f -exec sed -i 's/Jitsi Meet/Maia Meet/g' {} \;

echo "Change app name in all files in each subdirectory."
cd /usr/share/jitsi-meet
for FILE in *; do
    if [ -d "$FILE" ]; then
        cd "$FILE"
        find /usr/share/jitsi-meet -type f -exec sed -i 's/Jitsi Meet/Maia Meet/g' {} \;
        cd ..
    fi
done
