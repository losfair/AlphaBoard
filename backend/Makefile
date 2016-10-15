CXXFLAGS := -O2 -std=c++11 -fPIC

utils: utils.o
	$(CXX) -O2 -shared -o utils.so utils.o

clean:
	rm *.o
