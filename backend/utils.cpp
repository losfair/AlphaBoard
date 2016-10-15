#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include <list>

static std::list<char *> mem_allocations;

static const char *char_table = "abcdefghijklmnopqrstuvwxyz0123456789";
static int char_table_length;

static bool debug_on = false;

extern "C" void init() {
    char_table_length = strlen(char_table);
    srand(time(0));
}

extern "C" void enable_debug() {
    debug_on = true;
}

extern "C" void print_char_p_address(char *p) {
    printf("%p\n",p);
}

extern "C" char * get_random_string(int length) {
    int i;
    char *ret;

    if(length <= 0) return NULL;

    ret = new char [length+1];

    for(i=0; i<length; i++) ret[i] = char_table[ rand() % char_table_length ];

    ret[length] = '\0';

    mem_allocations.push_back(ret);

    return ret;
}

extern "C" void free_memory() {
    int free_count = 0;

    for(auto m : mem_allocations) {
        delete[] m;
        free_count++;
    }

    if(debug_on) {
        printf("%d references freed.\n",free_count);
    }

    mem_allocations.clear();
}