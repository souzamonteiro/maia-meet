.PHONY: sfu signaling clean

sfu:
	cmake -S sfu -B build/sfu
	cmake --build build/sfu

signaling:
	cd signaling && npm install

clean:
	rm -rf build signaling/node_modules
